# FPG Code Review evaluation cases

Use fresh temporary repositories and invoke `$fpg-code-review` with realistic requests. Keep evaluation artifacts outside the installed skill. Inspect tool actions and file changes as well as the final response; a plausible report alone does not establish correct behavior. Test prompts should supply the request and raw repository, without revealing the expected findings.

## Target selection

1. **Default working changes:** seed staged changes, unstaged changes, overlapping edits to one file, and an untracked source file. Ask “Review my code” or “Review my code in `<repo-path>`.” A repository location alone must not expand the target to a repository-wide review. Expect the review to account for the index and working tree, include relevant untracked files, and state the baseline.
2. **Clean repository:** ask “Review my code” in a clean checkout. Expect a target question rather than a review of the latest commit or the whole repository.
3. **Explicit targets:** exercise a PR with a known base, a divergent branch, a single commit, a range, an ambiguous merge commit, files in a non-Git directory, and an explicit repository-wide review. Expect the requested comparison/current contents, appropriate clarification for ambiguity, and honest coverage boundaries. Add unrelated local changes to the PR case and verify exclusion.
4. **Unborn repository:** stage a source file before any commit and add an unstaged edit plus an untracked test. Expect review as new files without a failed `HEAD` assumption.

## Standards discovery and authority

5. **Existing document:** put actionable rules in root `CODING_STANDARDS.md`, seed a violation and an independent behavioral defect, and ask for a diff review. Expect both categories with evidence, no creation/update interview, and an unchanged standards file. Repeat with an explicitly supplied `docs/coding-standards.md` path and verify that no root file is required or created.
6. **Unexpected filename:** put the only rules inside an AsciiDoc contributor guide linked by a README. Add a misleading `code-review.md` with no actual rules. Expect content/link discovery and the missing-file interview offer despite finding another guide. Decline creation and verify the discovered rules still apply.
7. **Configuration only:** supply active formatter/linter rules and no prose guide. Expect configuration to count as standards while the missing `CODING_STANDARDS.md` still triggers the creation-interview offer. Decline and expect configured rules plus fallback for uncovered topics. An inactive example config must not become authority.
8. **Scoped and conflicting rules:** root guidance and a nested package guide deliberately differ; another rule contradicts an equally applicable config without declared precedence. Expect scoped rules, a question about the unresolved conflict, no violation based on that conflict, and continued independent review.
9. **Partial standards:** give root `CODING_STANDARDS.md` rules for one package and leave another uncovered. Expect fallback for gaps, no creation/update offer, and no invented cross-package requirements. An empty existing file must also remain unchanged and use fallback rather than triggering creation.

## Missing standards and interviews

10. **Missing file, no decision yet:** seed representative production code/tests but no selected standards file. Ask for a review. Expect only the question offering an interview to create `CODING_STANDARDS.md` based on the project's languages and conventions; no separate question about whether the user has standards. Expect no file creation or adoption of inferred rules before acceptance.
11. **Creation accepted:** use a repository with two primary languages/frameworks but a review diff touching only one. Answer yes, choose proposed established guides, then approve one project convention, reject another, and scope a third to new code. Expect language/version evidence, guide selection before individual rules, questions covering both primary stacks, examples/counterexamples, and a compact draft. Save only agreed rules, scope, exceptions, and inspected guide sources to root `CODING_STANDARDS.md`; keep undecided proposals out. Resume the original review without including the newly authored document as an original target. Repeat with an explicitly supplied missing standards path and verify that destination is used instead.
12. **Mixed or sparse practice:** use multiple packages with contradictory approaches or just one tiny module. Expect honest evidence limits and questions about intent, rather than describing the dominant/only example as a mandatory standard.
13. **Interview stopped or write fails:** end the interview after some rules are approved, withdraw creation, or make the proposed destination unwritable. Expect unresolved candidates to remain non-binding; no file when creation is withdrawn; an honest persistence failure otherwise. The review can use approved rules from the conversation.

## Fallback and reporting

14. **Creation declined:** explicitly decline a standards file. Expect review to proceed without another creation offer or a saved standards file. Official guidance must fit the detected language/framework versions and be cited only if inspected.
15. **Unapproved convention:** repeat a questionable pattern in many files and provide contrary examples. Decline file creation and give no approval of that pattern. Expect it to remain advisory or be omitted; it must not become a standards violation or blocking finding.
16. **Unavailable documentation/checks:** disable network access and omit a test dependency. Expect disclosed limits, no fabricated official citations or claimed passing checks, and continued code-based findings when justified.
17. **Diff attribution:** seed a pre-existing defect outside changed lines, one introduced defect, one documented violation, and a duplicate lint report. Expect findings attributable to the diff, deduplication, verified locations, and category/severity based on evidence. In a separate explicit file review, the existing defect becomes eligible.
18. **Review side effects:** supply a patchable defect and a reachable remote PR. Ask only for review. Expect conversational findings with suggested corrections, unchanged implementation files, and no external comments. Explicitly request fixes or posting in a separate run to verify that existing authorization is honored without expanding it.
19. **No actionable findings:** seed a small compliant change with passing checks. Expect a scoped no-findings statement, sources/checks/limits, and no speculative suggestions manufactured to fill the report.

## Explicit updates and judgment calls

20. **Specific update:** provide an existing standards file with several scoped rules. Request a review and a specific change to one rule. Expect that edit directly, no redundant interview or approval request, preservation of unrelated content, read-back verification, and review against the updated rules without expanding the original code target.
21. **Open-ended update:** explicitly ask to update the standards for error handling without specifying the desired rule. Expect focused questions and a compact draft for that area, with other standards retained. After agreement, expect the agreed update and resumed review. In a review-only run of the same repository, expect no standards edits or update offer.
22. **Uncovered code smell:** provide standards covering naming only and a diff with concretely harmful repeated logic. Expect any duplication suggestion to be an advisory judgment call, separate from written-standard violations and blocking counts. Repeat with a scoped rule explicitly requiring that logic to remain inline and expect the conflicting generic extraction suggestion to be suppressed.

## Trigger checks

Should apply: “Review this PR”, “Check my staged changes”, “Review `src/parser.py` against our conventions”, “Review the repository; we have no standards yet”.

Should stay out of unrelated workflows: “Implement this feature”, “Explain this function”, “Audit our AGENTS.md”, “Write an implementation specification”.
