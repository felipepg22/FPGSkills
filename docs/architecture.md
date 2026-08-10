# Architecture

FPGSkills is an npm-workspace monorepo organized by artifact type. Each artifact owns its canonical behavior, installer surface, documentation, and evaluations. Task Executor and FPG AGENTS.md Writer intentionally retain independent installers in their first releases; shared tooling belongs in `packages/` only after their implementations demonstrate a stable common boundary.

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

Skills keep one canonical `SKILL.md` body plus task-loaded references. Their installers copy that canonical directory to platform-specific skill locations; they do not create symlinks or install runtime helpers into target repositories.
