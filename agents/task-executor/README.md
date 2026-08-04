# Task Executor

Task Executor is a manually invoked leaf subagent for implementing one coherent task that has already been planned and specified. It starts with a fresh context, reads the authoritative task and relevant code, performs the scoped implementation, and self-reviews against the task's completion conditions.

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

Node.js 22 or newer is required. The package is publish-ready but is not published in v1. From this repository:

```sh
npm install
npm run build
node agents/task-executor/dist/cli.js install --target codex --scope local
```

When published, the equivalent command will be:

```sh
npx @fpgskills/task-executor install
```

Interactive installation asks for targets, local/global scope, project root, and optional model profiles. Scripted use supplies them explicitly:

```sh
npx @fpgskills/task-executor install \
  --target codex,cursor \
  --scope local \
  --project /path/to/project \
  --profile luna=gpt-5.6-luna \
  --profile grok=xai/grok-model-id
```

The base `task-executor` profile inherits the parent model. Each `--profile name=model-id` adds a definition such as `task-executor-luna`. Model identifiers are platform- and account-specific; the installer validates profile syntax but cannot validate account access. Antigravity currently documents the model tiers `inherit`, `flash`, and `pro`.

Use `--target generic --output <path>` for an unknown platform. The CLI never guesses a Generic Markdown destination, and the destination must remain inside the selected project or home scope.

## Manual installation

Generated, self-contained definitions are committed under `adapters/`. Copy the desired adapter to the platform path in the table above. Files under `native/` are source bundles for future marketplace or native-plugin submission; v1 does not publish them.

## Invocation

Invoke the named subagent explicitly and pass an authoritative task source. A recommended handoff is:

```md
Use Task Executor.

Task source: <inline task, file, plan step, specification, or issue reference>
Repository: <working directory>
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

The manifest is an installer receipt containing adapter paths, versions, profiles, and checksums. It contains no task history, credentials, or agent-produced work. `uninstall` removes only unmodified adapter definitions recorded as owned by this package. It never removes or reverts files Task Executor changed while executing a task.

```sh
npx @fpgskills/task-executor status --scope local
npx @fpgskills/task-executor uninstall --scope local
```

Modified adapters are preserved unless `--force` is supplied. Review conflicts before using `--force`.

## Development

```sh
npm run generate
npm test
npm run validate
npm run pack:check
```

Edit only `agent.json` and `core/prompt.md` for behavior or metadata changes. Generated adapters are committed and marked as generated.

Behavior changes should also be checked with the lightweight manual smoke scenarios in `evals/README.md`.
