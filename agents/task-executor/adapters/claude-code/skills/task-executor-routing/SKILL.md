---
name: task-executor-routing
description: Select a cheap model, hand off a specified task, and assess bounded retries when the user explicitly requests Task Executor with an authoritative plan or spec.
---

# Route Task Executor

This policy runs in the caller before dispatch. The executor remains a leaf. Follow host permissions and the user's task scope. An explicit request for Task Executor authorizes this routing workflow, not unrelated actions.

## Select and launch

1. Read the authoritative task. Establish the objective, acceptance criteria, scope, constraints, and required verification. Resolve ordinary code facts with focused inspection. Return `BLOCKED` for missing design decisions, inaccessible sources, or unsupported launch controls.
2. Read the adjacent [model shortlist](models.json). It defines the default, cheap candidates, relative cost ranks, capability guidance, and installed agent bindings. Resolve `definition` paths relative to that file; portable bundles identify definitions by filename. Ranks are configured guidance, not live prices or measured token counts. Additional legacy profiles outside this list are not automatic candidates.
3. Inspect model and reasoning choices exposed by the current session's launch mechanism. A fixed-model agent role and a model-override list are distinct mechanisms: absence from one does not establish absence from the other. Match the exact binding and respect immutable role settings. A configuration file or stale cache is not proof of session availability. Record `advertised` or `unknown`, separately from any confirmation the launch returns.
4. Every ready task starts with a cheap candidate. When discovery exists, choose the lowest-cost suitable cheap configuration among advertised bindings, using the configured default to break ties. An authoritative empty list means unavailable, not unknown. If no suitable cheap binding exists, return `BLOCKED`.
5. When discovery is unavailable, select the configured cheap default automatically. Carry this instruction in the caller's dispatch preparation: **Use the configured cheap model and reasoning setting explicitly when launching Task Executor; use its named profile if model overrides are unavailable.** A prompt inside an already-running executor cannot change its model. Do not ask the user to choose a model, research catalogs on each run, or inherit the caller's model implicitly. If selection is rejected or a different model is reported, stop and report `BLOCKED`; do not repeatedly probe models or silently fall back.
6. Launch with an explicit model/effort override or the matching registered fixed profile. Request fresh context where supported. Pass only the focused handoff below and required source material; preserve applicable host and repository instructions. If the host includes parent history or cannot confirm isolation, record that limitation instead of claiming a token saving.

## Focused handoff

Include: authoritative source reference (or its full inline text), working directory, assigned objective and acceptance criteria, relevant settled decisions, code scope, constraints/exclusions, authorized actions, required verification, and attempt stage. Reference accessible specs rather than copying their surrounding conversation. The executor may inspect necessary code and instructions. Start with `stage: initial; correctionRemaining: 1; alternativeRemaining: 1`.

## Assess the result

Maintain one ledger per assigned task across resumes and fresh launches; counters never reset when context changes. Count substantive implementation/correction passes, not individual file edits or every test command. Keep model/profile, requested and confirmed effort/model when exposed, availability evidence, acceptance failures, valid partial changes, and remaining budget. Record actual usage if the host provides it; otherwise say unavailable.

- On completion, check the acceptance evidence and required verification results. A model's claim alone is insufficient. Report completion only with all conditions accounted for.
- On a missing requirement, permission, environment/tool-access problem, or unavailable verification, return `BLOCKED` with the evidence. Changing models does not supply those prerequisites.
- For a concrete implementation failure, allow one targeted correction on the original cheap configuration. Pass the failure evidence and safe partial state with `stage: correction; correctionRemaining: 0; alternativeRemaining: 1`. A correction already performed inside the executor consumes this same allowance; it is not an extra retry. Resume that executor when safe and economical, otherwise send a focused handoff to a fresh instance.
- If the correction fails, briefly assess the remaining work, the demonstrated missing capability, and the available shortlist. Choose the least expensive suitable alternative configuration; explain why cheaper candidates cannot address the failure. There is no fixed escalation ladder and no automatic jump from Luna to Astra. Replanning belongs to the caller and ends this execution attempt.
- At most one alternative configuration may be selected and launched, with `stage: alternative; correctionRemaining: 0; alternativeRemaining: 0`. It gets one implementation pass and acceptance review, with no further repair cycle or model switch. Model/effort changes both count as an alternative configuration. A rejected launch also ends this budget.
- If that attempt fails, return `BLOCKED` with the remaining conditions, safe partial changes, checks performed, and usage when available. Continue only after a revised task or explicit new execution budget from the caller's user; self-issued retries do not restart the ledger.

The package requests model and context settings; host execution remains authoritative. Keep reported settings and unverified assumptions distinct. Apply this policy equally to native adapters and manually integrated Generic definitions.
