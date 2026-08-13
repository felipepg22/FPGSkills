# Readiness validation

Check every applicable item before writing.

## Contract

- The spec covers one coherent implementation outcome in one Markdown file.
- The audience is explicit and the writing matches it.
- `ready` contains no product or technical decision the executing agent must invent.
- The spec is self-contained; sources add provenance rather than missing instructions.
- Scope, non-goals, assumptions, prerequisites, and blockers are explicit where material.

## Evidence

- Every existing path, symbol, command, and test location is supported by supplied evidence or selective repository inspection.
- Proposed paths and symbols are marked `new`.
- Current behavior is not presented as verified when repository inspection was skipped.
- Consequential and disputed requirements trace to `S#` sources.
- Conflicts between user decisions, documents, and repository state are resolved or prominently open in a draft.
- Sensitive source values are absent.

## Requirements and changes

- Every `R#` is precise, normative, and testable.
- Every `C#` links its `R#` coverage and contains enough code-level guidance to execute.
- Every material requirement maps to at least one `C#` and one `V#`.
- Dependencies use explicit `Depends on`; any derived sequence agrees with those relationships.
- `C#` units are described as cohesive changes, not forced tracker tasks.
- Edge cases, errors, interfaces, schemas, state transitions, migrations, and compatibility are present wherever relevant.

## Verification

- Every `V#` names its covered `R#` and `C#`, method, setup/actions, and expected result.
- Commands and test paths are named only when verified.
- Completion criteria are observable.

## Integrity

- No placeholders, hidden decisions, obsolete operative text, or contradictory requirements remain in a ready spec.
- Existing IDs remain stable during updates.
- The change log records only material requirement, contract, dependency, or scope changes.
- The destination cannot be overwritten ambiguously.

If any required check fails, fix it before writing or use `draft` and expose the precise gap.

