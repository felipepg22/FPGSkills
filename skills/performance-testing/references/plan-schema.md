# Canonical plan schema

The example below documents the legacy version 1 shape. Version 1 remains valid for reading and integrity checks. Generate new plans as version 2 using the additions below; upgrade a legacy plan before recording reusable approval. Add evidence fields when useful, preserving these names/types.

```json
{
  "schemaVersion": 1,
  "id": "catalog-read-quick",
  "application": {
    "revision": "full git revision",
    "dirty": false,
    "configurationProfile": "local",
    "configurationEvidence": ["config/local.yaml", "compose.yaml"]
  },
  "targetType": "endpoint",
  "protocol": "http",
  "target": {
    "environment": "local",
    "locality": "loopback",
    "address": "http://127.0.0.1:3000/catalog",
    "localityEvidence": ["compose.yaml publishes the app on 127.0.0.1:3000"],
    "daemonVerified": false,
    "containerNetwork": null,
    "containerService": null
  },
  "cases": [
    {
      "id": "catalog-read",
      "operation": "GET /catalog",
      "readOnlyEvidence": ["src/catalog/routes.ts registers a read-only handler"],
      "mutatesBusinessData": false,
      "secretEnvironmentVariables": ["AUTH_TOKEN"],
      "testDataRefs": ["fixtures/catalog.json"],
      "functionalChecks": ["status 200", "response contains items array"]
    }
  ],
  "excludedOperations": [
    {
      "operation": "POST /catalog",
      "reason": "outside the requested endpoint coverage",
      "evidence": ["src/catalog/routes.ts"]
    }
  ],
  "workload": {
    "scenario": "load",
    "model": "closed",
    "executor": "constant-vus",
    "duration": "2m",
    "vus": 10,
    "arrivalRate": null,
    "repetitions": 1,
    "stages": [{ "name": "steady", "duration": "2m", "target": 10 }],
    "compositeWeights": null
  },
  "measurements": ["response behavior", "target process CPU and memory"],
  "reports": ["markdown", "local-dashboard"],
  "slos": [],
  "safety": {
    "remoteWritableDependenciesVerifiedAbsent": true,
    "effectiveConfigurationEvidence": ["config/local.yaml", "compose.yaml"],
    "expectedSideEffects": ["bounded expiring session for the local test identity"],
    "stops": [
      {
        "id": "max-duration",
        "observable": "campaign wall-clock duration",
        "threshold": "10m",
        "action": "abort campaign and retain partial evidence",
        "implementation": "executor supervisor timeout of 600 seconds"
      },
      {
        "id": "runaway-errors",
        "observable": "case error rate",
        "threshold": "greater than 20% for 10 seconds",
        "action": "abort active scenario",
        "implementation": "k6 abortOnFail threshold with delayAbortEval"
      }
    ]
  },
  "environmentVariables": [
    "PLAN_ID",
    "PLAN_FINGERPRINT",
    "RUN_ID",
    "CASE_ID",
    "TARGET_URL",
    "TARGET_LOCALITY",
    "HTTP_METHOD",
    "OPERATION_NAME",
    "APPROVED_HTTP_METHODS",
    "EXECUTOR",
    "SCENARIO_NAME",
    "SCENARIO_CONFIG",
    "EXPECTED_STATUSES",
    "AUTH_MODE",
    "SAFETY_ERROR_RATE",
    "SAFETY_DELAY_ABORT_EVAL",
    "K6_RESULTS_DIR",
    "K6_WEB_DASHBOARD",
    "K6_WEB_DASHBOARD_EXPORT",
    "K6_WEB_DASHBOARD_PORT"
  ],
  "environmentBindings": {
    "smoke": [
      {
        "id": "catalog-read-smoke",
        "caseId": "catalog-read",
        "values": {
          "PLAN_ID": "catalog-read-quick",
          "PLAN_FINGERPRINT": "$COMPUTED_PLAN_FINGERPRINT",
          "RUN_ID": "$GENERATED_RUN_ID",
          "CASE_ID": "catalog-read",
          "TARGET_URL": "http://127.0.0.1:3000/catalog",
          "TARGET_LOCALITY": "loopback",
          "HTTP_METHOD": "GET",
          "OPERATION_NAME": "GET /catalog",
          "APPROVED_HTTP_METHODS": "GET",
          "EXECUTOR": "shared-iterations",
          "SCENARIO_NAME": "smoke",
          "SCENARIO_CONFIG": "{\"executor\":\"shared-iterations\",\"vus\":1,\"iterations\":1,\"maxDuration\":\"30s\"}",
          "EXPECTED_STATUSES": "200",
          "AUTH_MODE": "bearer",
          "SAFETY_ERROR_RATE": "0.2",
          "SAFETY_DELAY_ABORT_EVAL": "10s",
          "K6_RESULTS_DIR": "docs/performance-tests/.artifacts/catalog-read/smoke"
        }
      }
    ],
    "run": [
      {
        "id": "catalog-read-load-r1",
        "caseId": "catalog-read",
        "scenario": "load",
        "repetition": 1,
        "values": {
          "PLAN_ID": "catalog-read-quick",
          "PLAN_FINGERPRINT": "$COMPUTED_PLAN_FINGERPRINT",
          "RUN_ID": "$GENERATED_RUN_ID",
          "CASE_ID": "catalog-read",
          "TARGET_URL": "http://127.0.0.1:3000/catalog",
          "TARGET_LOCALITY": "loopback",
          "HTTP_METHOD": "GET",
          "OPERATION_NAME": "GET /catalog",
          "APPROVED_HTTP_METHODS": "GET",
          "EXECUTOR": "constant-vus",
          "SCENARIO_NAME": "load",
          "SCENARIO_CONFIG": "{\"executor\":\"constant-vus\",\"vus\":10,\"duration\":\"2m\"}",
          "EXPECTED_STATUSES": "200",
          "AUTH_MODE": "bearer",
          "SAFETY_ERROR_RATE": "0.2",
          "SAFETY_DELAY_ABORT_EVAL": "10s",
          "K6_RESULTS_DIR": "docs/performance-tests/.artifacts/catalog-read/run",
          "K6_WEB_DASHBOARD": "true",
          "K6_WEB_DASHBOARD_EXPORT": "docs/performance-tests/reports/catalog-read.html",
          "K6_WEB_DASHBOARD_PORT": "-1"
        }
      }
    ],
    "report": [
      { "id": "catalog-read-report", "values": {} }
    ]
  },
  "secretEnvironmentVariables": ["AUTH_TOKEN"],
  "generatedFiles": [
    {
      "kind": "k6-entrypoint",
      "bindingIds": ["catalog-read-smoke", "catalog-read-load-r1"],
      "path": "docs/performance-tests/k6/catalog-read.js",
      "sha256": "lowercase 64-character digest"
    },
    {
      "kind": "support",
      "bindingIds": [],
      "path": "docs/performance-tests/k6/lib/reporter.js",
      "sha256": "lowercase 64-character digest"
    }
  ],
  "commands": {
    "start": ["npm run start:test"],
    "smoke": ["env PLAN_ID=catalog-read-quick PLAN_FINGERPRINT=$COMPUTED_PLAN_FINGERPRINT RUN_ID=$GENERATED_RUN_ID CASE_ID=catalog-read TARGET_URL=http://127.0.0.1:3000/catalog TARGET_LOCALITY=loopback HTTP_METHOD=GET OPERATION_NAME='GET /catalog' APPROVED_HTTP_METHODS=GET EXECUTOR=shared-iterations SCENARIO_NAME=smoke SCENARIO_CONFIG='{\"executor\":\"shared-iterations\",\"vus\":1,\"iterations\":1,\"maxDuration\":\"30s\"}' EXPECTED_STATUSES=200 AUTH_MODE=bearer SAFETY_ERROR_RATE=0.2 SAFETY_DELAY_ABORT_EVAL=10s K6_RESULTS_DIR=docs/performance-tests/.artifacts/catalog-read/smoke AUTH_TOKEN=$AUTH_TOKEN k6 run docs/performance-tests/k6/catalog-read.js"],
    "run": ["env PLAN_ID=catalog-read-quick PLAN_FINGERPRINT=$COMPUTED_PLAN_FINGERPRINT RUN_ID=$GENERATED_RUN_ID CASE_ID=catalog-read TARGET_URL=http://127.0.0.1:3000/catalog TARGET_LOCALITY=loopback HTTP_METHOD=GET OPERATION_NAME='GET /catalog' APPROVED_HTTP_METHODS=GET EXECUTOR=constant-vus SCENARIO_NAME=load SCENARIO_CONFIG='{\"executor\":\"constant-vus\",\"vus\":10,\"duration\":\"2m\"}' EXPECTED_STATUSES=200 AUTH_MODE=bearer SAFETY_ERROR_RATE=0.2 SAFETY_DELAY_ABORT_EVAL=10s K6_RESULTS_DIR=docs/performance-tests/.artifacts/catalog-read/run K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=docs/performance-tests/reports/catalog-read.html K6_WEB_DASHBOARD_PORT=-1 AUTH_TOKEN=$AUTH_TOKEN k6 run --out json=docs/performance-tests/.artifacts/catalog-read/raw.json docs/performance-tests/k6/catalog-read.js"],
    "report": ["node \"$PERFORMANCE_TESTING_SKILL_ROOT/scripts/render-report.mjs\" --summary docs/performance-tests/.artifacts/catalog-read/run/summary.json --raw docs/performance-tests/.artifacts/catalog-read/raw.json --context docs/performance-tests/.artifacts/catalog-read/context.json --json-output docs/performance-tests/.artifacts/catalog-read/run.json --output docs/performance-tests/reports/catalog-read.md"],
    "cleanup": ["npm run stop:test"]
  },
  "artifacts": {
    "root": "docs/performance-tests",
    "raw": "docs/performance-tests/.artifacts/catalog-read/raw.json",
    "logs": "docs/performance-tests/.artifacts/catalog-read/execution.log",
    "canonicalRun": "docs/performance-tests/.artifacts/catalog-read/run.json",
    "reports": [
      "docs/performance-tests/reports/catalog-read.md",
      "docs/performance-tests/reports/catalog-read.html"
    ]
  },
  "toolVersions": {
    "k6": "detected exact version"
  },
  "downloads": []
}
```

Every command array is non-empty. Before generating commands that use bundled tooling, resolve `PERFORMANCE_TESTING_SKILL_ROOT` to the absolute directory containing the installed `SKILL.md`; it is a workflow-local tool path, not target configuration. Commands must be directly executable with that resolved root and after substituting only declared plan environment-variable values; placeholders such as “approved command” do not pass validation. Never hardcode an agent-specific skill directory. Generated-file paths stay below `docs/performance-tests/`, and their lowercase SHA-256 digests are computed from the exact bytes awaiting approval. Each smoke/run binding id maps to exactly one `k6-entrypoint`, and its command invokes that exact path without any other executable under `docs/performance-tests/`. Shared modules are `support` files with no binding ids. List and hash the complete local dependency closure: every relative static import or literal `open()`/`readFile()` dependency plus each local proto, protoset, fixture, data, or certificate path referenced by a binding. Remote imports and dependencies outside `docs/performance-tests/` are invalid.

Use `target.locality: "container"` only when `daemonVerified` is true, `containerNetwork` and `containerService` are non-empty, the address hostname matches that inspected service (or its inspected private address), and repository evidence plus daemon inspection proves it belongs to that approved local network. A container label, URL scheme, hostname suffix, or environment name alone is never locality proof.

Allowed report identifiers are `markdown`, `local-dashboard`, and `self-hosted-grafana`. When self-hosted Grafana is selected, add:

```json
{
  "grafana": {
    "daemonVerified": true,
    "daemonProvider": "detected provider and version",
    "projectName": "perf-catalog-read-sha-prefix",
    "experimentalPrometheusOutputAcknowledged": true,
    "images": [
      { "name": "prom/prometheus", "version": "vX.Y.Z", "digest": "sha256:..." },
      { "name": "grafana/grafana", "version": "X.Y.Z", "digest": "sha256:..." }
    ],
    "preserveVolumes": true
  }
}
```

Repeat each selected image in `downloads` with an official source, exact version, digest when available, and reason. Plan approval authorizes only those listed pulls. Do not use `latest` or a floating major/minor tag.

Self-hosted Grafana run bindings also include the exact loopback `K6_PROMETHEUS_RW_SERVER_URL` and supported `K6_PROMETHEUS_RW_TREND_STATS`; the command enables the experimental Prometheus remote-write output. Journey bindings include an exact non-negative `THINK_TIME`. Add protocol-specific HTTP/gRPC variables only to the case entries that use them.

Every SLO entry must use `"source": "conversation"` and identify metric, scope, threshold, comparator, and unit. Environment-variable names match `[A-Z_][A-Z0-9_]*`. The union of phase `values` keys equals `environmentVariables`; each entry corresponds one-to-one with its command. Each proposed case has one one-VU/one-iteration smoke entry and one run entry per planned repetition, even when the user approves only some phases. A composite uses `kind: "composite"` and `caseId: null` only with approved weights. Only computed-fingerprint and generated-run-id sentinels may be resolved after validation. `secretEnvironmentVariables` contains names only. Approval and fingerprint stay outside canonical JSON.

## Version 2 additions

Set `schemaVersion: 2`. Every case retains `mutatesBusinessData` and adds `mutation`. Read-only cases use `{ "effects": [] }` with `readOnlyEvidence`. Mutating cases use this shape (values must come from actual evidence):

```json
{
  "effects": ["create one fixture per request"],
  "evidence": ["src/fixture.ts create handler"],
  "resourceTypes": ["fixture"],
  "ownership": "run-owned",
  "recovery": "delete fixtures bearing the unique run marker",
  "failureResidue": "at most 100 fixtures",
  "identity": "dedicated-test",
  "bounds": { "requests": 100, "records": 100, "concurrency": 2, "durationSeconds": 60, "retries": 0 },
  "enforcement": "one record per request; execution guard and supervisor",
  "externalEffects": [],
  "destructiveSchema": false,
  "setup": "use the disclosed fixture namespace",
  "cleanup": "delete only records with the current run marker"
}
```

`ownership` is `run-owned` or `pre-existing`; the latter requires recovery evidence and a separate warning. `identity` is `dedicated-test` or `local` (local mutations only). Each external effect has `destination`, `environment: "non-production"`, `billable: false`, positive integer `maxCount`, and `evidence`.

Add `safety.preconditions` (non-empty evidence-backed capacity/data assumptions) and `safety.dependencies` (possibly empty). Each dependency has `destination`, `environment` (`local` or `non-production`), boolean `writable`, `billable: false`, and `evidence`. Remote dependencies require a target-level attestation even when the target itself is local. Version 2 supersedes the legacy `remoteWritableDependenciesVerifiedAbsent` flag with this inventory.

Remote targets use `locality: "remote"`, `environment: "non-production"`, `attestation` recording the user's environment/authority statement, and `contradictoryEvidence: []`. Keep container fields null and record environment/configuration evidence in `localityEvidence`. Each remote binding adds `APPROVED_REMOTE_HOST` matching the exact target hostname. Credentials stay out of URLs; DNS and account evidence must be rechecked for drift.

Add `executionPhases`: each entry contains unique `id`, non-empty `caseIds`, `phase` (`start`, `preflight`, `smoke`, `run`, `cleanup`), exact `commands`, `prerequisites` (phase IDs), and numeric `bounds` using the shape above. Every start/smoke/run/cleanup command maps exactly once to a phase. Remote probes go in `commands.preflight` and matching phases. Prerequisites must be acyclic; data cleanup has no prerequisite that forces replay of setup or failed load. Include service shutdown in the selected setup lifecycle; keep business cleanup separately selectable.

Each smoke/run binding binds `MAX_REQUESTS`, `MAX_RECORDS`, `MAX_CONCURRENCY`, and `MAX_DURATION_SECONDS` to its phase bounds, plus an evidence-backed integer `MAX_RECORDS_PER_REQUEST` (zero for read-only). Include these variables in `environmentVariables` and exact commands. Each phase's bounds must stay within its cases' disclosed limits; supervisor retries share the phase's cumulative budget. Include and hash `lib/execution-guard.js` alongside `lib/reporter.js`, and call the guard before every operation. Allow different smoke/run budgets. The guard is per process; concurrent k6 processes must not multiply a shared phase budget.

`scripts/authorize-plan.mjs` is the public approval-validation boundary. See [authorization.md](authorization.md) for sidecar/request schemas, warnings, provenance checks, and partial execution. No executable interprets a fingerprint as user consent.
