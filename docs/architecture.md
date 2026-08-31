# Architecture

FPGSkills is organized by artifact type. Each directory under `skills/` is a
lean, canonical runtime payload that skills.sh can install directly. Development
tests and evaluations live outside those payloads. Task Executor remains a
separately packaged agent because it is not a skill.

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

skills.sh is the primary distribution path for skills. Tagged repository
releases provide the reproducible source identity, project scope is the default,
and `skills-lock.json` records project installations. Users explicitly select
agents; skills.sh handles each agent's destination. Shared symlinks are preferred
and copy installation is the cross-platform fallback.

The three `@fpgskills/*` skill installers published at `0.1.0` are frozen legacy
distribution. They remain available for existing users but receive no fixes.
Task Executor's native adapters and installer continue independently.

Platform permissions and isolation remain host-controlled. The installer never grants permissions, and Task Executor never attempts to increase its own permissions.

Skills keep one canonical `SKILL.md` body plus task-loaded references, assets,
and scripts. Installation itself does not execute runtime scripts or write test
artifacts into target repositories.

Performance Testing follows the same distribution model but has a broader runtime asset set: k6 templates, cross-platform monitoring helpers, deterministic plan/report scripts, and an optional pinned local Grafana/Prometheus stack. The installed skill creates target-repository artifacts only while handling an approved performance-testing request. Those artifacts live under `docs/performance-tests/`; raw run data remains separate from versionable tests, plans, and retained reports.
