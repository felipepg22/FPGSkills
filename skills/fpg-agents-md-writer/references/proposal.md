# Proposal contract

Present one compact proposal after research. Recommend a complete option instead of
making the user assemble the design from open-ended questions.

## Required proposal content

For each proposed file, state:

- Path and whether it will be created, updated, renamed, merged, or deleted.
- One-sentence purpose and scope.
- Key guidance it will contain.
- Repository evidence supporting the recommendation.

Also show:

- The task-based routes planned for each `AGENTS.md`.
- Existing instructions that will be preserved.
- Contradictions, evidence gaps, and assumptions requiring a decision.
- Every destructive operation as a separate, explicit item.

Do not display routine line counts. Every proposed new or rewritten `AGENTS.md`
must already be designed to fit within 100 physical lines.

## Ask for input

End with one approval or correction request. Provide recommended answers for any
unresolved decisions. Ask individual follow-ups only when the response introduces
new ambiguity.

In Audit mode, report findings and stop. In Proposal mode, provide the proposal and
stop. In Write mode, do not edit files until the user explicitly approves the
proposal.

## Handle oversized existing files

When an existing `AGENTS.md` exceeds 100 lines, propose moving detailed sections to
coherent, task-routed guidelines. If the user declines, leave that file unchanged.
Do not modify it while leaving it oversized.

## Handle destructive changes

Approval must name or unambiguously include each deletion, rename, merge, or
replacement. If approval is incomplete, perform only non-destructive approved work
and ask separately before the destructive operation.
