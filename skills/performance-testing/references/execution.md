# Cross-platform execution

Execute only phases selected through [authorization.md](authorization.md) and keep raw output out of the coordinating context.

## Preflight

1. Resolve `PERFORMANCE_TESTING_SKILL_ROOT` to the installed skill directory. Re-run `scripts/validate-plan.mjs` with JSON and Markdown paths and `scripts/authorize-plan.mjs` with the authorization and fresh request records. Verify every executable hash and bind exact approved values. Supply the internally computed fingerprint through `COMPUTED_PLAN_FINGERPRINT`; secrets remain declared ambient references.
2. Confirm revision, dirty state, configuration, identity, target/resolved destinations, dependencies, preconditions, accumulated data, and tools still match. Remote probes require an already approved preflight phase.
3. Run `k6 version`. Use an approved installed binary or pinned local container; do not install or silently substitute versions.
4. Create the approved `.artifacts/<run-id>/` directory and verify secret values are absent from generated files.
5. Start only listed local services and confirm health before smoke testing. Pull only exact version-or-digest images listed in the approved `downloads`; an absent unlisted prerequisite blocks execution.

For the k6 dashboard, use the approved local bind address and self-contained HTML export. For complete Grafana, verify a functional Docker-compatible daemon with a read-only version/info command, render the templates under `assets/grafana/` with approved image versions or digests, and smoke-test Prometheus remote write before the campaign.

## Delegate execution

Give each executor only:

- Plan path, authorization and request records, selected phase IDs, and internal fingerprint.
- Assigned case or campaign.
- Generated test and artifact paths.
- Exact command plus its one-to-one phase binding entry; secret environment-variable names remain unresolved.
- Safety-stop and cleanup contract.
- Required compact return schema.

For a small campaign, one sub-agent runs all cases sequentially. For whole-application scope, use one sub-agent per case but schedule measured runs sequentially; concurrent executor processes would contaminate local measurements. A composite workload remains one deliberately concurrent scenario.

Executors write stdout, stderr, raw JSON, monitoring samples, and status to files. They return only case status, timestamps, command exit state, artifact paths, smoke result, safety-stop state, and a compact metric summary.

When delegation is unavailable, execute the same approved commands in the parent agent. Preserve the same file-first output contract and warn that context preservation is reduced.

## Support operating systems

- Use the POSIX collector template for macOS and Linux after adapting supported commands.
- Use the PowerShell collector template for native Windows.
- Record process CPU as interval CPU time divided by interval elapsed time on every platform; values may exceed 100% for multithreaded work. Record the effective sampling resolution—the macOS/Linux collector may be whole-second quantized—and label any provider-specific semantic difference before comparing platforms.
- Use container metrics when the target is containerized and the approved daemon exposes them.
- Record unavailable measurements as instrumentation gaps; do not install exporters automatically.

The k6 test itself must remain platform-neutral. Use normalized relative paths, avoid shell-specific syntax inside JavaScript, and mount every referenced script, module, fixture, proto, certificate, and results directory when k6 runs in a container.

## Handle failures and cleanup

Quarantine a case whose functional smoke test fails. Continue independent whole-application cases, but mark coverage incomplete. Abort the campaign for shared setup, application health, authentication, schema, locality, or safety-stop failures.

Stop workflow-owned services through their disclosed lifecycle. Attempt separately approved business cleanup even after failures, within its original bounds; otherwise report retained residue. Stop/remove temporary Grafana/Prometheus containers and network while preserving volumes. Removing volumes, changing unrelated services, or deleting user artifacts requires separate approval.
