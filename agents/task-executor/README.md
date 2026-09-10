# Task Executor

Task Executor is a manually invoked leaf subagent for implementing one coherent task that has already been planned and specified. Its companion caller skill selects a cheap model and sends a focused handoff. The leaf reads the authoritative task and relevant code, implements within scope, and reviews every acceptance condition. Fresh context is requested when the host supports it.

It is designed to work well with lower-cost models when the task source contains the necessary planning and decisions.

## Supported targets

| Target | Project adapter | User adapter |
|---|---|---|
| Codex | `.codex/agents/task-executor.toml` | `~/.codex/agents/task-executor.toml` |
| OpenCode | `.opencode/agents/task-executor.md` | `~/.config/opencode/agents/task-executor.md` |
| Cursor | `.cursor/agents/task-executor.md` | `~/.cursor/agents/task-executor.md` |
| Claude Code | `.claude/agents/task-executor.md` | `~/.claude/agents/task-executor.md` |
| Antigravity | `.agents/agents/task-executor.md` | `~/.gemini/config/agents/task-executor.md` |
| Generic Markdown | Explicit user-selected output | Explicit user-selected output |

Pi is intentionally deferred to a later release because it requires a runtime extension rather than only a native agent definition.

## Install with the optional CLI

Node.js 22 or newer is required. From this repository:

```sh
npm install
npm run build
node agents/task-executor/dist/cli.js install --target codex --scope local
```

When published, the equivalent command will be:

```sh
npx @fpgskills/task-executor
```

In a terminal, the bare command opens a guided installer with keyboard-driven target selection, scope selection, optional model profiles, a destination summary, confirmation, and progress output. Detected agent directories are preselected. Ctrl+C or declining the final confirmation leaves the filesystem unchanged.

For scripted or CI use, supply all required arguments explicitly:

```sh
npx @fpgskills/task-executor install \
  --target codex,cursor \
  --scope local \
  --project /path/to/project \
  --policy ./task-executor-models.json
```

The bare command shows help instead of prompting when stdin or stdout is not a terminal. Explicitly supplied install arguments also bypass the wizard.

The base `task-executor` now selects an explicit cheap model. The installer also writes ranked alternatives and the `task-executor-routing` caller skill, including a target-specific `models.json`. The caller reads that skill before dispatch; model selection cannot be changed by instructions inside an already-running executor.

| Target | Initial suggestion | Assessed alternatives | Effort configuration |
|---|---|---|---|
| Codex | `gpt-5.6-luna`, `max` | Terra, Sol, Astra | Native field |
| OpenCode | `openai/gpt-5.6-luna`, `max` | Provider-prefixed Terra, Sol, Astra | Native field |
| Cursor | `gpt-5.6-luna[effort=max]` | Terra, Sol, Astra | Bracket syntax |
| Claude Code | `haiku` | `sonnet`, `opus` | Host-controlled |
| Antigravity | `flash` | `pro` | Host-controlled |
| Generic | Luna suggestion | Terra, Sol, Astra | Caller must bind explicitly |

These are configured suggestions, not evidence of account access or universal model quality. OpenAI suggestions follow the [official model catalog](https://developers.openai.com/api/docs/models). Claude Code supports [model aliases](https://code.claude.com/docs/en/sub-agents#choose-a-model), and Antigravity supports [model tiers](https://antigravity.google/docs/subagents). Relative cost ranks are maintained configuration, not live price lookups. Provider aliases and account pricing can differ. Re-evaluate suggestions when changing the shortlist.

### Override the shortlist

`--policy <file>` accepts a JSON object keyed by target. Each supplied target replaces that target's complete shortlist; omitted targets keep bundled suggestions. For example, to trial Luna at medium effort:

```json
{
  "codex": {
    "defaultProfile": "luna",
    "candidates": [
      {
        "name": "luna", "model": "gpt-5.6-luna", "reasoningEffort": "medium",
        "costRank": 1, "cheap": true,
        "capability": "Focused implementation from complete specs."
      },
      {
        "name": "terra", "model": "gpt-5.6-terra", "reasoningEffort": "medium",
        "costRank": 2, "cheap": false,
        "capability": "Implementation failures involving interactions across components."
      }
    ]
  }
}
```

The default must name a lowest-ranked cheap candidate. `inherit` and `default` are reserved profile names; `inherit`, `auto`, and `default` are rejected as model IDs. `--profile name=model-id` still installs additional named profiles, with optional `--profile-effort name=level`. Profiles outside the shortlist are preserved for explicit use but are not automatically classified as cheap. If a profile name conflicts with the shortlist's model or effort, update `--policy` so the binding and cost guidance stay consistent. Claude Code and Antigravity adapters do not emit reasoning effort; their installed policy states this limitation. Include only settings the selected launch mechanism can apply.

Use `--target generic --output <path>` for an unknown platform. The CLI writes the base Markdown, named alternatives, and `skills/task-executor-routing/` alongside it, all within the selected scope. The caller must bind the requested model through the host before launch; plain Markdown cannot enforce that selection.

### Selection and retries

The caller checks the current launch mechanism's advertised model/effort choices and registered fixed-model roles. An empty authoritative list means unavailable; a missing discovery interface means unknown. When discovery is absent, the caller automatically uses the configured cheap default and records availability as unverified. It does not prompt the user or silently inherit the parent's model. Rejected explicit selection returns `BLOCKED`.

Each task has one shared budget: initial cheap implementation, one targeted correction, and at most one assessed alternative configuration. A correction performed inside the executor consumes the same allowance as a caller-requested correction. The caller examines concrete failures and selects the least expensive suitable alternative; missing requirements, permissions, or tooling return a blocker. The alternative gets no additional repair cycle or model switch. Model and effort changes both count as alternative configurations.

### Companion skill locations

The CLI installs the caller skill in the platform's `skills/task-executor-routing` directory, alongside its `agents` directory. Antigravity uses `.agents/skills` locally and `~/.gemini/config/skills` globally. Installed agent descriptions point to the exact skill file, relative to the project root for local installations. Shortlist definition paths are relative to `models.json`, so moving a checkout does not retain stale absolute paths. The skill includes only the selected target's shortlist. No task history or user conversation is stored by installation.

## Manual installation

Each generated `adapters/<target>/` bundle contains agent definitions and a `skills/task-executor-routing/` folder. Copy **both** to the platform's agent and skill directories. Native plugin bundles contain both parts as well. For Generic, load the caller skill before asking the host to launch the leaf. Host rules control discovery, actual models, overrides, and context isolation; configuration alone does not prove runtime behavior.

## Invocation

Ask the caller to use Task Executor with an authoritative task source; it first loads `task-executor-routing`. A recommended handoff is:

```md
Use Task Executor.

Task source: <inline task, file, plan step, specification, or issue reference>
Repository: <working directory>
Objective and acceptance: <assigned task and observable completion conditions>
Settled decisions and scope: <relevant decisions, files, exclusions>
Required verification: <only checks required by the source or platform>
Constraints: <additional constraints not already in the source>
Authorized actions: <only when not already clear from the source>
```

Exact selection syntax varies by host. OpenCode supports `@task-executor`; Claude Code supports selecting or mentioning the custom agent; other hosts can be asked explicitly to invoke the installed `task-executor` subagent. Manual-only selection is prompt-enforced where the platform has no mechanical auto-selection switch.

## What it does not do by default

- Plan or redesign the task.
- Invent missing product behavior.
- Create, modify, or run tests unless required by the task or higher-authority platform rules.
- Perform Git writes unless the task explicitly requires the exact Git action.
- Make adjacent cleanup or documentation changes.
- Spawn additional agents.

The host platform's rules, permissions, and isolation settings always remain authoritative.

## Installer ownership

The CLI records installed adapter definitions in:

- Local: `<project>/.fpgskills/manifest.json`
- Global: `~/.fpgskills/manifest.json`

The manifest is an installer receipt containing artifact paths, kinds, versions, profiles, emitted model/effort settings, and checksums. `status` checks installed files; it is not a live model-access check. It contains no task history, credentials, or agent-produced work. `uninstall` removes only unmodified adapter definitions recorded as owned by this package. It never removes or reverts files Task Executor changed while executing a task.

```sh
npx @fpgskills/task-executor status --scope local
npx @fpgskills/task-executor uninstall --scope local
```

Version 2 upgrades an owned, unmodified inherited base to the cheap default. Omitted custom profiles remain untouched. Existing named profiles that collide with a bundled name but have different or unknown legacy settings stop the install before any writes; preserve their binding through a policy override or different candidate names. Modified adapters and companion files are preserved unless `--force` is supplied. Review conflicts before using `--force`. Updating this repository does not update global installations automatically.

## Development

```sh
npm run generate
npm test
npm run validate
npm run pack:check
```

Canonical sources are `agent.json`, `core/prompt.md` (leaf), `core/caller.md` (caller), and `core/models.json` (target suggestions). Regenerate all adapters, caller skills, shortlists, and native bundles after changes.

Behavior changes also require the trials in `evals/README.md`. The initial Luna medium/max trial passed acceptance at both settings, but usage was unavailable; `max` remains the baseline until total-usage measurements support changing it. Other host suggestions require local execution trials before production adoption.
