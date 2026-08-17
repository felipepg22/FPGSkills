---
name: performance-testing
description: Plan, generate, execute, analyze, and report local k6 performance tests for REST/HTTP and gRPC endpoints, protocol-level user journeys, or representative whole applications. Use for load, stress, spike, soak, scalability, latency, throughput, service-performance, and requests that require locality or mutation safety assessment. Refuse GraphQL, browser-experience testing, production or remote execution, microbenchmarks, profiling-only work, security testing, and mutating operations.
---

# Performance Testing

Produce evidence-backed local performance tests without inventing traffic, SLOs, safety, or causality.

## Enforce the contract

- Run only against loopback addresses or repository-proven services on the local container network. Inspect effective application configuration and refuse execution when writable remote dependencies exist or cannot be ruled out.
- Exclude every operation or journey that mutates business data. Authentication may create an expiring local session when it uses a test identity and does not mutate business data.
- Generate and structurally validate the executable tests first. Hash them into the complete test plan, compute the plan fingerprint, and execute only after the user explicitly approves that fingerprint. Recompute and request approval after any material plan or executable change.
- Prefer execution in sub-agents so raw output does not consume the coordinating context. Use the parent agent only when delegation is unavailable.
- Use only user-supplied SLOs from the conversation. Without one, report a baseline and no pass/fail verdict.
- Keep secrets in environment-variable references. Never place secret values in plans, prompts, tests, logs, or reports.
- Do not install k6, container runtimes, exporters, or reporting services automatically.

## Run the workflow

1. Read [references/discovery.md](references/discovery.md) completely. Inspect the repository, infer supported cases, and ask one compact intake round containing only decisions not already answered.
2. Read [references/plan-and-safety.md](references/plan-and-safety.md), [references/plan-schema.md](references/plan-schema.md), [references/workloads.md](references/workloads.md), [references/execution.md](references/execution.md), [references/reporting.md](references/reporting.md), and [references/run-schema.md](references/run-schema.md) completely. Read [references/rest.md](references/rest.md) for REST/HTTP or [references/grpc.md](references/grpc.md) for gRPC.
3. Copy the closest template from `assets/k6/`, adapt it to repository evidence, and structurally validate every generated executable. Keep generated files under `docs/performance-tests/` unless the repository already has an approved convention.
4. Create the canonical plan JSON and deterministic Markdown rendering under `docs/performance-tests/plans/`. Include SHA-256 hashes for every generated executable. Use `scripts/validate-plan.mjs` to validate and fingerprint the JSON.
5. Present the case matrix, excluded operations, executable hashes, exact commands, downloads, workload, measurements, reports, cleanup, and fingerprint. Stop until the user replies with unambiguous approval tied to that fingerprint.
6. Revalidate the plan and executable hashes, then validate locality and prerequisites. Run a one-user functional smoke test for each case. Quarantine failed cases; abort the campaign when shared setup, authentication, health, or locality fails.
7. Execute the approved campaign. Run isolated scenarios sequentially. Add a composite whole-application scenario only when the user approved traffic weights. Write raw output to `.artifacts/` and return compact summaries from executors.
8. Produce canonical JSON plus every selected report. Read [references/bottlenecks.md](references/bottlenecks.md), analyze relevant code paths, and distinguish observations, correlations, hypotheses, and confirmed causes. Stop locally started services, including Grafana and Prometheus, while preserving data volumes; remove volumes only after separate destructive-action approval.

## Complete the task

Finish only when every approved case is accounted for, generated tests pass structural validation, smoke and measured runs have explicit outcomes, selected reports exist, possible bottlenecks include evidence and a next experiment, cleanup has run, and blockers or incomplete coverage are plainly identified.
