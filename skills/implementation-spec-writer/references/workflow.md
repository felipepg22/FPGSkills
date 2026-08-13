# Workflow

## 1. Establish the contract

- Use the relevant current conversation plus explicitly supplied sources.
- Ask whether the audience is `coding-agent` or `human-engineer` when it is not already settled. Default neither silently.
- Keep one coherent implementation outcome in one file. If the inputs contain unrelated proposals, ask which belong in scope.
- Treat explicit user decisions as the target, the repository as truth about current behavior, and supplied documents as supporting evidence. Ask when resolving a contradiction would change behavior or scope.
- Use the user's language unless established project documentation uses another language; ask only when those signals conflict.

The outcome of this step is a bounded proposal, an audience, and an inventory of relevant sources.

## 2. Test context sufficiency

Inventory the facts required to complete the schema. Inspect the repository selectively only when a required fact is missing, ambiguous, contradictory, or dependent on current repository state. Follow directly relevant references; avoid broad repository ingestion.

Skip inspection only when supplied sources cover every required fact and the user permits treating them as authoritative. Record one grounding note: `unnecessary`, `selective`, or `skipped—sources treated as authoritative`.

For PDFs, DOCX files, spreadsheets, images, and other structured inputs, use the available format-specific capability. State any unreadable or unsupported input rather than claiming it was analyzed. Never reproduce credentials, personal data, or unrelated confidential material.

The outcome of this step is enough evidence to name current artifacts accurately or a precise list of gaps.

## 3. Settle decisions

- Ask dependency-aware batches of questions. Explain each decision's implementation impact and recommend an answer.
- Resolve material product, architectural, contract, scope, and verification choices before marking the spec ready.
- Develop architecture-grounded recommendations; obtain user approval for material technical choices.
- Allow only assumptions that cannot change behavior, architecture, scope, or acceptance.
- When an implementation blocker appears, ask whether to resolve it in the spec, record it as an external prerequisite, or remove the blocked behavior from scope.
- Exclude unrelated defects and opportunities. Mention them separately only if they directly block or constrain the proposal.

If the user declines required clarification or evidence remains unavailable, offer a `draft` with explicit gaps. Never label unresolved material decisions `ready`.

## 4. Choose the destination

Respect an established repository convention. Otherwise use `docs/specs/<descriptive-kebab-name>.md`.

- Create exactly one Markdown file.
- If the destination already exists and the user did not explicitly select it, ask whether to update it or use a distinct name.
- Preserve an existing spec's `id` across updates and renames.
- When updating an explicitly named spec, update its canonical content and concise material change log. Remove obsolete operative requirements.

## 5. Draft and write safely

Draft against the schema, then run the readiness checks before writing. In coding-agent mode, lead with exact actions, contracts, dependencies, and verification; include rationale only when its absence could lead to a wrong implementation. In human-engineer mode, add concise rationale and architectural context without weakening precision.

Validate the complete content before creating or replacing the destination. Preserve the prior file if validation or writing cannot complete safely.

## 6. Hand off

Report the absolute file path, `draft` or `ready` status, material assumptions, unresolved decisions, and blockers. Do not edit code, project configuration, or external trackers. Do not decompose or publish tasks.

