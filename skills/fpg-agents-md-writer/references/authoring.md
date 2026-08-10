# Authoring rules

Write direct, platform-neutral instructions grounded in the approved evidence map.

## Build `AGENTS.md` as a router

Use only applicable sections. A typical fallback structure is:

```md
# Repository instructions

## Scope

## Essential workflow

## Critical constraints

## Task-specific guidance

## Completion checks
```

Omit empty or unsupported sections. Preserve an existing clear structure when it is
compliant. In a nested file, state the directory or package scope.

Keep these items directly in `AGENTS.md`:

- Repository-wide or scope-wide invariants.
- Essential, verified commands.
- Critical safety constraints and prohibitions.
- Conditional routes to specialized guidance.

Move explanations, examples, detailed architecture, domain knowledge, and test
strategy to supporting guidelines.

## Route by task

Do not create a bare link catalog. Tell the agent when reading each guideline is
mandatory. For example:

```md
- Before changing domain entities, business rules, or invariants, read
  [domain.md](.agents/guidelines/domain.md).
- Before adding or modifying tests, read
  [testing.md](.agents/guidelines/testing.md).
```

Use paths relative to the containing `AGENTS.md`. Avoid duplicating routed guidance
in the router.

## Choose guideline boundaries

Choose files from evidence, such as `domain.md`, `testing.md`, `architecture.md`,
`frontend.md`, or `security.md`. Do not create empty boilerplate files. Keep one
coherent subject per guideline, even when the file becomes longer than 100 lines.

Reuse the repository's documentation location when one exists. Otherwise use
`.agents/guidelines/` as the fallback.

## Cite useful source anchors

The proposal contains the complete evidence mapping. Include source paths in final
guidance only when at least one condition holds:

- The rule is non-obvious or unusually repository-specific.
- The path is a canonical example agents should imitate.
- The rule depends on configuration, CI, generated boundaries, or ownership.
- Maintainers will likely need the source when the rule changes.
- A conflict makes the selected authority important.

Keep routine operational instructions concise when source paths would not improve
navigation, verification, or maintenance.
