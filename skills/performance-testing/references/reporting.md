# Result and report contract

Canonical JSON is mandatory and follows `references/run-schema.md`. Human reports are user-selectable and may be combined.

## Produce selected outputs

- **Markdown:** Generate a portable report under `docs/performance-tests/reports/` with the bundled local reporter; do not fetch a remote formatter.
- **Local dashboard:** Enable the k6 localhost dashboard and export a self-contained HTML file. Adjust its aggregation period when a short test would otherwise contain no graphs.
- **Complete self-hosted:** Run approved, pinned Grafana OSS and Prometheus OSS services through the available local Docker-compatible daemon. Validate the rendered Compose file and its secret-from-environment support with that exact provider before pulling or starting services. Treat k6 Prometheus remote write as experimental and retain the fallback reports.

For self-hosted output, bind the Prometheus remote-write URL to the approved loopback receiver and explicitly configure every dashboard Trend statistic the installed k6 version supports, including `avg`, `med`/p50, p95, and p99. Do not assume the default output emits them. Reuse existing local Prometheus application telemetry when compatible. Do not install host, container, database, or application exporters automatically.

List every image download with exact version or digest in the approved plan. Do not use `latest`. Grafana Cloud and every remote result sink are out of scope.

## Record the run

Include:

- Plan identifier and fingerprint, timestamps, campaign wall-clock time, scenario durations, status, and incomplete coverage.
- Git revision and dirty state, OS, CPU, memory, application profile, local target, k6 version, and container limits.
- Workload model, stages, concurrency or rate, repetitions, data volume, and stream completion semantics.
- Per-operation and per-scenario sample count, mean, `p50 (median)`, p95, p99, min, max, standard deviation, throughput, and error rate.
- Functional checks, supplied SLOs and their source, safety stops, excluded operations, instrumentation gaps, and artifact paths.
- Bottleneck observations and hypotheses using the contract in `references/bottlenecks.md`.

Label p99 exploratory below 1,000 successful samples. Without a user-supplied SLO, call the result a baseline and omit pass/fail. Keep median and p50 in one field because they are the same statistic.

## Preserve results intentionally

Keep raw JSON, logs, and transient monitoring data in `.artifacts/<run-id>/`. Retain Markdown or HTML reports only when the user wants them versioned. Preserve Grafana/Prometheus named volumes after stopping the stack; volume removal requires separate approval.

Compare with a previous result only when the compatibility checks in `references/workloads.md` pass. State every material difference and avoid a regression percentage when they do not.
