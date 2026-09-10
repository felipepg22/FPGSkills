# Task Executor evaluations

Keep the original smoke scenarios below and add the paired execution and caller-policy trials described here. Use isolated workspaces; keep results separate from shipped agent and skill payloads.

For each scenario:

1. Copy the fixture to a temporary directory.
2. Install the adapter for the platform and model being checked.
3. Explicitly invoke Task Executor with the fixture's `task.md` as the authoritative source.
4. Inspect the workspace and final report.
5. Record a simple overall `PASS` or `FAIL` with the platform, model, version, and date.

## Scenario 1: successful execution

Fixture: `fixtures/success`

Expected:

- Only `src/greeting.js` changes.
- The exported value becomes `Welcome`.
- No tests or Git writes occur.
- The report is `COMPLETED` and maps the completion condition to the changed code.

## Scenario 2: readiness blocker

Fixture: `fixtures/blocking`

Expected:

- No files change.
- The report is `BLOCKED` because the source does not define an observable end state.
- The report asks one precise question and recommends a concrete answer.

## Scenario 3: preserve unrelated work

Fixture: `fixtures/scope-preservation`

Before invocation, modify `notes.txt` without committing it.

Expected:

- Only `src/config.js` changes.
- The pre-existing `notes.txt` edit remains untouched.
- No test file is created and no Git write occurs.
- The report is `COMPLETED` with scope evidence.


## Paired model and effort trial

Use `fixtures/normalize-jobs`, a complete implementation spec with five acceptance tests and a pre-existing notes file. Copy it to a separate temporary directory for each model/effort. Give each executor the canonical `core/prompt.md`, the exact task reference, its working directory, and an initial-stage handoff with one correction remaining. Use no inherited conversation when the host supports that control.

Compare at least Luna medium and Luna max with the same inputs. Verify tests independently and compare the final tree against the fixture: only `src/jobs.mjs` may change. Record requested and confirmed model/effort separately, acceptance, correction count, changes, and actual input/output/reasoning/cached usage where exposed. Include usage from repairs and alternatives; do not substitute message length or elapsed time for token usage. Preserve `null` for unavailable metrics.

Changing the effort default requires comparable acceptance quality and lower observed total usage on representative tasks. The [recorded Luna trial](results/2026-09-10.json) passed both settings, but usage was unavailable; max remains the baseline. Expand the sample before claiming broader quality or savings. Run the same checks through each target host before production adoption of its bundled suggestion.

## Caller-policy forward test

Give an independent evaluator the generated `task-executor-routing/SKILL.md`, its adjacent `models.json`, and `routing-scenarios.json`. Ask it to apply the skill to each independent simulated state and report action, selected binding, next budget, and justification. Do not show the expectations below until its answer is recorded. No actual dispatch is necessary for these protocol cases.

Check that no-discovery uses explicit Luna without a user prompt; an authoritative empty list blocks; the matching fixed Luna role remains eligible even if the override list contains only Astra; the first correctable failure consumes the single correction; a bounded cross-component failure selects Terra after assessment; missing requirements block; exhausted alternatives block; and an immutable effort mismatch does not masquerade as a matching configuration.

The initial eight-case simulation passed. This tests interpretation of the caller policy, not host enforcement of model selection or runtime retry limits.
