# Repository instructions

## Scope

Apply these instructions across the repository. FPGSkills contains portable agent
definitions and directly installable skill payloads; keep behavior in canonical
sources and distribution artifacts reproducible.

## Essential workflow

- Use Node.js 22.20.0 or newer and install dependencies with `npm install`.
- Keep changes scoped and preserve platform and host permission precedence.
- Use the root scripts as the canonical checks:
  - `npm run generate` regenerates Task Executor adapters.
  - `npm test` builds workspaces and runs repository tests.
  - `npm run validate` checks generated adapters and skill payloads.
  - `npm run pack:check` verifies the Task Executor package contents.
- Run focused checks while iterating, then run all checks relevant to the changed
  artifact before completion. Documentation-only changes need only focused checks.

## Repository boundaries

- Treat every directory directly under `skills/` as an installable runtime payload.
  Keep tests, evaluations, package configuration, and other development-only files
  outside those directories. See `docs/architecture.md`.
- Put reusable agents under `agents/`, repository-wide guidance under `docs/`, and
  shared tooling under `packages/` only after it has a proven cross-artifact use.
- Do not add agent-specific installation paths to portable skill payloads.
- Update user-facing documentation when installation or distribution behavior
  changes.

## Route by task

### Task Executor

- Before changing Task Executor, read `agents/task-executor/README.md` and
  `CONTRIBUTING.md`.
- Edit `agents/task-executor/agent.json` for metadata and
  `agents/task-executor/core/prompt.md` for behavior. Do not edit generated files
  under `agents/task-executor/adapters/` directly.
- After canonical-source changes, run `npm run generate`, inspect every changed
  adapter, then run `npm test`, `npm run validate`, and `npm run pack:check`.
- When behavior changes, run the relevant manual scenarios documented in
  `agents/task-executor/evals/README.md`.

### Skills

- Edit a skill's `SKILL.md` and its task-loaded `references/`, reusable `assets/`,
  or deterministic `scripts/` directly. Keep the payload lean and self-contained.
- Put skill evaluation cases under `evals/<skill>/`, not inside the payload.
- When adding or removing a skill, update the expected catalog in
  `scripts/validate-skill-payload.mjs` and the repository documentation and CI
  catalog checks that enumerate skills.
- Before completing a skill change, run `node scripts/validate-skill-payload.mjs`
  and `node scripts/smoke-skills-install.mjs copy`. On Linux and macOS, also run
  `node scripts/smoke-skills-install.mjs symlink`.
- Before changing Performance Testing behavior, read its `SKILL.md` and the
  applicable files under `skills/performance-testing/references/`. Preserve its
  explicit plan-approval gate, disclosed mutation bounds, recovery requirements,
  and approved non-production scope.

### Releases

- Before release work, read `docs/releasing.md` and follow its ordered gates.
- Treat creating or pushing tags, dispatching catalog seeding, publishing packages,
  and changing npm deprecation metadata as separate external actions requiring
  explicit maintainer authorization.
- Never move or replace a published tag, and never unpublish legacy installers.

## Completion checks

- Review `git diff` for generated drift, unintended payload files, and unrelated
  changes.
- Confirm generated outputs match their canonical sources and committed tests cover
  behavior changes where practical.
- Report the checks run and any checks that could not be run.
