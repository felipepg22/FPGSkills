# REST and HTTP generation

Read this file only for REST/HTTP endpoints and protocol-level journeys.

## Select a template

- Copy `assets/k6/http-endpoint.js` for one endpoint.
- Copy `assets/k6/http-journey.js` for an ordered multi-request journey.
- Import the bundled `assets/k6/lib/reporter.js` into the generated test directory; do not use remote JavaScript imports.

Adapt the copied file rather than generating an unrelated structure. Keep target addresses, tokens, and test data in environment variables or local non-secret fixture files.

## Prove safe behavior

Trace each candidate through route registration, handler, service, and tests. GET, HEAD, and OPTIONS are candidates, not proof. Exclude operations that update access time, enqueue work, invalidate caches with externally visible consequences, write audits beyond the approved authentication exception, or call writable remote dependencies.

For journeys, prove every step read-only. Do not drop a mutating step to make a journey appear safe.

## Build meaningful checks

Before load, validate status, content type, required response shape, domain invariant, and correlation values. A 2xx response alone is insufficient.

Tag every request with stable `case`, `operation`, and `scenario` names so reports expose per-operation and per-scenario metrics. Keep dynamic identifiers out of tag values to avoid cardinality explosions.

Use repository fixtures, seeds, examples, or existing integration-test values. When safe data cannot be found, ask the user rather than calling a mutating setup endpoint.

Reference credentials by environment-variable name. Redact authorization, cookies, and sensitive query values from console output and summaries.

For correlation, extract only required response values, assert they exist, and pass them to later read-only steps. Add realistic think time only when supplied or approved in the workload plan.

## Validate

Run a one-VU, one-iteration smoke test against the approved local target. Confirm all checks pass, operation tags appear, expected metrics exist, and no unapproved business writes or writable remote calls occurred. The bounded local authentication-session exception remains allowed. A failing case is quarantined; shared authentication, health, or locality failure aborts the campaign.
