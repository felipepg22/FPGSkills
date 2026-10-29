# Create or update repository standards

Read this when the user accepts a creation interview or explicitly requests an existing standards-file update. Use the standards path selected in section 2 of the main skill. The outcome is the agreed document change and a resumed review of the original target.

## Handle explicit updates

Read the current document and the requested changes. For a specific edit, make that change directly and preserve unrelated rules, scope, exceptions, and sources. The request authorizes the specified edit; skip the interview and additional draft approval, then verify the saved document and resume the review as described below.

For an unclear or open-ended update, inspect the relevant project context and ask focused questions about the requested areas. Carry existing rules forward and revisit only those areas unless the user requests a complete revision. Use the interview and draft workflow below to settle the outstanding choices.

## Inspect context and choose guides

For creation, identify the repository's primary languages, frameworks, and versions from manifests, lockfiles, configuration, and maintained code, including packages outside the current review diff. Cover that repository scope in the interview. For updates, inspect the requested scope.

Inspect a representative sample of maintained production code and tests in each relevant language/package. Include comparable code outside the proposed change so the change does not define its own standard. Consult existing guidance, configuration, and CI. Exclude generated and vendored code as convention evidence.

For creation, use the language-source policy in section 4 of the main skill to find relevant established style guides and official guidance. Begin the interview by proposing a recommended guide or combination of guides, explaining its fit, and letting the user choose the foundation and its scope before discussing individual project rules. For updates, retain the existing foundation unless changing it is part of the requested scope.

Prepare candidate standards from the chosen guides and inspected repository evidence, with sources, examples, counterexamples, and the area they would govern. Give concrete paths/lines for observed practices. Describe a mixed practice as mixed; a sparse sample is insufficient to claim a repository-wide convention. Identify choices the code cannot answer, such as a desired migration or a new test policy.

## Interview in evidence-backed rounds

Ask focused questions grouped by independent decisions. Give a recommendation with its evidence and tradeoff. Let the user adopt, reject, narrow, or replace each candidate. Build on the chosen guides and ask about project-specific preferences, exceptions, and gaps relevant to the agreed scope, such as:

- Module boundaries, dependency direction, public interfaces, and domain conventions.
- Error handling, input validation, security requirements, and resource ownership.
- Tests, regression expectations, async/concurrency behavior, and performance constraints.
- Naming, typing, formatting, and documentation where existing tools do not settle them.

For example: “`src/orders/service.ts:18` and `src/billing/service.ts:24` receive a repository in the constructor, but `src/reports/service.ts:11` constructs one directly. Should constructor injection be required for new services, required everywhere, or left to the author?” These are illustrative paths; replace them with inspected evidence.

Explicitly ask whether observed patterns are intended review rules. A request to create a file does not approve every discovered pattern or every recommended practice. Distinguish descriptive current conventions from approved aspirational rules, recording which paths and new/existing code each governs. If the user rejects a candidate, omit it from binding standards.

Carry accepted decisions forward rather than asking again. Continue until each proposed binding rule has an agreed meaning, scope, and exceptions, or is explicitly deferred. If the user ends the interview early, keep unresolved candidates out of the binding rules and continue the review using the approved subset and language fallback. If creation itself is withdrawn, write no file.

## Approve and write the document

Use the selected standards path. Show a compact draft containing:

- Purpose and applicable paths/languages, including any new-code or migration boundaries.
- Approved, observable review rules with relevant exceptions.
- Evidence or rationale for each non-obvious rule, clearly labeling desired changes to current practice.
- The chosen guides and versions, with references to existing tools or official documentation actually inspected instead of copying their manuals.

Keep undecided proposals out of the saved document; report remaining topics separately.

Resolve unapproved content and destination choices before writing; existing explicit approval of the same content/path is sufficient. Approval of individual patterns does not approve additional rules added while drafting. Keep the file focused on review criteria rather than generic tutorials or an inventory of the repository.

Write the agreed file without overwriting unrelated content. Reference applicable existing guidance and reconcile conflicting rules before saving; retain the selected destination unless the user changes it. If a file appears at that destination during the interview, read and reconcile its contents before writing. If the write fails, disclose that persistence failed, use the agreed rules from the conversation for the review, and avoid claiming the document change was saved.

Read back the saved file to check that new or changed rules reflect the agreement, scopes are preserved, sources are real, and unrelated content remains intact. Resume the original review using those rules. Report the saved path and remaining non-binding topics with the review result.
