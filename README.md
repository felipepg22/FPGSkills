<div align="center">
  <img src="assets/fpgskills-ai-collaboration.png" alt="FPGSkills collaborators working with AI assistants over coffee" width="900" />

  <h1>FPGSkills</h1>

  <p>
    <img src="https://img.shields.io/badge/Node.js-22.20.0%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 22.20.0+" />
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

## Install the skills

[skills.sh](https://skills.sh/) is the primary installer for the three skills in this repository. Node.js 22.20.0 or newer is required. First inspect the tagged source and the skills it exposes:

```sh
npx skills add felipepg22/FPGSkills#v0.2.0 --list
```

Then install one or more skills into a project, naming each agent that should use them:

```sh
npx skills add felipepg22/FPGSkills#v0.2.0 \
  --skill fpg-agents-md-writer implementation-spec-writer performance-testing \
  --agent codex
```

Project scope is the default and is recommended for reproducible team setup. Commit the generated `skills-lock.json`. Add `--global` for a user-level installation. The installer normally creates shared symlinks; add `--copy` when symlinks are unavailable or undesirable. Copy installation is the guaranteed cross-platform path, including Windows.

Replace `codex` with your agent identifier or add more values after `--agent` to target multiple agents. The CLI supports every agent listed by `npx skills add --help`. `--all` is an explicit power-user option: it installs every discovered skill into every supported agent and skips confirmation. It is not the recommended default.

`npx` is the canonical runner. `bunx skills ...` is an alternative only on platforms covered by the repository compatibility checks. Review the tagged source before approving an interactive installation; reserve `-y` for reviewed automation. Release verification and CI pin the CLI version even though human-facing commands track the current CLI.

To upgrade, deliberately replace `v0.2.0` with the newer release tag and review the changes before installing. Do not silently track the default branch.

Task Executor is an agent, not a skill, and retains its [separate installer and installation guide](./agents/task-executor/README.md#install-with-the-optional-cli).

The former `@fpgskills/fpg-agents-md-writer`, `@fpgskills/implementation-spec-writer`, and `@fpgskills/performance-testing` npm installers were published at `0.1.0`. They are frozen; new fixes are released only through newer repository tags for skills.sh. Existing users should follow the [migration guide](./docs/migrating-to-skills-sh.md) rather than mixing installer ownership models.

## Repository layout

```text
agents/                 Reusable subagents
  task-executor/        Canonical prompt, adapters, installer, and evaluations
skills/                 Lean, directly installable skill payloads
  fpg-agents-md-writer/ Canonical skill and runtime references
  implementation-spec-writer/ Canonical skill and runtime references
  performance-testing/ Canonical skill, runtime assets, references, and scripts
packages/               Reserved for proven shared tooling
docs/                   Repository-wide architecture and contribution guidance
```

## Development

Node.js 22.20.0 or newer is required for repository tooling.

```sh
npm install
npm run generate
npm test
npm run validate
npm run pack:check
```

See the [release guide](./docs/releasing.md) for the cross-platform compatibility gates and the documented `v0.2.0` release procedure.
