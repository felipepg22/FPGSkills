# Native package sources

These directories contain publish-ready source layouts for platform-native packaging where the host supports subagents in plugins:

- `claude-code/`
- `cursor/`
- `antigravity/`

Their agent definitions are generated from the same canonical prompt as `adapters/`. These bundles are not automatically published to a marketplace.

Each native bundle includes the base agent, named alternatives, and `skills/task-executor-routing/` with its shortlist. Install the whole bundle. The caller must load the routing skill before dispatch; loading it only inside the executor is too late to select that executor’s model.
