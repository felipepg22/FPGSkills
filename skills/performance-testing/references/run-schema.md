# Canonical run record

Write one JSON record per measured run. The Markdown and HTML views derive from this record; raw k6 output is evidence, not the canonical report.

## Use this shape

```json
{
  "schemaVersion": 1,
  "plan": { "id": "catalog-read", "fingerprint": "sha256:..." },
  "run": {
    "id": "catalog-read-20260815T120000Z",
    "status": "complete",
    "startedAt": "2026-08-15T12:00:00Z",
    "endedAt": "2026-08-15T12:02:00Z",
    "wallClockMs": 120000,
    "scenarioDurationMs": 110000,
    "incompleteCoverage": []
  },
  "environment": {
    "gitRevision": "full revision",
    "gitDirty": false,
    "os": "darwin",
    "cpu": "recorded description",
    "memoryBytes": 17179869184,
    "applicationProfile": "local",
    "target": "http://127.0.0.1:3000/catalog",
    "k6Version": "detected version",
    "containerLimits": null
  },
  "workload": {
    "scenario": "load",
    "model": "closed",
    "executor": "constant-vus",
    "stages": [],
    "concurrency": 10,
    "arrivalRate": null,
    "repetition": 1,
    "dataVolume": "documented fixture",
    "streamCompletionSemantics": null
  },
  "metrics": [
    {
      "case": "catalog-read",
      "operation": "GET /catalog",
      "scenario": "load",
      "unit": "ms",
      "successfulSamples": 1200,
      "sampleCount": 1200,
      "mean": 12.4,
      "p50Median": 11.8,
      "p95": 19.2,
      "p99": 24.1,
      "min": 7.1,
      "max": 30.3,
      "standardDeviation": 3.2,
      "throughputPerSecond": 100.0,
      "errorRate": 0.0,
      "p99Exploratory": false
    }
  ],
  "functionalChecks": [],
  "slos": [],
  "safetyStops": [],
  "excludedOperations": [],
  "instrumentationGaps": [],
  "artifacts": {},
  "analysis": { "observations": [], "correlations": [], "hypotheses": [], "confirmedCauses": [] }
}
```

## Enforce the record

- Emit one metric row for every approved case, operation, scenario, and selected timing measurement combination. `sampleCount` counts samples for that timing measurement; throughput and error rate remain operation-level signals, which matters for multi-message streams. Never average percentile values across combinations.
- Calculate standard deviation from the same successful latency samples used for the percentiles and state whether failed samples are represented separately.
- With zero successful samples, store timing statistics as `null` and render them as unavailable while retaining attempt/error evidence. A pre-execution `blocked` record may have no metric rows only when incomplete coverage explains why.
- Set `p99Exploratory: true` below 1,000 successful samples. Keep `p50Median` as one field.
- Preserve supplied SLOs with `source: "conversation"`. An empty array means baseline-only reporting and forbids a pass/fail verdict.
- Mark a run `partial`, `aborted`, or `blocked` when applicable and populate incomplete coverage, safety-stop, and instrumentation-gap evidence.
- Validate required keys and finite numeric values before rendering Markdown. Never place secret values in this record.
