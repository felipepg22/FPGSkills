# gRPC generation

Read this file only for gRPC endpoints and protocol-level journeys.

## Load service definitions

Prefer repository `.proto` sources with explicit import paths. Next prefer a repository-owned serialized protoset. Use server reflection only when the approved local server exposes it and the plan records that choice. Authenticated reflection may need separate reflection metadata.

Copy `assets/k6/grpc-unary.js` for unary RPCs or `assets/k6/grpc-stream.js` for server, client, or bidirectional streaming. Import `assets/k6/lib/reporter.js` locally.

Construct ProtoJSON-compatible payloads from fixtures, examples, generated clients, and existing tests. Preserve protobuf scalar mapping, oneof selection, enums, bytes, timestamps, and required business invariants. Ask for safe inputs when evidence is insufficient.

## Prove read-only semantics

RPC names such as `Get`, `List`, or `Watch` are not proof. Trace the server implementation and tests. Exclude RPCs that persist, enqueue, publish, acknowledge, mutate cache state with business impact, or call writable remote dependencies. Client- and bidirectional-streaming remain supported only when a real repository method is proven read-only.

## Configure connection and authentication

Use `host:port` without a URL scheme. Infer plaintext versus TLS from local server configuration. Keep certificates, keys, passwords, bearer tokens, and metadata values in environment variables or approved local files; record names and paths, never values.

Use stable tags for `case`, `operation`, `rpc_type`, and `scenario`. Validate gRPC status and response invariants for unary calls and every applicable received message.

## Define streaming time

Offer and name each applicable measurement precisely:

- Whole-stream duration: stream creation until end.
- Time to first message: stream creation until first data event.
- Inter-message gap: time between consecutive received messages.
- Cumulative arrival latency: each message arrival measured from stream creation.
- Per-message round-trip time: only when correlation identifiers or guaranteed ordering make a request/response pair valid.

k6 does not provide built-in latency Trends for every streaming semantic. Create custom `Trend` metrics and report mean, median/p50, p95, and p99 for each selected definition. Never label arrival latency as round-trip time.

Every stream needs an approved completion condition: server completion, message count, maximum duration, or a combination. Add a hard safety timeout and close the client in success and failure paths.

## Validate

Run one VU and one iteration. Confirm schema loading, connection mode, metadata, message encoding, checks, custom Trends, completion, and cleanup. Quarantine a failing method; abort the campaign for shared schema, reflection, authentication, health, or locality failure.

