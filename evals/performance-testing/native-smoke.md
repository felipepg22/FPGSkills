# Native smoke procedure

Run this procedure on each claimed native platform after package tests pass. It verifies the local HTTP template, report artifacts, and platform collector without any remote target or business mutation.

## Common preparation

1. Record `node --version` and `k6 version`; require Node.js 22 or newer and an already approved k6 installation.
2. Create and explicitly approve a disposable local evaluation plan. Generate its Markdown and use its real fingerprint below; do not use a dummy approval value.
3. Start `node evals/fixtures/read-only-server.mjs` from the package root and record its PID.
4. Verify `http://127.0.0.1:3000/health` returns `{"status":"ok"}` and that a POST returns 405.

## macOS or Linux

1. Create a new temporary results directory with `mktemp -d` and create its `run` child directory.
2. Set the exact approved smoke bindings: `PLAN_ID`, `PLAN_FINGERPRINT`, `RUN_ID`, `CASE_ID=health`, `SCENARIO_NAME=smoke`, `TARGET_URL=http://127.0.0.1:3000/health`, `TARGET_LOCALITY=loopback`, `HTTP_METHOD=GET`, `OPERATION_NAME=GET /health`, `APPROVED_HTTP_METHODS=GET`, `EXPECTED_STATUSES=200`, `AUTH_MODE=none`, `EXECUTOR=shared-iterations`, `SCENARIO_CONFIG={"executor":"shared-iterations","vus":1,"iterations":1,"maxDuration":"30s"}`, `SAFETY_ERROR_RATE=1`, `SAFETY_DELAY_ABORT_EVAL=0s`, and `K6_RESULTS_DIR` pointing to the `run` directory.
3. Run `k6 run --out json=<temporary-directory>/run/raw.json assets/k6/http-endpoint.js`.
4. Run `sh assets/monitor/collect-posix.sh <server-pid> 3 1 <temporary-directory>/run/process.csv`.
5. Write a non-secret `context.json` matching `references/run-schema.md` with the observed timestamps, environment, workload, checks, safety state, artifacts, and empty conversation-SLO array.
6. Run `node scripts/render-report.mjs --summary <temporary-directory>/run/summary.json --raw <temporary-directory>/run/raw.json --context <temporary-directory>/run/context.json --json-output <temporary-directory>/run/run.json --output <temporary-directory>/run/final-report.md`.

## Native Windows PowerShell

1. Create a unique directory beneath `$env:TEMP` with `New-Item -ItemType Directory`; do not reuse a broad system directory.
2. Set the same exact approved bindings as the POSIX procedure with PowerShell environment assignments, including the actual `PLAN_FINGERPRINT`, the one-VU/one-iteration `SCENARIO_CONFIG`, and `K6_RESULTS_DIR` pointing to the `run` child.
3. Run `k6 run --out json=<temporary-directory>\run\raw.json assets\k6\http-endpoint.js`.
4. Run `assets\monitor\collect-windows.ps1 -ProcessId <server-pid> -DurationSeconds 3 -IntervalSeconds 1 -OutputFile <temporary-directory>\run\process.csv`.
5. Write the same non-secret canonical `context.json` contract with PowerShell.
6. Run `node scripts\render-report.mjs --summary <temporary-directory>\run\summary.json --raw <temporary-directory>\run\raw.json --context <temporary-directory>\run\context.json --json-output <temporary-directory>\run\run.json --output <temporary-directory>\run\final-report.md`.

## Verify and clean up

- Confirm k6 exits successfully; `summary.json`, `raw.json`, `run.json`, `report.md`, `final-report.md`, and `process.csv` exist; and the canonical outputs include mean, `p50 (median)`, p95, p99, sample count, throughput, error rate, durations, and standard deviation.
- Confirm the target remained loopback-only and the server logged no non-read operation.
- Stop only the fixture server started for this evaluation. Preserve the temporary directory until results have been reviewed, then remove it explicitly.
- Record platform, architecture, k6 version, Node version, pass/fail, and artifact location in the evaluation notes.
