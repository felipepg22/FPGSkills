# Validation checklist

Validate the approved instruction system before reporting completion. Do not add or
run bundled validation scripts in the target repository.

## Structure

- Verify every new or rewritten root and nested `AGENTS.md` has no more than 100
  physical lines, including headings, blank lines, comments, and frontmatter.
- Verify each routed guideline exists at the referenced relative path.
- Verify every guideline is reachable from the appropriate `AGENTS.md` by a clear
  task condition.
- Verify nested instruction scopes are clear and do not contradict applicable
  parent guidance.

## Content

- Trace every repository-specific instruction to inspected evidence or explicit
  user input.
- Verify commands are exact and current according to repository automation or
  manifests.
- Remove duplicated, generic, speculative, or stale guidance.
- Verify final files contain no secrets or sensitive values discovered during
  research.
- Verify all approved existing instructions remain represented unless their removal
  was explicitly approved.

## Change control

- Compare the final paths and operations with the approved proposal.
- Stop and request approval if an unapproved destructive or material structural
  change became necessary.
- Preserve unrelated worktree changes.

Documentation-only changes do not require the full test suite unless repository
policy says otherwise. Run safe, focused checks that materially validate links or
formatting when such checks already exist.

Report changed files, the resulting instruction structure, important unresolved
items, and validation performed. Do not report routine line counts.
