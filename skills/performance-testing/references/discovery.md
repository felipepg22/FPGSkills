# Repository discovery and case inference

Complete discovery before asking the user for facts the repository can provide.

## Establish the boundary

- Offer exactly three target scopes: one endpoint/RPC, one protocol-level user journey, or the whole application.
- Support REST/HTTP and gRPC in version 1. Defer GraphQL to version 2; treat browser rendering, mobile, desktop, queues, production, remote targets, security tests, and code-level microbenchmarks as out of scope.
- Interpret a user journey as a correlated sequence of read-only HTTP requests or RPCs with authentication, extracted values, checks, and optional think time. Browser clicks and browser-experience metrics belong elsewhere.

## Inspect evidence

Search efficiently and follow repository instructions. Inspect, in descending authority:

1. Existing performance, integration, contract, and end-to-end tests.
2. OpenAPI documents, route registrations, API clients, protobuf services, generated descriptors, and gRPC reflection configuration.
3. Controllers, handlers, service boundaries, frontend API calls, and domain workflows.
4. Fixtures, seed data, local authentication setup, examples, and sanitized environment templates.
5. Local startup scripts, Compose files, health checks, telemetry configuration, and dependency endpoints.
6. Documentation and comments that remain consistent with executable configuration.

Do not read secret values or send them into context. Record environment-variable names only.

## Infer cases

For every candidate, record:

- Stable case identifier and protocol.
- Endpoint, RPC, or ordered journey steps.
- Repository evidence with file paths and symbols.
- Read-only evidence and confidence.
- Required authentication reference and safe test data.
- Expected functional checks.
- Candidate workload scenarios and rationale.
- Measurements supported by existing instrumentation.
- Unknowns that prevent safe generation or execution.

Exclude candidates with mutation evidence or ambiguous side effects. Keep excluded candidates visible outside the executable matrix with the evidence and reason.

For whole-application scope, propose roughly five to ten cases ranked by business criticality, observed usage in tests/clients, fan-out, data intensity, and dependency sensitivity. Prefer a representative portfolio over exhaustive route enumeration.

## Ask one missing-information round

Do not repeat facts already supplied in the conversation. Ask together for only missing decisions:

- Exact target scope and target.
- Measurement groups: response behavior; host resources; application runtime; dependencies.
- Report selections: Markdown, k6 local dashboard/HTML, complete self-hosted Grafana, or any combination.
- Workload intent: concurrent users or requests/RPCs per second, duration, data volume, and quick or standard mode.
- Optional SLOs. Make clear that omission produces a baseline with no verdict.
- Authentication environment-variable names and safe existing test data.
- Streaming timing and termination semantics when gRPC streaming applies.

Complete discovery when every selected and excluded case has evidence, the local application boundary is understood, missing decisions have answers, and no candidate silently depends on mutation or a remote writable service.
