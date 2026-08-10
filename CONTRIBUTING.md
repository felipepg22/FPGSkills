# Contributing

FPGSkills keeps behavioral rules in canonical sources and generates native platform files from them.

For Task Executor:

1. Edit `agents/task-executor/core/prompt.md` or `agents/task-executor/agent.json`.
2. Run `npm run generate`.
3. Review every changed adapter.
4. Run `npm test` and `npm run validate`.
5. Run the relevant manual smoke evaluations in `agents/task-executor/evals/README.md` when behavior changes.

Do not edit generated adapters directly. Keep changes scoped, preserve platform-rule precedence, and update documentation when installation behavior changes.

For FPG AGENTS.md Writer, edit `skills/fpg-agents-md-writer/SKILL.md` and its `references/` files directly. Run its installer tests and skill validation through the repository-wide `npm test` and `npm run validate` commands.
