# Architecture

FPGSkills is an npm-workspace monorepo organized by artifact type. Each agent owns its canonical behavior, generated adapters, installer surface, documentation, and evaluations. Shared tooling will be extracted into `packages/` only after a second artifact demonstrates a real reuse boundary.

## Canonical-to-adapter flow

```text
agent.json + core/prompt.md
            |
            v
       TypeScript generator
            |
            v
Codex | OpenCode | Cursor | Claude Code | Antigravity | Generic Markdown
```

Generated adapters are committed so users can install them manually without Node.js. Validation regenerates them in memory and reports drift.

## Distribution

Distribution is intentionally hybrid:

- Native agent/plugin packaging where a platform supports it.
- Committed adapter files for manual installation.
- A Node.js CLI with a small prompt runtime for guided local/global installation, model profiles, status, upgrades, and uninstall.

Platform permissions and isolation remain host-controlled. The installer never grants permissions, and Task Executor never attempts to increase its own permissions.
