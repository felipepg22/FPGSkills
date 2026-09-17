---
name: bdd-plan
description: Create a behavior-driven Markdown implementation plan for a feature or bug fix, with scenarios linked to tasks and post-implementation code verification.
---

# BDD Plan

Create a plan; do not implement it. Accept a rough idea, conversation, issue, PRD, or repository as input. Use behavior-driven development to make expected outcomes observable before prescribing code changes.

## Intake

1. Before writing the plan, ask the user which policy the eventual implementer should follow when post-implementation verification finds gaps: **automatic fix** or **show findings in the conversation and wait for a reply**. Record the answer in the plan. Ask on every invocation, even when implementation will happen later.
2. Read the supplied material. When a repository is available, inspect its relevant code, tests, and agent instructions. Cite verified repository-relative paths in the plan; label proposed paths as proposed. Resolve conflicting sources with the user. Ask about missing decisions that change observable behavior; state minor assumptions explicitly.
3. Identify the main success path, relevant alternate paths, failures, and boundaries. For a bug fix, describe the current failure and corrected behavior in observable terms. Do not invent a fixed number of scenarios.

## Plan contract

Write one Markdown plan in the repository at a suitable path, or return Markdown in the conversation when no repository is available. Honor a user-specified path. Scale detail to the change. Include:

- Objective, scope, sources, relevant current behavior, assumptions, and unresolved blockers.
- Scenarios with stable `B-01`, `B-02`, ... identifiers. Use `Given / When / Then`, adding `And` or an examples table where helpful. State outcomes a user or external observer can distinguish; include setup and expected results precise enough to verify.
- Give any explicit plan requirement that is not itself a scenario a stable `R-01`, `R-02`, ... identifier, so the final verifier can account for it.
- Ordered implementation tasks sized so one agent can implement and verify each independently. Each task names the scenarios it serves, concrete work, genuine dependencies, and a verification step with expected results. Include relevant repository paths when known. Every scenario must map to implementation and verification work; every implementation task must serve a stated behavior or necessary constraint.
- Completion criteria that cover the scenarios and any other explicit plan requirements.
- A mandatory **final task, after implementation**, directing the implementing agent to dispatch one sub-agent to verify the implemented code against **every scenario and every other plan requirement**. The verifier must inspect relevant code, run appropriate tests or checks, and report `pass`, `fail`, or `unverified` for each scenario and requirement, with concrete code or test evidence. The implementing agent must show that report in the conversation; it writes no report file unless the user requests one.

In the final task, encode the user's selected gap policy:

- **Automatic fix:** dispatch a different sub-agent to fix reported gaps, then another sub-agent to recheck affected scenarios and requirements. Repeat the fixer → new verifier cycle while progress is being made. If the same gap persists or a decision is needed, report the blocker to the user.
- **Show findings first:** show the verifier's report in the conversation and wait for the user's reply before fixing gaps.

Before delivering the plan, check its scenario coverage, task links, dependencies, observable outcomes, and final verification task. Report the plan's location and material assumptions or blockers. The post-implementation verification is an instruction in the plan; run it only when implementation is actually complete.
