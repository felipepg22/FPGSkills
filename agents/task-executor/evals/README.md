# Task Executor smoke evaluations

V1 uses three lightweight manual smoke evaluations. There is no weighted scoring framework and no hosted model workflow.

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
