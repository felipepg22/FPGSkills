# Performance Testing

Performance Testing plans, generates, executes, analyzes, and reports local REST/HTTP and gRPC performance tests with free local tooling. It can target an endpoint, a protocol-level user journey, or a risk-ranked representative slice of an application.

The skill inspects repository evidence before proposing cases, excludes mutating operations and journeys, generates and hashes the executable tests, and then writes an execution plan under `docs/performance-tests/`. No smoke or load run starts until the user explicitly approves that plan and its fingerprint. Execution uses subagents when available and falls back to the parent agent when delegation is unavailable.

## Install

Node.js 22 or newer is required for the optional installer. Run it interactively:

```sh
npx @fpgskills/performance-testing
```

The installer supports Codex, OpenCode, Cursor, Claude Code, Antigravity, and Generic Markdown. Run `npx @fpgskills/performance-testing --help` for non-interactive options.

After installation, ask your agent to performance-test a local REST/HTTP or gRPC application. The skill gathers missing workload and measurement choices, proposes evidence-backed cases, and pauses for plan approval before it runs k6.

## Scope and output

Version 1 supports REST/HTTP and unary, server-streaming, client-streaming, and bidirectional gRPC. GraphQL is deferred to version 2. The skill does not run against remote or production targets, and it excludes browser-experience testing, security testing, microbenchmarks, profiling-only work, and mutating operations.

Execution and resource-collection guidance covers macOS, Linux, and Windows. The Windows adapter has contract tests and a manual native smoke procedure, but is documented as not natively verified until that procedure runs on Windows.

Every completed run retains structured JSON. The user may also select one or more human-facing outputs:

- A Markdown report
- The built-in k6 local dashboard with an HTML export
- A complete local Grafana OSS and Prometheus OSS reporting stack

Reports capture the workload and environment fingerprint along with duration, mean, p50 (median), p95, p99, throughput, error rate, sample counts, variability, and evidence-backed bottleneck hypotheses. The skill never invents an SLO; it applies one only when the user supplies it.

Generated target-repository files use this default layout unless the repository already has a clear convention:

```text
docs/performance-tests/
├── k6/
├── plans/
├── reports/
└── .artifacts/
```

The Grafana option reuses any working local Docker-compatible daemon, including Docker Desktop, Rancher Desktop, Podman, or another compatible provider. The test plan lists pinned images and downloads before approval. k6's Prometheus remote-write integration is experimental, so the skill must pass a local preflight and otherwise fall back to the selected Markdown or k6 dashboard output. The skill stops its Grafana stack after the campaign and does not delete persistent volumes.

The selected test/reporting components have no required cloud fee: k6 OSS and Grafana OSS use AGPL-3.0, while Prometheus uses Apache-2.0. A pre-existing container provider may have separate licensing or operational costs, so the skill verifies availability without installing it or inferring organizational license eligibility.

## Develop locally

```sh
npm test --workspace @fpgskills/performance-testing
npm run validate --workspace @fpgskills/performance-testing
npm pack --dry-run --workspace @fpgskills/performance-testing
```
