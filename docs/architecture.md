# Architecture

FPGSkills is an npm-workspace monorepo organized by artifact type. Each artifact owns its canonical behavior, installer surface, documentation, and evaluations. Packages intentionally retain independent installers in their first releases; shared tooling belongs in `packages/` only after their implementations demonstrate a stable common boundary.

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

Skills keep one canonical `SKILL.md` body plus task-loaded references. Their installers copy the canonical files and any skill-owned helpers or templates to platform-specific skill locations; they do not create symlinks or write test artifacts into target repositories during installation.

Performance Testing follows the same distribution model but has a broader runtime asset set: k6 templates, cross-platform monitoring helpers, deterministic plan/report scripts, and an optional pinned local Grafana/Prometheus stack. The installed skill creates target-repository artifacts only while handling an approved performance-testing request. Those artifacts live under `docs/performance-tests/`; raw run data remains separate from versionable tests, plans, and retained reports.
