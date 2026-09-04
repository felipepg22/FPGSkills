#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { stableStringify, validatePlan, validatePlanFiles, fingerprintPlan } from "./validate-plan.mjs";

// Reporting-only metadata is excluded; executable hashes remain safety-relevant.
export function safetyDigest(plan) {
  const execution = structuredClone(plan);
  delete execution.reports;
  delete execution.artifacts;
  delete execution.measurements;
  if (execution.commands) delete execution.commands.report;
  if (execution.environmentBindings) delete execution.environmentBindings.report;
  delete execution.environmentVariables;
  return `sha256:${createHash("sha256").update(stableStringify(execution)).digest("hex")}`;
}

export function executionEvidence(plan) {
  return { application: plan.application, target: plan.target, dependencies: plan.safety?.dependencies ?? [] };
}

export function requiredWarnings(plan, phaseIds) {
  const phases = (plan.executionPhases || []).filter(p => phaseIds.includes(p.id));
  const cases = new Set(phases.flatMap(p => p.caseIds));
  const warnings = [];
  if (plan.target?.locality === "remote" || plan.safety?.dependencies?.some(d => d.environment === "non-production")) warnings.push("remote");
  for (const c of plan.cases || []) {
    if (!cases.has(c.id) || !c.mutatesBusinessData) continue;
    warnings.push(`mutation:${c.id}`);
    if (c.mutation?.ownership === "pre-existing") warnings.push(`existing-data:${c.id}`);
    if (c.mutation?.externalEffects?.length) warnings.push(`external-effects:${c.id}`);
  }
  return warnings;
}

export function validateAuthorization(plan, authorization, request) {
  const errors = validatePlan(plan);
  if (plan.schemaVersion !== 2) errors.push("Upgrade legacy plans to version 2 before recording reusable authorization.");
  if (!authorization || typeof authorization !== "object") return [...errors, "Missing authorization record."];
  if (authorization.schemaVersion !== 1 || authorization.planId !== plan.id) errors.push("Authorization must identify this plan and schemaVersion 1.");
  if (authorization.revoked !== false) errors.push("Authorization is revoked or has no explicit active state.");
  if (authorization.safetyDigest !== safetyDigest(plan)) errors.push("Execution plan changed; obtain new approval.");
  if (typeof authorization.approvedAt !== "string" || !Number.isFinite(Date.parse(authorization.approvedAt))) errors.push("Authorization requires approvedAt timestamp.");
  if (typeof authorization.summary !== "string" || !authorization.summary.trim()) errors.push("Authorization requires a non-secret natural-language summary.");
  const approved = authorization.approvedPhaseIds;
  const phases = plan.executionPhases || [];
  if (!Array.isArray(approved) || !approved.length || approved.some(id => !phases.some(p => p.id === id))) errors.push("approvedPhaseIds must select known execution phases.");
  const approvedIds = Array.isArray(approved) ? approved : [];
  for (const warning of requiredWarnings(plan, approvedIds)) if (!authorization.acknowledgedWarnings?.includes(warning)) errors.push(`Approval must acknowledge ${warning}.`);
  if (requiredWarnings(plan, approvedIds).includes("remote") && authorization.targetAttestation !== plan.target.attestation) errors.push("Approval must record the target attestation.");
  if (request?.userRequested !== true) errors.push("Each execution needs a fresh user request (initial approval may be that request).");
  if (stableStringify(request?.evidence ?? null) !== stableStringify(executionEvidence(plan))) errors.push("Runtime evidence changed or is missing; re-inspect and reapprove.");
  if (!Array.isArray(request?.phaseIds) || !request.phaseIds.length) errors.push("Request must select execution phases.");
  const selected = Array.isArray(request?.phaseIds) ? request.phaseIds : [];
  for (const id of selected) {
    if (!approvedIds.includes(id)) errors.push(`Phase ${id} is not approved.`);
    const phase = phases.find(p => p.id === id);
    for (const prerequisite of phase?.prerequisites || []) {
      if (!selected.includes(prerequisite)) errors.push(`Phase ${id} requires selected prerequisite ${prerequisite}.`);
    }
  }
  return errors;
}

// Read-only gate: prints exactly the selected commands; never launches processes.
async function main() {
  const [planPath, approvalPath, requestPath] = process.argv.slice(2);
  if (!planPath || !approvalPath || !requestPath) throw new Error("Usage: authorize-plan.mjs plan.json authorization.json request.json");
  const [plan, approval, request] = await Promise.all([planPath, approvalPath, requestPath].map(async file => JSON.parse(await readFile(file, "utf8"))));
  const errors = [...validateAuthorization(plan, approval, request), ...await validatePlanFiles(plan)];
  if (errors.length) throw new Error([...new Set(errors)].join("\n"));
  process.stdout.write(`${JSON.stringify({ planFingerprint: fingerprintPlan(plan), safetyDigest: safetyDigest(plan), phases: plan.executionPhases.filter(p => request.phaseIds.includes(p.id)) }, null, 2)}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
