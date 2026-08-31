# Contributing

FPGSkills keeps behavioral rules in canonical sources and generates native platform files from them.

For Task Executor:

1. Edit `agents/task-executor/core/prompt.md` or `agents/task-executor/agent.json`.
2. Run `npm run generate`.
3. Review every changed adapter.
4. Run `npm test` and `npm run validate`.
5. Run the relevant manual smoke evaluations in `agents/task-executor/evals/README.md` when behavior changes.

Do not edit generated adapters directly. Keep changes scoped, preserve platform-rule precedence, and update documentation when installation behavior changes.

For FPG AGENTS.md Writer, edit `skills/fpg-agents-md-writer/SKILL.md` and its
`references/` files directly. Its evaluation cases live in
`evals/fpg-agents-md-writer/`, outside the installable payload.

For Implementation Spec Writer, edit
`skills/implementation-spec-writer/SKILL.md` and its `references/` files
directly.

For Performance Testing, edit `skills/performance-testing/SKILL.md`, its
task-loaded `references/`, reusable `assets/`, and deterministic `scripts/`
directly. Keep generated test artifacts under the target repository's
`docs/performance-tests/` directory, preserve the explicit plan-approval gate,
and do not weaken the local-only or mutation-exclusion rules. Use the cases in
`evals/performance-testing/` when behavior changes.

Every directory directly under `skills/` is the payload users install. Keep
development-only source, tests, package configuration, and evaluations outside
those directories. Before submitting a skill change, run:

```sh
node scripts/validate-skill-payload.mjs
node scripts/smoke-skills-install.mjs copy
```

The payload validator rejects development-only entries and agent-specific
installation paths. The smoke test uses the repository's pinned skills CLI,
installs all three payloads for every supported agent in a temporary directory,
and verifies their contents. On Linux and macOS, also run
`node scripts/smoke-skills-install.mjs symlink`. Hosted CI runs the required
cross-platform matrix; `SKILLS_RUNNER=bunx` selects the verified bunx path.
