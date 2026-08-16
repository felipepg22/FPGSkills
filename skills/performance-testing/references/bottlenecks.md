# Bottleneck analysis

Latency from a load generator identifies symptoms, not root causes. Make every claim match its evidence.

## Use an evidence ladder

1. **Observation:** a directly measured value or event, such as rising p99 or CPU saturation.
2. **Correlation:** two measured signals change together, such as queue depth and latency.
3. **Hypothesis:** repository inspection and measurements suggest a mechanism.
4. **Confirmed cause:** a controlled follow-up experiment changes only the proposed mechanism and changes the outcome as predicted.

Do not skip levels. When telemetry is absent, report an instrumentation gap and keep code-based findings as hypotheses.

## Investigate the narrow path

Start with the slow operation or stream measurement, then inspect only its relevant handler, service, queries, serialization, locks, downstream calls, and runtime configuration. Look for:

- Database scans, missing indexes, N+1 access, pool exhaustion, and long transactions.
- Blocking I/O, serialized work, lock contention, thread/event-loop starvation, and queue buildup.
- Excessive allocation, garbage collection, memory growth, copying, encoding, compression, or large payloads.
- Connection setup, TLS handshakes, retries, timeouts, cache misses, and dependency fan-out.
- Load-generator saturation, local machine pressure, container throttling, and test-data artifacts.
- gRPC flow control, message size, stream completion, and invalid latency correlation.

## Report possible bottlenecks

For each item provide:

- Symptom and affected case.
- Runtime evidence with metric, interval, and artifact location.
- Relevant code/config evidence with file and symbol.
- Classification: observation, correlation, hypothesis, or confirmed cause.
- Confidence and competing explanations.
- Next controlled experiment that could confirm or reject it.

Separate application bottlenecks from load-generator or local-environment limitations. A report with no defensible bottleneck should say so and recommend the smallest useful instrumentation or experiment rather than inventing one.

