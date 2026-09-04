# Performance Testing approval revision

Source: decisions agreed in the September 3–4, 2026 grilling conversation; implementation requested on a new branch.

- Include all requested performance coverage, including complete mutating HTTP/gRPC journeys. Keep other protocol exclusions.
- Every campaign requires initial ordinary-language approval of the whole plan or selected cases/phases. Acknowledge remote, mutation, existing-data, and external-effect warnings. No fingerprint or exact phrase is required.
- Initial approval triggers execution unless withheld. Unlimited subsequent executions require fresh user rerun requests. Approval persists across sessions, has no run-count limit or expiry, and can be revoked.
- Internally retain full provenance fingerprint and execution safety digest; persist normalized approval sidecar. Reporting-only metadata changes do not invalidate execution authorization. Execution and environment drift require reapproval. Recheck preconditions/capacity/data residue each run.
- Permit remote non-production targets/dependencies with explicit user environment/authority attestation and corroboration where available. Production contradictions block. Remote probes require prior approval; remote runs need independent safety stops, and remote mutations require dedicated identities.
- Permit disclosed bounded mutations of run-owned or pre-existing data. Existing-data destructive work needs verified disposable fixtures or backup/snapshot and accessible recovery. Warn before approval.
- Disclose effects, resources, evidence, data ownership, maximum requests/records/concurrency/duration/retries, external destinations/counts, recovery, setup, cleanup, and residue. Enforce per-invocation bounds where technically possible; cumulative user-requested reruns are unlimited.
- Prohibit production, unknown/unbounded writes, destructive schema operations, irreversible deletion without recovery evidence, billable third-party effects, and unidentified targets/dependencies.
- Smoke, measured execution, and business cleanup are independently selectable. Disclosed setup prerequisites belong to selected phases; cleanup is proposed by default but never implicitly authorized by mutation approval. Attempt approved cleanup after failure within original scope. Report skipped phases and residue.
- Version the richer plan schema; preserve validation compatibility for old read-only plans. Update validators, templates, references, tests, and evaluations. Do not install tooling or launch real performance campaigns as part of this implementation.

Confirmed test seams: plan validator, authorization validation, generated-test runtime boundaries. Review against branch base `1a73a678e6d28c17f65d52df2a2a5ebfd2159fa1` and this specification.
