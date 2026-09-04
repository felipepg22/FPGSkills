# Plan, approval, and safety contract

Treat the plan as the complete authorization boundary for all state-changing test setup and execution commands.

## Use the artifact layout

Reuse an approved repository convention when one exists. Otherwise propose:

```text
docs/performance-tests/
├── k6/
├── plans/
├── reports/
└── .artifacts/
```

Commit tests, approved plans, and intentionally retained reports. Keep raw results, logs, and transient dashboard state in `.artifacts/`. Never persist secret values. Ask before changing `.gitignore`.

## Write the canonical plan

Write `<plan-id>.json` as the machine authority and `<plan-id>.md` as its human rendering. Include:

- Schema version 2, plan identifier, application revision and dirty state, configuration profile, target scope, protocol, and target/environment evidence.
- Selected cases, evidence, functional checks, test-data references, and a `mutation` disclosure object, including read-only `effects: []`.
- Excluded operations and exclusion reasons outside the executable case list.
- Workload model, scenario type, stages, duration, concurrency or arrival rate, repetition mode, and composite weights if any.
- Measurements, report selections, optional conversation-supplied SLOs, and streaming timing semantics.
- Exact non-secret environment bindings, secret environment-variable names, generated executable paths and SHA-256 hashes, tool versions, local services, and exact non-empty startup, smoke, execution, reporting, and cleanup commands.
- Writable remote-dependency verification, downloads with exact versions or digests, artifact paths, safety stops, and expected side effects.
- Grafana integration risk when selected: k6 Prometheus remote write is experimental.

Generate the executable tests before approval. List and hash every local dependency in their complete closure, including imported helpers and referenced proto, protoset, fixture, data, and certificate files. Each smoke/run command must invoke exactly the `k6-entrypoint` mapped to its phase binding; never execute an unlisted alternate script. Resolve `PERFORMANCE_TESTING_SKILL_ROOT` to the absolute directory containing the installed `SKILL.md`, then use `node "$PERFORMANCE_TESTING_SKILL_ROOT/scripts/validate-plan.mjs" <plan.json> --markdown <plan.md>` to validate the schema, verify the deterministic Markdown rendering, verify generated-file hashes and dependency closure, and compute `sha256:<digest>`. Do not derive the root from an agent-specific installation path. Place the returned fingerprint in the Markdown plan footer; do not add it to the JSON it hashes.

## Establish the environment

Allow a loopback address, a repository-proven local container service, or an explicitly approved remote non-production target. Resolve the actual runtime target rather than trusting a label such as `test`.

Inspect effective database, cache, queue, object-store, webhook, email, analytics, and third-party endpoints. Enumerate their destinations, write behavior, environment evidence, and billing side effects. Remote scope requires the user's non-production and authority attestation, even for a local application with remote dependencies. Corroborate where possible; environment names alone cannot prove classification. Contradictory production evidence or unidentified targets/dependencies block execution. Record approved remote destinations explicitly. Non-billable emails, jobs, messages, events, and webhooks are allowed only with known non-production destinations and maximum counts.

When complete self-hosted Grafana is selected, verify a functioning local Docker-compatible daemon with a read-only version/info command. The provider may be Docker Desktop, Rancher Desktop, Podman compatibility, or another local daemon. Do not infer license eligibility or install a runtime.

## Disclose and bound mutation

Trace effects through contracts, implementation, and tests rather than HTTP verbs or RPC names. Include complete requested journeys and disclose every mutating step. Prefer run-owned records. Pre-existing records may be changed or deleted after warning and explicit approval when verified disposable fixtures or a named backup/snapshot with accessible restore procedure establish recovery.

For each mutating case declare operation, resource types, effects, evidence, ownership, data source, maximum requests/records/concurrency/duration/retries, per-request record effects, external destinations/counts, reversibility, setup, cleanup, and failure residue. Bound setup and cleanup as well as smoke and measured execution. A testing-environment claim alone is not recovery evidence. Require a dedicated test identity for remote mutations; disclose local identity scope. Authentication sessions need bounded expiry or cleanup and all business effects disclosed.

Hard prohibitions remain: production, destructive schema operations, unknown or unbounded per-invocation writes, irreversible deletion without recovery evidence, billable third-party side effects, and unidentified targets or dependencies. Approval cannot override these. An endpoint with unknown maximum records per request cannot be made eligible by a warning alone. Establish bounds from code/contracts, fixture restrictions, or server safeguards.

Wire `lib/execution-guard.js` before each HTTP request, RPC, and stream write; bind exact `MAX_REQUESTS`, `MAX_RECORDS`, `MAX_RECORDS_PER_REQUEST`, `MAX_CONCURRENCY`, and `MAX_DURATION_SECONDS` for each phase. The guard conservatively divides capacity across VUs; it may stop below the maximum. Disable redirects and automatic client retries. A supervisor enforces phase duration/concurrency and any explicitly bounded retries, and records budget exhaustion as an aborted run. Server-side fan-out and asynchronous effects require independent evidence/safeguards. Adapt custom journey/setup/cleanup code to enforce the same bounds; structural validation cannot prove arbitrary program behavior.

## Gate execution

Read [authorization.md](authorization.md) completely. Present natural-language approval choices and warnings without asking for a hash. Approval covers only the selected phases, their disclosed prerequisites, and listed pinned downloads. Tool installation, unrelated cleanup, and persistent-volume removal retain separate authorization requirements.

Complete planning when schema/file checks pass, Markdown and JSON agree, mutation/environment evidence is present, commands and bounds are visible, and approval covers the selected phases. Every remote campaign requires approved, implemented health/error/resource/side-effect abort conditions independently of optional performance SLOs.
