# Specification schema

Use the stable core below and omit conditional sections that add no implementation value. Scale detail to risk and complexity.

## Frontmatter

```yaml
---
id: <stable-descriptive-slug>
title: <title>
status: draft | ready
audience: coding-agent | human-engineer
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources:
  - S1
---
```

## Core sections

### Objective

State the coherent implementation outcome and its boundaries.

### Current behavior

Describe only current behavior needed to understand the change. Include the repository-grounding note.

### Target behavior

Define observable behavior, constraints, error semantics, state transitions, interfaces, schemas, API payloads, and algorithms wherever leaving them open would force an implementation decision.

### How to read this spec

- `S#` identifies a source.
- `R#` identifies required behavior or a constraint.
- `C#` identifies a cohesive code-change unit. It is not a prescribed task boundary.
- `V#` identifies a verification case.
- `Depends on` expresses execution order; identifier numbers alone do not.

### Sources

List each source once as `S#` with a concise label and location. Sources provide provenance, not missing instructions. Add `Source: S#` to consequential requirements, constraints, or disputed decisions.

### Requirements

Each `R#` contains one precise normative statement, applicable constraints, and source references. Use `must`, `should`, and `may` deliberately. Replace phrases such as “handle appropriately,” “as needed,” and “etc.” with testable behavior.

### Code changes

Each `C#` contains its objective, implemented `R#` identifiers, affected components and verified repository-relative files and symbols, exact implementation guidance, `Depends on` identifiers or `None`, relevant edge cases, and resulting contracts and behavior.

Mark proposed files and symbols as `new`. Avoid line numbers. For multiple repositories, qualify every path with its repository. When dependencies exist, add a derived execution sequence; independent units may remain unordered.

### Verification

Each `V#` contains covered `R#` and `C#` identifiers, verification method, concrete setup and actions, expected result, and a verified command or test location when repository evidence supplies one. Use manual verification only where automation is not reasonable.

### Completion criteria

List observable conditions that establish the implementation is complete. This is an implementation contract, not a checklist for writing the spec.

## Conditional sections

Add only when applicable: scope and non-goals; interfaces and data changes; migration and compatibility; security and privacy; performance; observability; rollout and rollback; external prerequisites and owners; blockers; assumptions; a compact Mermaid relationship or state diagram; and a change log.

An external prerequisite may coexist with `ready` only when the implementation contract is complete and resolving the prerequisite cannot change it. Identify blocked `C#` units. Otherwise use `draft`.

## Self-containedness

Restate the complete implementation contract in normalized form without copying large source passages. An executing agent may consult sources for optional context, but must not need them to discover requirements.

