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

- Schema version, plan identifier, application revision and dirty state, configuration profile, target scope, protocol, and local target evidence.
- Selected cases, their evidence, functional checks, test-data references, and `mutatesBusinessData: false`.
- Excluded operations and exclusion reasons outside the executable case list.
- Workload model, scenario type, stages, duration, concurrency or arrival rate, repetition mode, and composite weights if any.
- Measurements, report selections, optional conversation-supplied SLOs, and streaming timing semantics.
- Exact non-secret environment bindings, secret environment-variable names, generated executable paths and SHA-256 hashes, tool versions, local services, and exact non-empty startup, smoke, execution, reporting, and cleanup commands.
- Writable remote-dependency verification, downloads with exact versions or digests, artifact paths, safety stops, and expected side effects.
- Grafana integration risk when selected: k6 Prometheus remote write is experimental.

Generate the executable tests before approval. List and hash every local dependency in their complete closure, including imported helpers and referenced proto, protoset, fixture, data, and certificate files. Each smoke/run command must invoke exactly the `k6-entrypoint` mapped to its phase binding; never execute an unlisted alternate script. Use `node scripts/validate-plan.mjs <plan.json> --markdown <plan.md>` from the installed skill directory to validate the schema, verify the deterministic Markdown rendering, verify generated-file hashes and dependency closure, and compute `sha256:<digest>`. Place the returned fingerprint in the Markdown plan footer; do not add it to the JSON it hashes.

## Prove locality

Allow a loopback address or a repository-proven service on the local container network. Resolve the actual runtime target rather than trusting a label such as `test`.

Inspect effective database, cache, queue, object-store, webhook, email, analytics, and third-party endpoints. Refuse execution when any writable remote dependency exists or cannot be ruled out. Stubbed, emulated, or read-only external dependencies still require explicit evidence in the plan.

When complete self-hosted Grafana is selected, verify a functioning local Docker-compatible daemon with a read-only version/info command. The provider may be Docker Desktop, Rancher Desktop, Podman compatibility, or another local daemon. Do not infer license eligibility or install a runtime.

## Exclude mutation

Do not classify safety from HTTP verbs or RPC names alone. Require positive evidence from contracts, implementation, tests, or documentation. Exclude an entire journey if any business step mutates data.

Allow local authentication to create an expiring session or token only when it uses a test identity, has bounded cleanup or expiry, and cannot mutate business data.

## Gate execution

Present the Markdown plan and request the exact approval form `Approve plan <fingerprint>`. Generic affirmation does not authorize execution.

Any change to targets, cases, commands, downloads, workload, duration, measurements, SLOs, data, side effects, safety stops, or cleanup changes the JSON, changes the fingerprint, and requires new approval. Editorial Markdown-only changes do not.

Approval authorizes only listed commands and the exact version-or-digest image pulls listed in `downloads`. It does not authorize automatic tool installation, unlisted downloads, removal of persistent volumes, or previously excluded operations.

Immediately before smoke or measured execution, validate the plan again and rehash every generated executable. Any hash mismatch invalidates approval even when the JSON itself is unchanged.

Complete planning when the validator passes, the Markdown and JSON agree, locality and non-mutation have evidence, every command is visible, and the current fingerprint has explicit approval.
