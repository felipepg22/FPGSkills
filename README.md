# FPGSkills

FPGSkills is a growing catalog of portable agents and skills for AI coding tools.

The first artifact is [Task Executor](./agents/task-executor/README.md), a manually invoked leaf subagent that executes one well-specified implementation task in a fresh context.

## Install with npx

Node.js 22 or newer is required. Once the package is published to npm, run the interactive installer with:

```sh
npx @fpgskills/task-executor install
```

For a non-interactive project installation, specify the target platform and project directory:

```sh
npx @fpgskills/task-executor install \
  --target codex \
  --scope local \
  --project /path/to/project
```

The installer supports Codex, OpenCode, Cursor, Claude Code, Antigravity, and Generic Markdown. See the [Task Executor installation guide](./agents/task-executor/README.md#install-with-the-optional-cli) for global installation, multiple targets, and model profiles.

The package is publish-ready but is not yet available from the npm registry.

## Repository layout

```text
agents/                 Reusable subagents
  task-executor/        Canonical prompt, adapters, installer, and evaluations
skills/                 Reserved for future skills
packages/               Reserved for shared tooling when a second artifact needs it
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
