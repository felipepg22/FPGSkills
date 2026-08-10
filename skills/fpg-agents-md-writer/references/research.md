# Repository research

Use read-only inspection to learn how the repository actually works. Research facts
instead of asking the user for facts that are locally discoverable.

## Establish scope and precedence

1. Find every `AGENTS.md` and other repository-local instruction file.
2. Determine which instructions govern the repository root and each relevant
   subdirectory.
3. Identify existing documentation locations and naming conventions.
4. Inspect the current Git worktree and preserve unrelated user changes.

## Gather evidence

Inspect relevant examples from these sources when present:

- Root documentation, contribution guides, and architecture decisions.
- Package, workspace, build, dependency, and language manifests.
- CI workflows, linting, formatting, type-checking, and release configuration.
- Test configuration, test layout, fixtures, and representative tests.
- Source layout, module boundaries, public interfaces, and canonical examples.
- Generated-file notices, ownership markers, and code-generation configuration.
- Recent Git history when it clarifies active conventions or renamed commands.

Use safe, non-mutating verification commands when dependencies already exist and
the result materially increases confidence. Do not install dependencies, start a
persistent service, or alter repository state without separate approval.

## Exclude unsafe or noisy sources

Do not inspect secrets or credentials, including `.env*`, private keys, tokens, and
credential stores. Sanitized examples such as `.env.example` may be inspected when
relevant.

Skip dependency/vendor trees, generated output, large binaries, caches, and
unrelated personal files. Respect repository-local ignore and instruction files.

## Record an evidence map

For each candidate instruction, record:

- The proposed rule or command.
- The source paths that support it.
- Its scope: repository-wide, directory-specific, or task-specific.
- Any conflict, uncertainty, or user decision still required.

Do not treat prevalence as authority. When sources disagree, prefer an explicit
repository instruction or current automation over an isolated example, but surface
the conflict rather than silently resolving a consequential ambiguity.

## Decide whether nested instructions are justified

Propose a nested `AGENTS.md` only when a subproject has materially different
commands, conventions, constraints, or ownership. Prefer a shared routed guideline
when the information applies across scopes.
