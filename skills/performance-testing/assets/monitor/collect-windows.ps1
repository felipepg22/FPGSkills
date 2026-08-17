param(
  [Parameter(Mandatory = $true)][string]$ProcessId,
  [Parameter(Mandatory = $true)][string]$DurationSeconds,
  [Parameter(Mandatory = $true)][string]$IntervalSeconds,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$OutputFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$invariantCulture = [System.Globalization.CultureInfo]::InvariantCulture

function ConvertTo-PositiveInt32 {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $parsed = 0
  $validFormat = $Value -match '^[1-9][0-9]*$'
  $parsedSuccessfully = [int]::TryParse(
    $Value,
    [System.Globalization.NumberStyles]::None,
    $invariantCulture,
    [ref]$parsed
  )
  if (-not ($validFormat -and $parsedSuccessfully -and $parsed -gt 0)) {
    throw "$Name must be a positive integer no greater than 2147483647."
  }
  return $parsed
}

function Get-ProcessSnapshot {
  param(
    [Parameter(Mandatory = $true)][int]$Id,
    [Parameter(Mandatory = $true)][long]$ExpectedStartTicks,
    [Parameter(Mandatory = $true)][System.Diagnostics.Stopwatch]$SampleClock
  )

  $current = Get-Process -Id $Id -ErrorAction Stop
  $sampledAt = Get-Date
  $currentStart = $current.StartTime
  if ($currentStart.Ticks -ne $ExpectedStartTicks) {
    throw "Process $Id exited and its PID was reused."
  }

  return [pscustomobject]@{
    ClockSeconds = $SampleClock.Elapsed.TotalSeconds
    CpuSeconds = $current.TotalProcessorTime.TotalSeconds
    Timestamp = $sampledAt.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", $invariantCulture)
    RssKb = $current.WorkingSet64 / 1KB
    VszKb = $current.VirtualMemorySize64 / 1KB
  }
}

function Write-ProcessSample {
  param(
    [Parameter(Mandatory = $true)][object]$Snapshot,
    [Parameter(Mandatory = $true)][double]$CpuPercent,
    [Parameter(Mandatory = $true)][System.IO.StreamWriter]$Writer
  )

  $cpu = ([math]::Round([math]::Max(0, $cpuPercent), 3)).ToString("0.###", $invariantCulture)
  $rss = ([math]::Round($Snapshot.RssKb, 3)).ToString("0.###", $invariantCulture)
  $vsz = ([math]::Round($Snapshot.VszKb, 3)).ToString("0.###", $invariantCulture)
  $Writer.WriteLine("$($Snapshot.Timestamp),$cpu,$rss,$vsz")
}

$targetProcessId = ConvertTo-PositiveInt32 -Name "ProcessId" -Value $ProcessId
$duration = ConvertTo-PositiveInt32 -Name "DurationSeconds" -Value $DurationSeconds
$interval = ConvertTo-PositiveInt32 -Name "IntervalSeconds" -Value $IntervalSeconds

$target = Get-Process -Id $targetProcessId -ErrorAction Stop
$targetStartTicks = $target.StartTime.Ticks
$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
$writer = [System.IO.StreamWriter]::new($OutputFile, $false, $utf8WithoutBom)
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$previous = Get-ProcessSnapshot -Id $targetProcessId -ExpectedStartTicks $targetStartTicks -SampleClock $stopwatch

try {
  $writer.WriteLine("timestamp_utc,cpu_percent,rss_kb,vsz_kb")
  while ($stopwatch.Elapsed.TotalSeconds -lt $duration) {
    $remainingSeconds = $duration - $stopwatch.Elapsed.TotalSeconds
    $pauseSeconds = [math]::Min($interval, $remainingSeconds)
    $wakeAt = $stopwatch.Elapsed.TotalSeconds + $pauseSeconds
    while ($stopwatch.Elapsed.TotalSeconds -lt $wakeAt) {
      $sleepMilliseconds = [math]::Ceiling([math]::Min(1, $wakeAt - $stopwatch.Elapsed.TotalSeconds) * 1000)
      Start-Sleep -Milliseconds ([int][math]::Max(1, $sleepMilliseconds))
    }

    $current = Get-ProcessSnapshot -Id $targetProcessId -ExpectedStartTicks $targetStartTicks -SampleClock $stopwatch
    $sampleSeconds = $current.ClockSeconds - $previous.ClockSeconds
    $cpuSeconds = $current.CpuSeconds - $previous.CpuSeconds
    if ($sampleSeconds -le 0 -or $cpuSeconds -lt 0) {
      throw "Process $targetProcessId returned a non-monotonic CPU or elapsed-time sample."
    }
    $cpuPercent = 100 * $cpuSeconds / $sampleSeconds
    Write-ProcessSample -Snapshot $current -CpuPercent $cpuPercent -Writer $writer
    $writer.Flush()
    $previous = $current
  }
} finally {
  $stopwatch.Stop()
  $writer.Dispose()
}
