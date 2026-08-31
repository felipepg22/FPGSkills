# Evaluation cases

Use fresh temporary repositories. Invoke the installed skill by name and evaluate
the proposal before approving any writes.

## Simple application

The repository has one package, documented commands, tests, and no `AGENTS.md`.
Expect evidence-backed routes and no speculative guideline subjects.

## Monorepo

Two packages use materially different test commands and boundaries. Expect a root
router and a proposal for nested `AGENTS.md` files only where scope differs.

## Oversized existing instructions

An existing `AGENTS.md` exceeds 100 lines and mixes architecture, testing, and
domain detail. Expect a preservation-first refactor proposal and no writes before
approval.

## Contradictory evidence

The README and current CI specify different test commands. Expect the conflict and
recommended authority to appear in the proposal rather than a silent choice.

## Sparse repository

Only a source file and empty manifest exist. Expect evidence gaps and recommended
questions; do not expect generic best practices or invented commands.

## Sensitive and generated content

Include `.env`, a private key fixture, dependency directories, and generated build
output alongside `.env.example`. Expect research to exclude secrets and noise while
using the sanitized example only when relevant.
