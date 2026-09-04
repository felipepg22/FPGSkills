# REST and HTTP generation

Read this file only for REST/HTTP endpoints and protocol-level journeys.

## Select a template

- Copy `assets/k6/http-endpoint.js` for one endpoint.
- Copy `assets/k6/http-journey.js` for an ordered multi-request journey.
- Import the bundled `assets/k6/lib/reporter.js` into the generated test directory; do not use remote JavaScript imports.

Adapt the copied file rather than generating an unrelated structure. Keep target addresses, tokens, and test data in environment variables or local non-secret fixture files.

## Prove safe behavior

Trace each candidate through route registration, handler, service, and tests. GET, HEAD, and OPTIONS are not proof of read-only behavior. Disclose writes, audits, queueing, cache effects, and remote dependencies under the plan-and-safety contract; include requested bounded mutations for approval.

For journeys, account for every step's effects. Adapt the GET example to the requested methods, bodies, correlations, and checks. Keep the execution guard before each request and disable redirects. Do not silently drop mutating steps.

## Build meaningful checks

Before load, validate status, content type, required response shape, domain invariant, and correlation values. A 2xx response alone is insufficient.

Tag every request with stable `case`, `operation`, and `scenario` names so reports expose per-operation and per-scenario metrics. Keep dynamic identifiers out of tag values to avoid cardinality explosions.

Use repository fixtures, seeds, examples, or existing integration-test values. Disclose needed mutating setup as an approvable bounded phase before calling it.

Reference credentials by environment-variable name. Redact authorization, cookies, and sensitive query values from console output and summaries.

For correlation, extract only required response values, assert they exist, and pass them to later approved steps. Add realistic think time only when supplied or approved in the workload plan.

## Validate

Run a one-VU, one-iteration smoke only when that phase is approved. Confirm checks, operation tags, metrics, and observed effects match the plan. A failing case is quarantined; shared authentication, health, or environment failure aborts the campaign.
