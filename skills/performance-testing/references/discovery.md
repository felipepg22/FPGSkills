# Repository discovery and case inference

Complete discovery before asking the user for facts the repository can provide.

## Establish the boundary

- Offer exactly three target scopes: one endpoint/RPC, one protocol-level user journey, or the whole application.
- Support REST/HTTP and gRPC; treat GraphQL, browser rendering, mobile, desktop, direct queue testing, production, security tests, and code-level microbenchmarks as out of scope. Remote non-production targets require explicit approval.
- Interpret a user journey as a correlated sequence of HTTP requests or RPCs with authentication, extracted values, checks, and optional think time. Include requested mutating steps with their effects disclosed. Browser clicks and browser-experience metrics belong elsewhere.

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
- Effect evidence and confidence, including mutations and maximum side effects.
- Required authentication reference and safe test data.
- Expected functional checks.
- Candidate workload scenarios and rationale.
- Measurements supported by existing instrumentation.
- Unknowns that prevent safe generation or execution.

Include all explicitly requested coverage, including mutations. Keep hard-prohibited or insufficiently bounded candidates visible as blocked/excluded with evidence and reason. Obtain missing decisions rather than silently truncating journeys.

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

Complete discovery when every selected and excluded case has evidence, application and dependency boundaries are understood, missing decisions have answers, and mutations and remote dependencies are disclosed.
