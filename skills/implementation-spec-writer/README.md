# Implementation Spec Writer

Creates or updates one self-contained Markdown implementation specification from a conversation, documents, source files, and selectively inspected repository evidence.

Invoke the installed skill explicitly as `$implementation-spec-writer`. It writes the specification only; task publication and code implementation remain separate workflows.

## Install

Node.js 22.20.0 or newer is required. Inspect the tagged source, then install
the skill into a project for the agents that should use it:

```bash
npx skills add felipepg22/FPGSkills#v0.2.0 --list
npx skills add felipepg22/FPGSkills#v0.2.0 \
  --skill implementation-spec-writer \
  --agent codex
```

Replace `codex` with any supported agent identifier. Project installation is the default; commit `skills-lock.json`. Add `--global`
for user-level scope or `--copy` for the guaranteed cross-platform alternative
to shared symlinks. `npx` is canonical; use `bunx skills ...` only where
repository checks verify it. Install a newer tagged release to adopt fixes.

The published `@fpgskills/implementation-spec-writer@0.1.0` installer is frozen.
Remove its managed installation before switching; do not mix its
`.fpgskills/manifest.json` ownership with `skills-lock.json`. See the
[migration guide](../../docs/migrating-to-skills-sh.md).
