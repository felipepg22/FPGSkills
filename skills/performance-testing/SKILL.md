---
name: performance-testing
description: Plan, generate, execute, analyze, and report k6 performance tests for REST/HTTP and gRPC endpoints, journeys, or whole applications. Use for load, stress, spike, soak, scalability, latency, throughput, and service performance, including approved mutations and remote non-production targets. Excludes production, GraphQL, browser-experience tests, microbenchmarks, profiling-only work, and security testing.
---

# Performance Testing

Produce evidence-backed performance tests without inventing traffic, SLOs, safety, or causality.

At the start of the workflow, resolve `PERFORMANCE_TESTING_SKILL_ROOT` to the absolute directory containing this `SKILL.md`. Use that root for every bundled `assets/` and `scripts/` path. Never assume an agent-specific installation directory.

## Enforce the contract

- Include the performance coverage the user requested, including mutating operations and complete journeys. Disclose effects, per-execution bounds, recovery, and cleanup before approval.
- Allow verified local systems and explicitly approved remote non-production targets and dependencies. Use user attestation plus available evidence; contradictory production evidence blocks execution.
- Generate and structurally validate tests before natural-language approval of the whole plan or selected cases/phases. Keep fingerprints internal. Follow [references/authorization.md](references/authorization.md) for reusable approval, user-requested reruns, and revocation.
- Prefer execution in sub-agents so raw output does not consume the coordinating context. Use the parent agent only when delegation is unavailable.
- Use only user-supplied SLOs from the conversation. Without one, report a baseline and no pass/fail verdict.
- Keep secrets in environment-variable references. Never place secret values in plans, prompts, tests, logs, or reports.
- Do not install k6, container runtimes, exporters, or reporting services automatically.

## Run the workflow

1. Read [references/discovery.md](references/discovery.md) completely. Inspect the repository, infer supported cases, and ask one compact intake round containing only decisions not already answered.
2. Read [references/plan-and-safety.md](references/plan-and-safety.md), [references/plan-schema.md](references/plan-schema.md), [references/workloads.md](references/workloads.md), [references/execution.md](references/execution.md), [references/reporting.md](references/reporting.md), and [references/run-schema.md](references/run-schema.md) completely. Read [references/rest.md](references/rest.md) for REST/HTTP or [references/grpc.md](references/grpc.md) for gRPC.
3. Copy the closest template from `$PERFORMANCE_TESTING_SKILL_ROOT/assets/k6/`, adapt it to repository evidence, and structurally validate every generated executable. Keep generated files under `docs/performance-tests/` unless the repository already has an approved convention.
4. Create the canonical plan JSON and deterministic Markdown rendering under `docs/performance-tests/plans/`. Include SHA-256 hashes for every generated executable. Use `$PERFORMANCE_TESTING_SKILL_ROOT/scripts/validate-plan.mjs` to validate and fingerprint the JSON.
5. Present the human-readable plan, warnings, exact commands, workload, effects, downloads, and separately selectable smoke, measured-run, and cleanup phases. Obtain unambiguous approval of the selected scope; initial approval also triggers execution unless the user says otherwise. Never request a fingerprint or magic phrase.
6. Revalidate files and authorization, inspect current environment evidence and preconditions, then execute only selected phases through the authorization gate. Smoke is one user and one iteration. Quarantine failed cases; abort for shared setup, authentication, health, environment drift, or safety failure.
7. Execute the approved campaign. Run isolated scenarios sequentially. Add a composite whole-application scenario only when the user approved traffic weights. Write raw output to `.artifacts/` and return compact summaries from executors.
8. Produce canonical JSON plus every selected report. Read [references/bottlenecks.md](references/bottlenecks.md), analyze relevant code paths, and distinguish observations, correlations, hypotheses, and confirmed causes. Stop locally started services, including Grafana and Prometheus, while preserving data volumes; remove volumes only after separate destructive-action approval.

## Complete the task

Finish when every selected case/phase is accounted for, tests pass structural validation, selected reports exist, bottleneck hypotheses include evidence and a next experiment, approved cleanup has an outcome, and skipped phases, residue, blockers, and incomplete coverage are explicit.
