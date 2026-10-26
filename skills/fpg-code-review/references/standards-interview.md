# Establish missing repository standards

Read this only after discovery found no applicable standards and the user agreed to create a file. The outcome is a standards document containing approved, evidence-backed rules and a resumed review of the original target.

## Inspect before interviewing

Inspect a representative sample of maintained production code and tests in each relevant language/package. Include comparable code outside the proposed change so the change does not define its own standard. Consult manifests, configuration, and CI. Exclude generated and vendored code as convention evidence.

Prepare candidate standards with concrete paths/lines, examples, counterexamples, and the area they would govern. Describe a mixed practice as mixed; a sparse sample is insufficient to claim a repository-wide convention. Identify choices the code cannot answer, such as a desired migration or a new test policy.

## Interview in evidence-backed rounds

Ask focused questions grouped by independent decisions. Give a recommendation with its evidence and tradeoff. Let the user adopt, reject, narrow, or replace each candidate. Ask only about topics relevant to this repository and review, such as:

- Module boundaries, dependency direction, public interfaces, and domain conventions.
- Error handling, input validation, security requirements, and resource ownership.
- Tests, regression expectations, async/concurrency behavior, and performance constraints.
- Naming, typing, formatting, and documentation where existing tools do not settle them.

For example: “`src/orders/service.ts:18` and `src/billing/service.ts:24` receive a repository in the constructor, but `src/reports/service.ts:11` constructs one directly. Should constructor injection be required for new services, required everywhere, or left to the author?” These are illustrative paths; replace them with inspected evidence.

Explicitly ask whether observed patterns are intended review rules. A request to create a file does not approve every discovered pattern or every recommended practice. Distinguish descriptive current conventions from approved aspirational rules, recording which paths and new/existing code each governs. If the user rejects a candidate, omit it from binding standards.

Carry accepted decisions forward rather than asking again. Continue until each proposed binding rule has an agreed meaning, scope, and exceptions, or is explicitly deferred. If the user ends the interview early, keep unresolved candidates out of the binding rules and continue the review using the approved subset and language fallback. If creation itself is withdrawn, write no file.

## Approve and write the document

Propose a destination matching the repository's documentation layout, using `docs/coding-standards.md` when no suitable convention exists. Show a compact draft containing:

- Purpose and applicable paths/languages, including any new-code or migration boundaries.
- Approved, observable review rules with relevant exceptions.
- Evidence or rationale for each non-obvious rule, clearly labeling desired changes to current practice.
- References to existing tools or official documentation actually inspected instead of copying their manuals.
- Any explicitly deferred topics, labeled non-binding.

Resolve unapproved content and destination choices before writing; existing explicit approval of the same content/path is sufficient. Approval of individual patterns does not approve additional rules added while drafting. Keep the file focused on review criteria rather than generic tutorials or an inventory of the repository.

Write the agreed file without overwriting unrelated content. If another applicable standards document is discovered during the interview, reconcile the evidence and update the proposed destination with the user instead of creating competing authority. If the write fails, disclose that persistence failed, use the agreed rules from the conversation for the review, and avoid claiming a file exists.

Read back the saved file to check that it contains only agreed rules, preserves their scopes, and links to real evidence. Resume the original review using those rules. Report the saved path and remaining non-binding topics with the review result.
