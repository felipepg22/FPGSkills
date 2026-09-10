# Normalize configured jobs

Implement `normalizeJobs(jobs)` in `src/jobs.mjs`. The design is settled:

- Non-array input throws TypeError.
- Ignore null, arrays, non-object entries, entries with `enabled === false`, and entries without a nonempty string `name` after trimming.
- Return new objects with only `{ name, retries }`. Keep case-sensitive names in input order. The first valid entry for a trimmed name wins; skipped entries do not reserve names.
- An integer `retries` is clamped to [0, 3]. Every other value defaults to 1, including numeric strings, NaN, Infinity, fractions, and missing values.
- Preserve the input array and its objects unchanged.
- Modify only `src/jobs.mjs`. Preserve `notes.txt`, the task, and existing verification files. No dependencies, Git writes, additional files, or new tests.

Required verification: run `node --test acceptance.test.mjs`. Inspect the final source and account for each condition in your report.
