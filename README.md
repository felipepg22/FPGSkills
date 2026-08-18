<div align="center">
  <img src="assets/fpgskills-ai-collaboration.png" alt="FPGSkills collaborators working with AI assistants over coffee" width="900" />

  <h1>FPGSkills</h1>

  <p>
    <img src="https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 22+" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5.9" />
    <img src="https://img.shields.io/badge/npm-workspaces-CB3837?logo=npm&logoColor=white" alt="npm workspaces" />
    <img src="https://img.shields.io/badge/k6-performance_testing-7D64FF?logo=k6&logoColor=white" alt="k6 performance testing" />
  </p>
</div>

FPGSkills is a growing catalog of portable agents and skills for AI coding tools.

The catalog currently includes:

- [Task Executor](./agents/task-executor/README.md), a manually invoked leaf subagent that executes one well-specified implementation task in a fresh context.
- [FPG AGENTS.md Writer](./skills/fpg-agents-md-writer/SKILL.md), an evidence-driven skill that audits, proposes, creates, and reorganizes concise repository instructions with task-routed supporting guidelines.
- [Implementation Spec Writer](./skills/implementation-spec-writer/SKILL.md), a user-invoked skill that creates self-contained, agent-ready code implementation specifications from conversations and source material.
- [Performance Testing](./skills/performance-testing/SKILL.md), a model-invoked skill that plans, generates, safely executes, analyzes, and reports local k6 tests for REST/HTTP and gRPC applications.

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

Install Performance Testing with its guided installer:

```sh
npx @fpgskills/performance-testing
```

The skill discovers evidence-backed read-only test cases, writes an approval-bound plan, and uses free local tooling to report results as Markdown, a k6 dashboard, self-hosted Grafana, or a selected combination. See the [Performance Testing guide](./skills/performance-testing/README.md) for its supported protocols and safety boundaries.

The packages are publish-ready but are not yet available from the npm registry.

## Repository layout

```text
agents/                 Reusable subagents
  task-executor/        Canonical prompt, adapters, installer, and evaluations
skills/                 Reusable skills and their installers
  fpg-agents-md-writer/ Canonical skill, references, installer, and evaluations
  implementation-spec-writer/ Canonical skill, references, and installer
  performance-testing/ Canonical skill, test assets, references, installer, and evaluations
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
