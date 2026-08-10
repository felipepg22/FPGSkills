# FPGSkills

FPGSkills is a growing catalog of portable agents and skills for AI coding tools.

The catalog currently includes:

- [Task Executor](./agents/task-executor/README.md), a manually invoked leaf subagent that executes one well-specified implementation task in a fresh context.
- [FPG AGENTS.md Writer](./skills/fpg-agents-md-writer/SKILL.md), an evidence-driven skill that audits, proposes, creates, and reorganizes concise repository instructions with task-routed supporting guidelines.

## Install with npx

Node.js 22 or newer is required. Once the package is published to npm, run the guided interactive installer with:

```sh
npx @fpgskills/task-executor
```

For a non-interactive project installation, specify the target platform and project directory:

```sh
npx @fpgskills/task-executor install \
  --target codex \
  --scope local \
  --project /path/to/project
```

The installer supports Codex, OpenCode, Cursor, Claude Code, Antigravity, and Generic Markdown. See the [Task Executor installation guide](./agents/task-executor/README.md#install-with-the-optional-cli) for global installation, multiple targets, and model profiles.

Install FPG AGENTS.md Writer with its guided installer:

```sh
npx @fpgskills/fpg-agents-md-writer
```

For a non-interactive project installation:

```sh
npx @fpgskills/fpg-agents-md-writer install \
  --target codex \
  --scope local \
  --project /path/to/project
```

Its installer supports the same six targets, project or global scope, managed upgrades, status, and safe uninstall. Multi-target installation keeps successful targets and reports each failed destination with a non-zero exit status.

The packages are publish-ready but are not yet available from the npm registry.

## Repository layout

```text
agents/                 Reusable subagents
  task-executor/        Canonical prompt, adapters, installer, and evaluations
skills/                 Reusable skills and their installers
  fpg-agents-md-writer/ Canonical skill, references, installer, and evaluations
packages/               Reserved for proven shared tooling
docs/                   Repository-wide architecture and contribution guidance
```

## Development

Node.js 22 or newer is required for the optional CLI and repository tooling.

```sh
npm install
npm run generate
npm test
npm run validate
npm run pack:check
```

This repository does not publish packages or run hosted CI in v1.
