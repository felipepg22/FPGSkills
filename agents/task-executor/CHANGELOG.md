# Changelog

## 1.1.0 — 2026-08-17

### Added

- Named model profiles can now set a reasoning effort with `--profile-effort <name=level>`.
- The interactive installer collects an optional reasoning effort for each model profile and includes it in its installation summary.
- Luna can be configured as `gpt-5.6-luna` with `max` effort, and Grok 4.6 with `high` effort.

### Changed

- Codex, OpenCode, and Cursor adapters render configured reasoning effort in their native profile configuration.
- Claude Code and Antigravity adapters continue to preserve the selected model without adding unsupported effort fields.
