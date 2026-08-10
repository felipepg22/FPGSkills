# FPG AGENTS.md Writer

FPG AGENTS.md Writer researches a repository before it proposes, creates, or
updates `AGENTS.md` files and task-routed supporting guidelines. It preserves
existing guidance, requires approval before writing, and keeps each new or
rewritten `AGENTS.md` within 100 lines.

## Install

Node.js 22 or newer is required.

Run the guided installer:

```sh
npx @fpgskills/fpg-agents-md-writer
```

For a project-local Codex installation:

```sh
npx @fpgskills/fpg-agents-md-writer install \
  --target codex \
  --scope local \
  --project /path/to/project
```

The installer supports Codex, OpenCode, Cursor, Claude Code, Antigravity, and
Generic Markdown. Use `--scope global` for a user-level installation. Generic
Markdown requires `--output <directory>`.

## Use

Ask the agent to use `fpg-agents-md-writer` when you want to audit, create,
update, or reorganize repository agent instructions. In write mode, it
researches first, presents one evidence-backed proposal, and waits for approval
before changing files.

## Manage an installation

```sh
npx @fpgskills/fpg-agents-md-writer status --scope local
npx @fpgskills/fpg-agents-md-writer uninstall --scope local
```

The installer records owned files in `.fpgskills/manifest.json` and preserves
modified files during uninstall unless explicitly forced.
