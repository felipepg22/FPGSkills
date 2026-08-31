# FPG AGENTS.md Writer

FPG AGENTS.md Writer researches a repository before it proposes, creates, or
updates `AGENTS.md` files and task-routed supporting guidelines. It preserves
existing guidance, requires approval before writing, and keeps each new or
rewritten `AGENTS.md` within 100 lines.

## Install

Node.js 22.20.0 or newer is required. Inspect the tagged repository first:

```sh
npx skills add felipepg22/FPGSkills#v0.2.0 --list
```

Install the skill into a project for an explicitly selected agent:

```sh
npx skills add felipepg22/FPGSkills#v0.2.0 \
  --skill fpg-agents-md-writer \
  --agent codex
```

Project installation is the default; commit `skills-lock.json`. Add `--global`
for user-level scope or `--copy` for a cross-platform copy instead of shared
symlinks. Replace `codex` with any supported agent identifier; multiple agents
may follow `--agent`. `--all` installs all three
repository skills into every supported agent and skips confirmation, so use it
only when that broad scope is intentional.

`npx` is canonical. `bunx skills ...` is supported only where repository
compatibility checks verify it. Adopt fixes by changing the repository tag to a
newer release, reviewing it, and reinstalling.

If version `0.1.0` was installed with the published npm installer, remove that
managed copy before using skills.sh; see the [migration guide](../../docs/migrating-to-skills-sh.md).

## Use

Ask the agent to use `fpg-agents-md-writer` when you want to audit, create,
update, or reorganize repository agent instructions. In write mode, it
researches first, presents one evidence-backed proposal, and waits for approval
before changing files.
