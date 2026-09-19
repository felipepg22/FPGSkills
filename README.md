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
- [BDD Plan](./skills/bdd-plan/SKILL.md), a skill that creates behavior-driven implementation plans with a required post-implementation sub-agent verification task.
- [FPG AGENTS.md Writer](./skills/fpg-agents-md-writer/SKILL.md), an evidence-driven skill that audits, proposes, creates, and reorganizes concise repository instructions with task-routed supporting guidelines.
- [FPG Implement](./skills/fpg-implement/SKILL.md), a user-invoked skill that executes concrete tasks directly or through cost-aware, dependency-aware sub-agent orchestration.
- [Implementation Spec Writer](./skills/implementation-spec-writer/SKILL.md), a user-invoked skill that creates self-contained, agent-ready code implementation specifications from conversations and source material.
- [Performance Testing](./skills/performance-testing/SKILL.md), a model-invoked skill that plans, generates, safely executes, analyzes, and reports local k6 tests for REST/HTTP and gRPC applications.

## Install the skills

[skills.sh](https://skills.sh/) is the primary installer for the skills in this repository. Node.js 22.20.0 or newer is required.

```sh
npx skills add felipepg22/FPGSkills
```

The installer will guide you through choosing the skills and agents. Add `--global` for a user-level installation or `--copy` when symlinks are unavailable or undesirable.

Project scope is the default. Commit the generated `skills-lock.json` for reproducible team setup.

Task Executor is an agent, not a skill, and retains its [separate installer and installation guide](./agents/task-executor/README.md#install-with-the-optional-cli).

The former `@fpgskills/fpg-agents-md-writer`, `@fpgskills/implementation-spec-writer`, and `@fpgskills/performance-testing` npm installers were published at `0.1.0`. They are frozen; new fixes are released only through newer repository tags for skills.sh. Existing users should follow the [migration guide](./docs/migrating-to-skills-sh.md) rather than mixing installer ownership models.

## Repository layout

```text
agents/                 Reusable subagents
  task-executor/        Canonical prompt, adapters, installer, and evaluations
skills/                 Lean, directly installable skill payloads
  bdd-plan/             Behavior-driven implementation planning
  fpg-agents-md-writer/ Canonical skill and runtime references
  fpg-implement/        Adaptive execution and sub-agent orchestration
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
