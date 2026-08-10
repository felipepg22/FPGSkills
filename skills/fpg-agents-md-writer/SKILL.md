---
name: fpg-agents-md-writer
description: Research, audit, create, update, or reorganize repository AGENTS.md instructions and task-routed supporting guidelines. Use when an agent must ground repository guidance in inspected evidence, keep every new or rewritten AGENTS.md within 100 lines, preserve existing instructions, and obtain approval before writing or destructive changes.
---

# FPG AGENTS.md Writer

Build concise, evidence-backed instruction systems for coding agents. Treat every
`AGENTS.md` as a task router, not a repository encyclopedia.

## Select the outcome

Infer one of these outcomes from the request:

- **Audit:** Research and report issues. Do not propose or write files unless asked.
- **Proposal:** Research and present a file plan. Do not write files.
- **Write:** Research, present the proposal, wait for approval, then implement it.

When asked to create, update, improve, or reorganize instructions, use the Write
outcome. Never skip its approval gate, even when the initial request says to write.

## Execute the workflow

1. Read [references/research.md](references/research.md) completely and research the
   repository without changing it.
2. Read [references/proposal.md](references/proposal.md) completely and present one
   compact proposal with recommended choices.
3. Stop and wait for explicit approval in Write mode. Apply requested corrections
   and ask again when they materially change the proposal.
4. After approval, read [references/authoring.md](references/authoring.md) completely
   and create or update only the approved files.
5. Before finishing, read [references/validation.md](references/validation.md)
   completely and perform its checks.

## Enforce non-negotiable rules

- Keep every new or rewritten root or nested `AGENTS.md` at 100 physical lines or
  fewer. Count internally; do not report routine line counts.
- If an existing `AGENTS.md` exceeds 100 lines, propose a compliant refactor and
  wait. Leave it untouched when the user declines.
- Choose supporting guideline subjects and locations from repository evidence.
  Reuse an established documentation convention; otherwise default to
  `.agents/guidelines/`.
- Let a guideline exceed 100 lines when one coherent subject requires it. Split by
  responsibility or task-routing need, never by length alone.
- Put repository-wide rules, essential commands, critical prohibitions, and
  task-based routes in `AGENTS.md`. Put explanations, examples, and specialized
  knowledge in guidelines.
- Preserve valid existing guidance. Never replace an instruction system wholesale
  without explicit approval.
- Ask before every destructive operation, including deleting, renaming, merging,
  or replacing existing files. General approval to update instructions is not
  approval for an unlisted destructive action.
- Write platform-neutral, imperative guidance. Add host-specific instructions only
  when repository evidence or the user requires them.
- Do not invent commands, architecture, conventions, or policy. Stop and ask when
  evidence is sparse or contradictory.
- Do not add scripts or executables to a target repository for validation.

## Handle changes in scope

If implementation reveals a new file, destructive operation, unresolved conflict,
or materially different structure, pause and amend the proposal before proceeding.
Minor wording changes that preserve the approved structure do not require another
approval round.
