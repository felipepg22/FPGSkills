---
name: fpg-code-review
description: Review code against CODING_STANDARDS.md and applicable repository rules, and check for defects. Use for PR, branch, commit, working-change, file, or repository reviews, including an optional interview to create missing standards or explicitly requested standards updates. Not for implementing fixes or a standalone audit of repository instruction files.
license: CC-BY-4.0
metadata:
  author: Felipe Rodrigues - github.com/felipfr
  version: '1.0.0'
---

# Fpg Code Review

Discover the rules that actually apply before reviewing. Check standards compliance alongside correctness, security, performance, and test coverage. Report in the conversation by default; edit code or post comments externally only when requested. Standards-file creation and explicitly requested updates follow the document workflow below.

## 1. Establish the review target

Honor the user's target and exclusions. A directory supplied to locate the repository, as in “review my code in this repo,” identifies the workspace; it does not request a repository-wide review. Inspect repository state and applicable agent instructions. Resolve the baseline and record the files or diff being reviewed before creating or updating any standards document, so that document does not accidentally expand the review.

- **No target supplied:** review staged and unstaged changes relative to `HEAD`, including relevant untracked source and test files. Inspect the index as well when staged and unstaged edits overlap. In an unborn repository, review the staged and working files as new files. If there are no changes, ask for the target rather than choosing a recent commit or the whole repository.
- **PR or branch:** use its actual base and head, comparing the merge-base to the head unless the user specifies another comparison. Obtain the PR's base from available repository or PR tools; ask if it cannot be established. Keep unrelated local changes outside this target.
- **Commit or range:** preserve the requested range; for a single commit, compare with its parent, or the empty tree for a root commit. Clarify an ambiguous merge-parent choice.
- **Files or repository:** review the requested current contents, including relevant surrounding code. In a non-Git directory, file and repository reviews remain supported; ask for a target if none was supplied.

Use available local tools or a connected PR service; the workflow requires no particular connector or other skill. If a target or baseline is inaccessible, report what is missing instead of substituting another target.

## 2. Discover applicable standards

Select the repository-root `CODING_STANDARDS.md` as the standards document unless the user explicitly supplies another standards-file path. Read the selected file when it exists and use it as a review reference. An unreadable file is an access limitation, not evidence that it is missing; disclose the limitation and continue with accessible sources.

Start with `rg --files --hidden` or the available equivalent. Inspect root and relevant ancestor/nested instructions, documentation directories, and configurations for each part of the target. Exclude Git internals, dependencies, generated output, and unrelated vendored code from discovery.

Find likely filenames such as `coding-standards.md`, `code-review.md`, style guides, `CONTRIBUTING.md`, `AGENTS.md`, and `CLAUDE.md`; also search documentation content for coding, review, testing, architecture, and language conventions. Include README sections, linked guidance, and extensionless or non-Markdown documentation. A filename alone is insufficient: read the relevant content and verify that it supplies actual review rules.

Inspect applicable formatter, linter, compiler, type-checker, and test configuration, including package-level overrides and CI commands. Configuration is a standards source even when no prose standards file exists. Distinguish active configuration from examples or disabled rules; follow referenced configuration when available and disclose inaccessible dependencies.

Build a concise working map of each rule's source, applicable paths/languages, exceptions, and enforcement. Apply rules only within their declared scope. Honor platform instruction precedence; within repository guidance, use explicit precedence and more specific applicable rules. If an unresolved contradiction changes the review outcome, ask the user about that rule and continue independent checks. Keep conflicting rules out of violation findings until resolved.

Choose the document branch by the selected file's existence and the user's request:

- **File exists, review only:** review against it and other applicable rules. Leave the file unchanged and offer no creation or update interview. Use section 4 for gaps, including a partial or empty file.
- **File exists, update explicitly requested:** read [references/standards-interview.md](references/standards-interview.md) and follow its update workflow. Make specific requested edits directly; use focused questions for unclear or open-ended updates. Preserve unrelated rules, then resume the original review.
- **File missing:** ask only: “Would you like to start an interview to create `CODING_STANDARDS.md`, based on this project's programming languages and their conventions?” Substitute an explicitly supplied path when applicable. Other guides or tooling configuration still inform the review but do not replace this offer. Honor an acceptance or decline already given in the request. If accepted, read [references/standards-interview.md](references/standards-interview.md), establish and save the agreed rules, then resume the original review.
- **Creation declined:** review using accessible repository rules and section 4, save no standards file, and avoid repeating the creation offer during this review.

## 3. Review the code

Apply every relevant approved or documented rule to its scope, including exceptions. Read callers, tests, and surrounding implementation far enough to establish behavior. Review correctness, security, performance, and missing tests even when the standards do not discuss them. Judge test gaps by concrete behavior or regression risk rather than a blanket requirement that every change add a test.

For a diff, report problems introduced or materially worsened by that change. Use unchanged code as context; keep unrelated existing issues outside the findings. For a file or repository review, existing issues within the requested target are eligible. Scale coverage to the target; if a large repository requires staged inspection, disclose inspected and remaining areas rather than claiming complete coverage.

Use relevant existing tests, lint, and type checks in check-only mode when they add useful evidence and are available. Distinguish failures attributable to the target from pre-existing or environmental failures. If checks cannot run, continue evidence-backed inspection and disclose that limit. Review mode leaves implementation files unchanged.

Require a concrete violation or a defensible failure scenario for each finding. Separate:

- **Standards violation:** cite the applicable documented/configured rule or the user's explicit approval, and show how the code violates it.
- **Defect:** show the trigger, observed or traceable behavior, and consequence independently of style preferences. Cite relevant code, tests, or authoritative technical guidance.
- **Advisory (judgment call):** label an optional improvement, code smell, or unapproved convention as such; include it only when its benefit is concrete. It is not a failed standard or a blocking finding.

Merge duplicate findings and tool output describing the same problem. Avoid speculative performance claims, blanket design preferences, and formatting findings contradicted by the active configuration.

## 4. Fill standards gaps with language guidance

Identify the languages, frameworks, and versions from manifests, lockfiles, configuration, and affected code. Consult matching official documentation or maintained official style guidance, preferring versioned/local documentation and using web access when needed. Cite the source actually inspected; if it is unavailable, disclose that and avoid presenting remembered or unverifiable guidance as an authoritative requirement.

Keep language recommendations and code-smell judgments distinct from repository requirements. Existing applicable repository rules govern style unless the user changes them; suppress generic suggestions that contradict those rules. A language recommendation or code smell alone does not establish a standards violation. Documented unsafe or incorrect behavior can support a defect regardless of local style.

Inspect comparable repository code for consistency evidence, including counterexamples and package boundaries. Repetition is evidence of practice, not proof of an intended rule. Ask for confirmation before treating an inferred convention as mandatory. If approval is absent or declined, continue the review without enforcing it; any useful suggestion stays advisory. Approval for this review can remain in the conversation without creating a file.

## 5. Report and finish

Lead with actionable findings ordered by severity. Use `P0` for an immediate critical issue, `P1` for high impact needing prompt attention, `P2` for a normal actionable issue, and `P3` for a low-impact issue. Assign severity from demonstrated impact, independently of finding category. Keep advisories visibly separate from violation/defect counts.

Each finding includes:

- Category and severity, plus a short title.
- A verified file and tight line location; for a diff, locate the relevant changed lines when possible.
- The supporting rule/source or behavioral evidence, the triggering condition, and the consequence.
- A concrete suggested correction, without applying it unless requested.

Briefly state the reviewed target/baseline, standards sources or fallback used, checks run, and material coverage limits or unresolved rule conflicts. When nothing actionable is found, say so for the inspected scope; avoid implying that unrun checks passed. If a standards file was created or updated, link it and distinguish that work from the original review target. Finish when the agreed target has been reviewed and findings and limits have been reported.

## Examples

- **Existing standards file:** “Review this PR.” Resolve its base/head, read `CODING_STANDARDS.md` and applicable package rules/configuration, and report evidenced violations and defects without offering to change the standards file.
- **Missing file, creation accepted:** “Review my changes; yes, help establish standards.” Identify the repository's primary languages/frameworks, propose established guides, interview about project choices, show the agreed draft, save root `CODING_STANDARDS.md`, then review the original changes.
- **Creation declined:** “Review `src/parser.py`; don't create a standards file.” Use available repository rules, matching official guidance, and behavioral evidence; keep unapproved conventions advisory and return findings without writing a standards file.
- **Explicit update:** “Review my changes and update `CODING_STANDARDS.md` to require return types on public Python functions.” Apply that requested standards change, preserve other rules, and review the original changes against the updated document.
