// Version 2 execution disclosures. Approval is validated separately from plan eligibility.
const PHASES = ["start", "preflight", "smoke", "run", "cleanup"];
const K6_PHASES = ["smoke", "run"];
export function validateExecutionPolicy(plan) {
  const errors = [];
  for (const candidate of plan.cases || []) {
    const label = `case ${candidate.id}`;
    if (typeof candidate.mutatesBusinessData !== "boolean") errors.push(`${label}.mutatesBusinessData must be boolean.`);
    const mutation = candidate.mutation;
    if (!mutation || typeof mutation !== "object") {
      errors.push(`${label}.mutation is required (null effects for read-only cases use effects: []).`);
      continue;
    }
    if (!Array.isArray(mutation.effects)) errors.push(`${label}.mutation.effects must be an array.`);
    if (!candidate.mutatesBusinessData) {
      if (mutation.effects?.length) errors.push(`${label} read-only mutation.effects must be empty.`);
      continue;
    }
    for (const name of ["effects", "evidence", "resourceTypes"]) strings(mutation[name], `${label}.mutation.${name}`, errors);
    for (const name of ["recovery", "failureResidue", "enforcement", "setup", "cleanup"]) string(mutation[name], `${label}.mutation.${name}`, errors);
    if (!["run-owned", "pre-existing"].includes(mutation.ownership)) errors.push(`${label}.mutation.ownership is invalid.`);
    if (mutation.ownership === "pre-existing") {
      const recovery = mutation.recoveryPlan;
      if (!["disposable-fixtures", "snapshot", "backup"].includes(recovery?.kind) || recovery?.accessible !== true) errors.push(`${label}.mutation.recoveryPlan requires accessible disposable-fixtures, snapshot, or backup.`);
      strings(recovery?.evidence, `${label}.mutation.recoveryPlan.evidence`, errors);
      string(recovery?.restoreProcedure, `${label}.mutation.recoveryPlan.restoreProcedure`, errors);
    }
    if (!["dedicated-test", "local"].includes(mutation.identity)) errors.push(`${label}.mutation.identity is invalid.`);
    if (plan.target?.locality === "remote" && mutation.identity !== "dedicated-test") errors.push(`${label}: remote mutations require a dedicated-test identity.`);
    if (mutation.destructiveSchema !== false) errors.push(`${label}: destructive schema operations are prohibited.`);
    bounds(mutation.bounds, `${label}.mutation.bounds`, errors);
    if (!Array.isArray(mutation.externalEffects)) errors.push(`${label}.mutation.externalEffects must be an array.`);
    for (const effect of mutation.externalEffects || []) {
      string(effect.destination, `${label}.externalEffects.destination`, errors);
      string(effect.evidence, `${label}.externalEffects.evidence`, errors);
      if (effect.environment !== "non-production" || effect.billable !== false || !Number.isSafeInteger(effect.maxCount) || effect.maxCount <= 0) errors.push(`${label}: external effects require bounded, non-billable non-production destinations.`);
    }
  }
  strings(plan.safety?.preconditions, "safety.preconditions", errors);
  if (!Array.isArray(plan.safety?.dependencies)) errors.push("safety.dependencies must enumerate all effective dependencies (possibly []).");
  for (const dependency of plan.safety?.dependencies || []) {
    string(dependency.destination, "dependency.destination", errors);
    string(dependency.evidence, "dependency.evidence", errors);
    if (!["local", "non-production"].includes(dependency.environment)) errors.push("Dependencies must be verified local or non-production.");
    if (typeof dependency.writable !== "boolean" || dependency.billable !== false) errors.push("Dependencies must declare writable and billable: false.");
  }
  if (plan.safety?.dependencies?.some(d => d.environment === "non-production")) string(plan.target?.attestation, "target.attestation", errors);
  const phases = plan.executionPhases;
  if (!Array.isArray(phases) || !phases.length) return [...errors, "executionPhases must be a non-empty array."];
  const ids = new Set();
  for (const phase of phases) {
    string(phase.id, "executionPhases.id", errors);
    if (ids.has(phase.id)) errors.push(`Duplicate execution phase ${phase.id}.`);
    ids.add(phase.id);
    if (!PHASES.includes(phase.phase)) errors.push(`Invalid execution phase ${phase.phase}.`);
    strings(phase.caseIds, `${phase.id}.caseIds`, errors);
    if (phase.caseIds?.some(id => !plan.cases?.some(c => c.id === id))) errors.push(`${phase.id} references unknown case.`);
    strings(phase.commands, `${phase.id}.commands`, errors);
    if (K6_PHASES.includes(phase.phase) && phase.commands?.length !== 1) errors.push(`${phase.id} requires exactly one command; allocate repetitions to separate bounded phases.`);
    if (!Array.isArray(phase.prerequisites)) errors.push(`${phase.id}.prerequisites must be an array.`);
    bounds(phase.bounds, `${phase.id}.bounds`, errors);
    for (const id of phase.caseIds || []) {
      const candidate = plan.cases?.find(c => c.id === id);
      if (!candidate?.mutatesBusinessData) continue;
      for (const field of ["requests", "records", "concurrency", "durationSeconds", "retries"]) if (phase.bounds?.[field] > candidate.mutation?.bounds?.[field]) errors.push(`${phase.id}.${field} exceeds case ${id} disclosure.`);
    }
    for (const command of phase.commands || []) {
      if (!plan.commands?.[phase.phase]?.includes(command)) errors.push(`${phase.id} contains an unlisted command.`);
      if (K6_PHASES.includes(phase.phase)) {
        const index = plan.commands?.[phase.phase]?.indexOf(command);
        const binding = plan.environmentBindings?.[phase.phase]?.[index];
        if (!binding || (binding.caseId && !phase.caseIds?.includes(binding.caseId))) errors.push(`${phase.id} command is not mapped to its case.`);
        if (binding?.kind === "composite" && plan.cases?.some(c => !phase.caseIds?.includes(c.id))) errors.push(`${phase.id} composite must include all cases.`);
        const keys = { MAX_REQUESTS: "requests", MAX_RECORDS: "records", MAX_CONCURRENCY: "concurrency", MAX_DURATION_SECONDS: "durationSeconds" };
        for (const [variable, field] of Object.entries(keys)) if (binding?.values?.[variable] !== String(phase.bounds?.[field])) errors.push(`${phase.id}.${variable} must bind its exact phase bound.`);
        const records = Number(binding?.values?.MAX_RECORDS_PER_REQUEST);
        if ((phase.bounds?.retries > 0 || binding?.values?.MAX_ATTEMPTS !== undefined) && binding?.values?.MAX_ATTEMPTS !== String(phase.bounds.retries + 1)) errors.push(`${phase.id}.MAX_ATTEMPTS must reserve the cumulative budget across retries plus the initial attempt.`);
        if (!Number.isSafeInteger(records) || records < 0 || (phase.caseIds?.some(id => plan.cases?.some(c => c.id === id && c.mutatesBusinessData)) && records === 0)) errors.push(`${phase.id}.MAX_RECORDS_PER_REQUEST must bound each operation's record effects.`);
      }
    }
  }
  for (const phase of phases) {
    if (phase.prerequisites?.some(id => !ids.has(id) || id === phase.id)) errors.push(`${phase.id} has unknown/self prerequisites.`);
  }
  for (const name of PHASES) {
    for (const command of plan.commands?.[name] || []) {
      if (phases.filter(p => p.phase === name && p.commands?.includes(command)).length !== 1) errors.push(`commands.${name} must map exactly once into executionPhases.`);
    }
  }
  const visit = (id, ancestors = new Set()) => {
    if (ancestors.has(id)) { errors.push("executionPhases prerequisite cycle."); return; }
    const next = new Set([...ancestors, id]);
    for (const prerequisite of phases.find(p => p.id === id)?.prerequisites || []) if (ids.has(prerequisite)) visit(prerequisite, next);
  };
  for (const id of ids) visit(id);
  return errors;
}

function string(value, label, errors) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${label} must be non-empty.`);
}
function strings(value, label, errors) {
  if (!Array.isArray(value) || !value.length || value.some(v => typeof v !== "string" || !v.trim())) errors.push(`${label} must be a non-empty string array.`);
}
function bounds(value, label, errors) {
  for (const name of ["requests", "records", "concurrency", "durationSeconds", "retries"]) {
    const n = value?.[name];
    if (!Number.isSafeInteger(n) || n < (["records", "retries"].includes(name) ? 0 : 1)) errors.push(`${label}.${name} must be a finite integer bound.`);
  }
}
