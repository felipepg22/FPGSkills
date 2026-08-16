#!/usr/bin/env sh
set -eu

LC_ALL=C
export LC_ALL

if [ "$#" -ne 4 ]; then
  echo "Usage: collect-posix.sh <pid> <duration-seconds> <interval-seconds> <output.csv>" >&2
  exit 2
fi

target_pid=$1
duration_seconds=$2
interval_seconds=$3
output_file=$4

if [ -z "$output_file" ]; then
  echo "output.csv must be a non-empty path" >&2
  exit 2
fi

is_positive_int32() {
  awk -v value="$1" 'BEGIN {
    exit !(value ~ /^[1-9][0-9]*$/ && value <= 2147483647)
  }'
}

ps_duration_seconds() {
  awk -v value="$1" 'BEGIN {
    days = 0
    clock = value
    dash = index(clock, "-")
    if (dash > 0) {
      day_part = substr(clock, 1, dash - 1)
      clock = substr(clock, dash + 1)
      if (day_part !~ /^[0-9]+$/) exit 1
      days = day_part + 0
    }
    count = split(clock, part, ":")
    if (count != 2 && count != 3) exit 1
    for (field_index = 1; field_index < count; field_index++) if (part[field_index] !~ /^[0-9]+$/) exit 1
    if (part[count] !~ /^[0-9]+([.][0-9]+)?$/) exit 1
    if (count == 2) total = days * 86400 + part[1] * 60 + part[2]
    else total = days * 86400 + part[1] * 3600 + part[2] * 60 + part[3]
    printf "%.6f\n", total
  }'
}

linux_process_snapshot() {
  stat_fields=$(sed 's/^.*) //' "/proc/$target_pid/stat" 2>/dev/null) || return 1
  set -- $stat_fields
  [ "$#" -ge 20 ] || return 1
  awk -v user_ticks="$12" -v system_ticks="$13" -v start_ticks="$20" -v ticks_per_second="$clock_ticks" 'BEGIN {
    integer = "^[0-9]+$"
    if (user_ticks !~ integer || system_ticks !~ integer || start_ticks !~ integer || ticks_per_second !~ integer || ticks_per_second <= 0) exit 1
    printf "%s %.6f\n", start_ticks, (user_ticks + system_ticks) / ticks_per_second
  }'
}

if ! is_positive_int32 "$target_pid" ||
   ! is_positive_int32 "$duration_seconds" ||
   ! is_positive_int32 "$interval_seconds"; then
  echo "pid, duration, and interval must be positive integers no greater than 2147483647" >&2
  exit 2
fi

initial_sample=$(ps -p "$target_pid" -o lstart= -o etime= -o time= -o rss= -o vsz= 2>/dev/null || true)
set -- $initial_sample
if [ "$#" -ne 9 ]; then
  echo "process $target_pid is unavailable or cannot be sampled" >&2
  exit 1
fi
process_started="$1 $2 $3 $4 $5"
if ! initial_elapsed_seconds=$(ps_duration_seconds "$6") ||
   ! previous_cpu_seconds=$(ps_duration_seconds "$7"); then
  echo "process $target_pid returned invalid elapsed or CPU time" >&2
  exit 1
fi

use_linux_proc=false
if [ -r "/proc/$target_pid/stat" ]; then
  clock_ticks=$(getconf CLK_TCK 2>/dev/null || true)
  if awk -v ticks="$clock_ticks" 'BEGIN { exit !(ticks ~ /^[1-9][0-9]*$/) }'; then
    use_linux_proc=true
    if ! linux_snapshot=$(linux_process_snapshot); then
      echo "process $target_pid returned invalid Linux process statistics" >&2
      exit 1
    fi
    set -- $linux_snapshot
    process_started="proc:$1"
    previous_cpu_seconds=$2
  fi
fi

printf '%s\n' 'timestamp_utc,cpu_percent,rss_kb,vsz_kb' > "$output_file"
previous_elapsed_seconds=$initial_elapsed_seconds

while :; do
  elapsed_seconds=$(awk -v current="$previous_elapsed_seconds" -v started="$initial_elapsed_seconds" 'BEGIN {
    elapsed = current - started
    if (elapsed < 0) exit 1
    printf "%.0f\n", elapsed
  }')
  if [ "$elapsed_seconds" -ge "$duration_seconds" ]; then
    break
  fi

  remaining_seconds=$((duration_seconds - elapsed_seconds))
  sleep_seconds=$interval_seconds
  if [ "$sleep_seconds" -gt "$remaining_seconds" ]; then
    sleep_seconds=$remaining_seconds
  fi
  sleep "$sleep_seconds"

  sample=$(ps -p "$target_pid" -o lstart= -o etime= -o time= -o rss= -o vsz= 2>/dev/null || true)
  set -- $sample
  if [ "$#" -ne 9 ]; then
    echo "process $target_pid is unavailable or cannot be sampled" >&2
    exit 1
  fi

  sampled_started="$1 $2 $3 $4 $5"
  rss_kb=$8
  vsz_kb=$9

  if ! current_elapsed_seconds=$(ps_duration_seconds "$6") ||
     ! current_cpu_seconds=$(ps_duration_seconds "$7"); then
    echo "process $target_pid returned invalid elapsed or CPU time" >&2
    exit 1
  fi
  if [ "$use_linux_proc" = true ]; then
    if ! linux_snapshot=$(linux_process_snapshot); then
      echo "process $target_pid returned invalid Linux process statistics" >&2
      exit 1
    fi
    set -- $linux_snapshot
    sampled_started="proc:$1"
    current_cpu_seconds=$2
  fi
  if [ "$sampled_started" != "$process_started" ]; then
    echo "process $target_pid exited and its PID was reused" >&2
    exit 1
  fi
  if ! awk -v rss="$rss_kb" -v vsz="$vsz_kb" 'BEGIN {
    integer = "^[0-9]+$"
    exit !(rss ~ integer && vsz ~ integer)
  }'; then
    echo "process $target_pid returned an invalid memory sample" >&2
    exit 1
  fi
  if ! cpu_percent=$(awk \
    -v current_cpu="$current_cpu_seconds" \
    -v previous_cpu="$previous_cpu_seconds" \
    -v current_elapsed="$current_elapsed_seconds" \
    -v previous_elapsed="$previous_elapsed_seconds" 'BEGIN {
      elapsed = current_elapsed - previous_elapsed
      cpu = current_cpu - previous_cpu
      if (elapsed <= 0 || cpu < 0) exit 1
      printf "%.3f\n", 100 * cpu / elapsed
    }'); then
    echo "process $target_pid returned a non-monotonic CPU or elapsed-time sample" >&2
    exit 1
  fi

  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  printf '%s,%s,%s,%s\n' "$timestamp" "$cpu_percent" "$rss_kb" "$vsz_kb" >> "$output_file"
  previous_cpu_seconds=$current_cpu_seconds
  previous_elapsed_seconds=$current_elapsed_seconds
done
