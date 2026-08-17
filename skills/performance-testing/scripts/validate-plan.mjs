#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TARGET_TYPES = new Set(["endpoint", "journey", "whole-application"]);
const PROTOCOLS = new Set(["http", "grpc"]);
const REPORTS = new Set(["markdown", "local-dashboard", "self-hosted-grafana"]);
const SCENARIOS = new Set(["baseline", "load", "stress", "spike", "soak", "scalability"]);
const EXECUTORS = new Set(["constant-vus", "constant-arrival-rate", "ramping-vus", "ramping-arrival-rate", "shared-iterations", "per-vu-iterations"]);
const ENVIRONMENT_NAME = /^[A-Z_][A-Z0-9_]*$/;
const DURATION = /^(?:\d+(?:\.\d+)?(?:ms|s|m|h))+$/;

export function validatePlan(plan) {
  const errors = [];
  if (!isObject(plan)) return ["Plan must be a JSON object."];
  rejectNonJson(plan, errors);
  if (plan.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  requireString(plan, "id", errors);
  if (!TARGET_TYPES.has(plan.targetType)) errors.push("targetType must be endpoint, journey, or whole-application.");
  if (!PROTOCOLS.has(plan.protocol)) errors.push("protocol must be http or grpc; GraphQL is not supported in version 1.");

  validateTarget(plan.target, plan.protocol, errors);
  validateApplication(plan.application, errors);
  validateCases(plan.cases, plan.secretEnvironmentVariables, errors);
  validateExcludedOperations(plan.excludedOperations, errors);
  validateWorkload(plan.workload, errors);

  requireNonEmptyStringArray(plan, "measurements", errors);
  if (Array.isArray(plan.measurements)) {
    if (!plan.measurements.includes("response behavior")) errors.push("measurements must include response behavior.");
    if (plan.measurements.some((entry) => entry.toLowerCase().includes("browser"))) errors.push("Browser-experience measurements are outside version 1.");
  }

  requireNonEmptyStringArray(plan, "reports", errors);
  if (Array.isArray(plan.reports)) {
    rejectDuplicates(plan.reports, "reports", errors);
    for (const report of plan.reports) if (!REPORTS.has(report)) errors.push(`Unsupported report: ${String(report)}.`);
  }

  validateSlos(plan.slos, errors);
  validateSafety(plan.safety, errors);
  validateEnvironmentBindings(plan.environmentBindings, plan.environmentVariables, plan, errors);
  validateCommands(plan.commands, plan.environmentVariables, plan.environmentBindings, plan.secretEnvironmentVariables, plan.cases, plan.generatedFiles, errors);
  validateArtifacts(plan.artifacts, errors);
  validateGeneratedFiles(plan.generatedFiles, plan.environmentBindings, errors);
  validateEnvironmentNames(plan.environmentVariables, "environmentVariables", errors);
  validateEnvironmentNames(plan.secretEnvironmentVariables, "secretEnvironmentVariables", errors);

  if (!isObject(plan.toolVersions) || typeof plan.toolVersions.k6 !== "string" || !plan.toolVersions.k6.trim()) {
    errors.push("toolVersions.k6 must record the approved version.");
  } else if (!isPinnedVersion(plan.toolVersions.k6)) {
    errors.push("toolVersions.k6 must be an exact detected semantic version, not a placeholder or floating label.");
  }
  validateDownloads(plan.downloads, errors);

  if (Array.isArray(plan.reports) && plan.reports.includes("self-hosted-grafana")) validateGrafana(plan, errors);
  rejectEmbeddedSecrets(plan, errors);
  return errors;
}

export function fingerprintPlan(plan) {
  const errors = validatePlan(plan);
  if (errors.length) throw new Error(errors.join("\n"));
  return `sha256:${createHash("sha256").update(stableStringify(plan)).digest("hex")}`;
}

export function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

export function renderPlanMarkdown(plan) {
  const fingerprint = fingerprintPlan(plan);
  const json = JSON.stringify(sortValue(plan), null, 2);
  const longestRun = Math.max(0, ...[...json.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `# Performance test plan: ${plan.id}\n\n## Canonical plan\n\n${fence}json\n${json}\n${fence}\n\n---\n\nPlan fingerprint: \u0060${fingerprint}\u0060\n`;
}

export async function validatePlanFiles(plan, options = {}) {
  const errors = validatePlan(plan);
  if (errors.length) return errors;
  const repositoryRoot = path.resolve(options.repositoryRoot || process.cwd());
  const repositoryRealRoot = await realpath(repositoryRoot);
  const generatedRealRoot = path.join(repositoryRealRoot, "docs", "performance-tests");
  let wiredK6SafetyStop = false;
  const generatedContents = new Map();
  const requiresK6SafetyStop = plan.safety.stops.some((stop) => /\bk6\b.*\b(?:threshold|abortOnFail)\b/i.test(stop.implementation));
  for (const [index, generated] of plan.generatedFiles.entries()) {
    const absolute = path.resolve(repositoryRoot, generated.path);
    if (!absolute.startsWith(`${repositoryRoot}${path.sep}`)) {
      errors.push(`generatedFiles[${index}].path escapes the repository root.`);
      continue;
    }
    try {
      const resolvedGenerated = await realpath(absolute);
      if (!resolvedGenerated.startsWith(`${generatedRealRoot}${path.sep}`)) {
        errors.push(`generatedFiles[${index}].path resolves outside docs/performance-tests in the repository.`);
        continue;
      }
      const content = await readFile(resolvedGenerated);
      generatedContents.set(normalizePlanPath(generated.path), content);
      const actual = createHash("sha256").update(content).digest("hex");
      if (actual !== generated.sha256) errors.push(`generatedFiles[${index}] hash mismatch for ${generated.path}.`);
      const source = content.toString("utf8");
      if (generated.kind === "k6-entrypoint") {
        const requiredTemplateVariables = new Set([...source.matchAll(/required\(["']([A-Z_][A-Z0-9_]*)["']\)/g)].map((match) => match[1]));
        for (const bindingId of generated.bindingIds) {
          const located = findBinding(plan.environmentBindings, bindingId);
          if (!located) continue;
          validateGeneratedBindingVariables(requiredTemplateVariables, located, plan, errors);
        }
        if (/abortOnFail\s*:\s*true/.test(source) && /thresholds\s*:/.test(source)) wiredK6SafetyStop = true;
      }
    } catch (error) {
      errors.push(`Cannot read generatedFiles[${index}] ${generated.path}: ${error instanceof Error ? error.message : String(error)}.`);
    }
  }
  await validateDependencyClosure(plan, generatedContents, repositoryRoot, errors);
  if (requiresK6SafetyStop && !wiredK6SafetyStop) errors.push("No generated k6 entrypoint wires the plan's threshold with abortOnFail: true.");
  if (options.markdownFile) {
    try {
      const actual = await readFile(options.markdownFile, "utf8");
      const expected = renderPlanMarkdown(plan);
      if (actual !== expected) errors.push("Markdown plan does not match the deterministic rendering of the canonical JSON plan.");
    } catch (error) {
      errors.push(`Cannot read Markdown plan: ${error instanceof Error ? error.message : String(error)}.`);
    }
  }
  return errors;
}

function findBinding(bindings, id) {
  for (const phase of ["smoke", "run"]) {
    const index = Array.isArray(bindings?.[phase]) ? bindings[phase].findIndex((entry) => entry?.id === id) : -1;
    if (index >= 0) return { phase, index, binding: bindings[phase][index] };
  }
  return undefined;
}

function validateGeneratedBindingVariables(requiredTemplateVariables, located, plan, errors) {
  const { phase, index, binding } = located;
  const values = binding.values || {};
  const candidate = plan.cases.find((item) => item.id === binding.caseId);
  const applicableSecrets = binding.kind === "composite"
    ? plan.secretEnvironmentVariables
    : candidate?.secretEnvironmentVariables || [];
  const declaredVariables = new Set([...Object.keys(values), ...applicableSecrets]);
  const conditional = new Set(["APPROVED_CONTAINER_HOST", "HTTP_BODY", "GRPC_IMPORT_PATHS", "AUTH_TOKEN"]);
  for (const name of requiredTemplateVariables) if (!conditional.has(name) && !declaredVariables.has(name)) errors.push(`Generated tests require environmentBindings.${phase}[${index}].values.${name}.`);
  if (values.TARGET_LOCALITY === "container" && !values.APPROVED_CONTAINER_HOST) errors.push(`environmentBindings.${phase}[${index}].values.APPROVED_CONTAINER_HOST is required for container targets.`);
  if (values.HTTP_METHOD && !["GET", "HEAD", "OPTIONS"].includes(values.HTTP_METHOD) && !values.HTTP_BODY) errors.push(`environmentBindings.${phase}[${index}].values.HTTP_BODY is required for ${values.HTTP_METHOD}.`);
  if (values.GRPC_REFLECTION === "false" && !values.GRPC_PROTOSET && (!values.GRPC_PROTO || !values.GRPC_IMPORT_PATHS)) errors.push(`environmentBindings.${phase}[${index}].values must bind GRPC_PROTOSET or GRPC_PROTO with GRPC_IMPORT_PATHS when reflection is disabled.`);
}

function validateTarget(target, protocol, errors) {
  if (!isObject(target)) {
    errors.push("target must be an object.");
    return;
  }
  if (target.environment !== "local") errors.push("target.environment must be local.");
  if (target.locality !== "loopback" && target.locality !== "container") errors.push("target.locality must be loopback or container.");
  requireString(target, "address", errors, "target.address");
  requireNonEmptyStringArray(target, "localityEvidence", errors, "target.localityEvidence");
  if (typeof target.address === "string" && PROTOCOLS.has(protocol)) {
    const locality = classifyAddress(target.address, protocol);
    if (target.locality === "loopback" && locality !== "loopback") errors.push("A loopback target must be localhost, 127.0.0.0/8, or ::1 with an explicit port where required.");
    if (target.locality === "container" && locality !== "container") errors.push("A container target must use a private IP or a local container-network hostname, not a public or ambiguous host.");
    if (protocol === "http") {
      try {
        const parsed = new URL(target.address);
        if (parsed.username || parsed.password) errors.push("target.address must not embed URL credentials.");
        for (const [name, value] of parsed.searchParams) if (isSensitiveKey(name) && value) errors.push(`target.address must not embed a secret query parameter ${name}.`);
      } catch {
        // classifyAddress already reports invalid addresses.
      }
    }
  }
  if (target.locality === "container") {
    requireString(target, "containerNetwork", errors, "target.containerNetwork");
    requireString(target, "containerService", errors, "target.containerService");
    if (target.daemonVerified !== true) errors.push("target.daemonVerified must be true for a container-network target.");
    if (typeof target.address === "string" && typeof target.containerService === "string") {
      const host = addressHost(target.address, protocol);
      if (host && !isPrivateIp(host) && host !== target.containerService.toLowerCase()) errors.push("The container target hostname must equal target.containerService unless daemon inspection proved a private IP.");
    }
    if (Array.isArray(target.localityEvidence)) {
      if (!target.localityEvidence.some((entry) => /compose\.ya?ml|docker-compose|podman-compose|devcontainer|container[^ ]* config/i.test(entry))) errors.push("target.localityEvidence must cite a concrete repository container configuration.");
      if (!target.localityEvidence.some((entry) => /inspect|daemon|docker network|podman network|network (?:id|name)|service address/i.test(entry))) errors.push("target.localityEvidence must cite concrete daemon/network inspection.");
    }
  } else if (target.containerNetwork !== null || target.containerService !== null) {
    errors.push("Loopback targets must set target.containerNetwork and target.containerService to null.");
  }
}

function validateApplication(application, errors) {
  if (!isObject(application)) {
    errors.push("application must record the tested revision and configuration.");
    return;
  }
  requireString(application, "revision", errors, "application.revision");
  if (typeof application.dirty !== "boolean") errors.push("application.dirty must be a boolean.");
  requireString(application, "configurationProfile", errors, "application.configurationProfile");
  requireNonEmptyStringArray(application, "configurationEvidence", errors, "application.configurationEvidence");
}

function validateCases(cases, planSecretEnvironmentVariables, errors) {
  if (!Array.isArray(cases) || cases.length === 0) {
    errors.push("cases must be a non-empty array.");
    return;
  }
  const ids = [];
  for (const [index, candidate] of cases.entries()) {
    if (!isObject(candidate)) {
      errors.push(`cases[${index}] must be an object.`);
      continue;
    }
    requireString(candidate, "id", errors, `cases[${index}].id`);
    requireString(candidate, "operation", errors, `cases[${index}].operation`);
    if (typeof candidate.id === "string") ids.push(candidate.id);
    if (candidate.mutatesBusinessData !== false) errors.push(`cases[${index}].mutatesBusinessData must be false.`);
    requireNonEmptyStringArray(candidate, "readOnlyEvidence", errors, `cases[${index}].readOnlyEvidence`);
    requireNonEmptyStringArray(candidate, "functionalChecks", errors, `cases[${index}].functionalChecks`);
    requireStringArray(candidate, "testDataRefs", errors, `cases[${index}].testDataRefs`);
    validateEnvironmentNames(candidate.secretEnvironmentVariables, `cases[${index}].secretEnvironmentVariables`, errors);
    if (Array.isArray(candidate.secretEnvironmentVariables) && Array.isArray(planSecretEnvironmentVariables)) {
      for (const name of candidate.secretEnvironmentVariables) if (!planSecretEnvironmentVariables.includes(name)) errors.push(`cases[${index}].secretEnvironmentVariables contains ${name}, which is missing from the plan-level list.`);
    }
  }
  rejectDuplicates(ids, "cases[].id", errors);
}

function validateExcludedOperations(operations, errors) {
  if (!Array.isArray(operations)) {
    errors.push("excludedOperations must be an array.");
    return;
  }
  for (const [index, operation] of operations.entries()) {
    if (!isObject(operation)) {
      errors.push(`excludedOperations[${index}] must be an object.`);
      continue;
    }
    requireString(operation, "operation", errors, `excludedOperations[${index}].operation`);
    requireString(operation, "reason", errors, `excludedOperations[${index}].reason`);
    requireNonEmptyStringArray(operation, "evidence", errors, `excludedOperations[${index}].evidence`);
  }
}

function validateWorkload(workload, errors) {
  if (!isObject(workload)) {
    errors.push("workload must be an object.");
    return;
  }
  if (!SCENARIOS.has(workload.scenario)) errors.push("workload.scenario is unsupported.");
  if (workload.model !== "closed" && workload.model !== "open") errors.push("workload.model must be closed or open.");
  if (!EXECUTORS.has(workload.executor)) errors.push("workload.executor is unsupported.");
  requireDuration(workload, "duration", errors, "workload.duration");
  requirePositiveInteger(workload, "repetitions", errors, "workload.repetitions");
  validateStages(workload.stages, errors);

  if (["constant-vus", "ramping-vus", "shared-iterations", "per-vu-iterations"].includes(workload.executor) && workload.model !== "closed") errors.push("VU/iteration executors require workload.model: closed.");
  if (["constant-arrival-rate", "ramping-arrival-rate"].includes(workload.executor) && workload.model !== "open") errors.push("Arrival-rate executors require workload.model: open.");
  if (["constant-vus", "ramping-vus", "shared-iterations", "per-vu-iterations"].includes(workload.executor)) requirePositiveInteger(workload, "vus", errors, "workload.vus");
  else if (workload.vus !== null) errors.push("workload.vus must be null for an open workload.");
  if (["shared-iterations", "per-vu-iterations"].includes(workload.executor)) requirePositiveInteger(workload, "iterations", errors, "workload.iterations");
  if (["constant-arrival-rate", "ramping-arrival-rate"].includes(workload.executor)) {
    requirePositiveNumber(workload, "arrivalRate", errors, "workload.arrivalRate");
  } else if (workload.arrivalRate !== null) errors.push("workload.arrivalRate must be null for a closed workload.");
  if (workload.compositeWeights !== null && !isObject(workload.compositeWeights)) errors.push("workload.compositeWeights must be null or an object of approved traffic weights.");
}

function validateStages(stages, errors) {
  if (!Array.isArray(stages) || stages.length === 0) {
    errors.push("workload.stages must be a non-empty array.");
    return;
  }
  for (const [index, stage] of stages.entries()) {
    if (!isObject(stage)) {
      errors.push(`workload.stages[${index}] must be an object.`);
      continue;
    }
    requireString(stage, "name", errors, `workload.stages[${index}].name`);
    requireDuration(stage, "duration", errors, `workload.stages[${index}].duration`);
    if (typeof stage.target !== "number" || !Number.isFinite(stage.target) || stage.target < 0) errors.push(`workload.stages[${index}].target must be a non-negative number.`);
  }
}

function validateSlos(slos, errors) {
  if (!Array.isArray(slos)) {
    errors.push("slos must be an array.");
    return;
  }
  for (const [index, slo] of slos.entries()) {
    if (!isObject(slo)) {
      errors.push(`slos[${index}] must be an object.`);
      continue;
    }
    if (slo.source !== "conversation") errors.push(`slos[${index}] must declare source: conversation.`);
    for (const key of ["metric", "scope", "comparator", "unit"]) requireString(slo, key, errors, `slos[${index}].${key}`);
    requirePositiveNumber(slo, "threshold", errors, `slos[${index}].threshold`);
  }
}

function validateSafety(safety, errors) {
  if (!isObject(safety)) {
    errors.push("safety must be an object.");
    return;
  }
  if (safety.remoteWritableDependenciesVerifiedAbsent !== true) errors.push("safety.remoteWritableDependenciesVerifiedAbsent must be true.");
  requireNonEmptyStringArray(safety, "effectiveConfigurationEvidence", errors, "safety.effectiveConfigurationEvidence");
  requireStringArray(safety, "expectedSideEffects", errors, "safety.expectedSideEffects");
  if (!Array.isArray(safety.stops) || safety.stops.length === 0) {
    errors.push("safety.stops must be a non-empty array of typed safety stops.");
    return;
  }
  for (const [index, stop] of safety.stops.entries()) {
    if (!isObject(stop)) {
      errors.push(`safety.stops[${index}] must be an object.`);
      continue;
    }
    for (const key of ["id", "observable", "threshold", "action", "implementation"]) requireString(stop, key, errors, `safety.stops[${index}].${key}`);
    if (typeof stop.implementation === "string" && !/(?:\bk6\b.*\b(?:threshold|abortOnFail)\b|\bsupervisor\b)/i.test(stop.implementation)) errors.push(`safety.stops[${index}].implementation must explicitly name a wired k6 threshold/abortOnFail or executor supervisor.`);
  }
}

function validateEnvironmentBindings(bindings, environmentVariables, plan, errors) {
  if (!isObject(bindings)) {
    errors.push("environmentBindings must contain smoke, run, and report entry arrays.");
    return;
  }
  const declared = Array.isArray(environmentVariables) ? environmentVariables : [];
  rejectDuplicates(declared, "environmentVariables", errors);
  const union = new Set();
  const allIds = [];
  for (const phase of ["smoke", "run", "report"]) {
    if (!Array.isArray(bindings[phase])) {
      errors.push(`environmentBindings.${phase} must be an array.`);
      continue;
    }
    const ids = [];
    for (const [index, entry] of bindings[phase].entries()) {
      if (!isObject(entry)) {
        errors.push(`environmentBindings.${phase}[${index}] must be an object.`);
        continue;
      }
      requireString(entry, "id", errors, `environmentBindings.${phase}[${index}].id`);
      if (typeof entry.id === "string") {
        ids.push(entry.id);
        allIds.push(entry.id);
      }
      if (phase !== "report") validateBindingCase(entry, phase, index, plan, errors);
      if (!isObject(entry.values)) {
        errors.push(`environmentBindings.${phase}[${index}].values must be an object.`);
        continue;
      }
      for (const [name, value] of Object.entries(entry.values)) {
        union.add(name);
        if (!declared.includes(name)) errors.push(`environmentBindings.${phase}[${index}].values contains undeclared variable ${name}.`);
        if (typeof value !== "string" || !value.length || /[\r\n\0]/.test(value)) errors.push(`environmentBindings.${phase}[${index}].values.${name} must be an exact non-empty single-line string.`);
        if (value?.startsWith("$") && !((name === "PLAN_FINGERPRINT" && value === "$APPROVED_PLAN_FINGERPRINT") || (name === "RUN_ID" && value === "$GENERATED_RUN_ID"))) errors.push(`environmentBindings.${phase}[${index}].values.${name} may not use an ambient-value sentinel.`);
      }
      validateSerializedPayloads(entry.values, errors, `environmentBindings.${phase}[${index}].values`);
      if (phase !== "report") validatePhaseScenario(entry.values, phase, plan.workload, errors, `environmentBindings.${phase}[${index}]`);
    }
    rejectDuplicates(ids, `environmentBindings.${phase}[].id`, errors);
  }
  rejectDuplicates(allIds, "environmentBindings entry ids", errors);
  for (const name of declared) if (!union.has(name)) errors.push(`environmentVariables declares unused variable ${name}.`);
  validateBindingCoverage(bindings, plan, errors);
}

function validateBindingCase(entry, phase, index, plan, errors) {
  const label = `environmentBindings.${phase}[${index}]`;
  const composite = entry.kind === "composite";
  if (composite) {
    if (entry.caseId !== null || phase !== "run" || !isObject(plan.workload?.compositeWeights)) errors.push(`${label} may be composite only for an approved run compositeWeights workload.`);
  } else if (typeof entry.caseId !== "string" || !plan.cases?.some((candidate) => candidate.id === entry.caseId)) errors.push(`${label}.caseId must identify an approved case.`);
  if (phase === "run") {
    if (entry.scenario !== plan.workload?.scenario) errors.push(`${label}.scenario must match workload.scenario.`);
    if (!Number.isInteger(entry.repetition) || entry.repetition <= 0 || entry.repetition > plan.workload?.repetitions) errors.push(`${label}.repetition is outside the approved workload repetitions.`);
  }
  const values = entry.values;
  if (!isObject(values)) return;
  if (values.AUTH_MODE !== "none" && values.AUTH_MODE !== "bearer") errors.push(`${label}.values.AUTH_MODE must be none or bearer.`);
  if (values.PLAN_ID !== plan.id) errors.push(`${label}.values.PLAN_ID must match plan.id.`);
  if (!composite && values.CASE_ID !== entry.caseId) errors.push(`${label}.values.CASE_ID must match caseId.`);
  if (values.TARGET_LOCALITY !== plan.target?.locality) errors.push(`${label}.values.TARGET_LOCALITY must match target.locality.`);
  const boundTarget = plan.protocol === "http" ? values.TARGET_URL : values.GRPC_ADDRESS;
  if (boundTarget !== plan.target?.address) errors.push(`${label}.values target address must match target.address.`);
  if (plan.target?.locality === "container") {
    const approvedHost = addressHost(plan.target.address, plan.protocol);
    if (values.APPROVED_CONTAINER_HOST?.toLowerCase() !== approvedHost) errors.push(`${label}.values.APPROVED_CONTAINER_HOST must match the approved container address host (the service name or inspected private IP).`);
  }
  if (composite) {
    const tokenDeclarations = (plan.cases || []).filter((candidate) => candidate.secretEnvironmentVariables?.includes("AUTH_TOKEN")).length;
    if (values.AUTH_MODE === "bearer" && tokenDeclarations !== plan.cases?.length) errors.push(`${label} uses bearer authentication but not every composite case declares AUTH_TOKEN.`);
    if (values.AUTH_MODE === "none" && tokenDeclarations !== 0) errors.push(`${label} disables authentication but a composite case declares AUTH_TOKEN.`);
  }
  if (!composite) {
    const candidate = plan.cases?.find((item) => item.id === entry.caseId);
    if (plan.protocol === "grpc" && values.GRPC_METHOD !== candidate?.operation) errors.push(`${label}.values.GRPC_METHOD must match the approved case operation.`);
    if (plan.protocol === "http" && values.OPERATION_NAME !== undefined && values.OPERATION_NAME !== candidate?.operation) errors.push(`${label}.values.OPERATION_NAME must match the approved case operation.`);
    if (plan.protocol === "http" && values.JOURNEY_NAME !== undefined && values.JOURNEY_NAME !== candidate?.operation) errors.push(`${label}.values.JOURNEY_NAME must match the approved case operation.`);
    if (plan.protocol === "http" && values.HTTP_METHOD && !candidate?.operation?.toUpperCase().startsWith(`${values.HTTP_METHOD.toUpperCase()} `)) errors.push(`${label}.values.HTTP_METHOD must match the approved case operation.`);
    if (plan.protocol === "http" && values.HTTP_METHOD && !["GET", "HEAD", "OPTIONS"].includes(values.HTTP_METHOD.toUpperCase()) && typeof values.HTTP_BODY !== "string") errors.push(`${label}.values.HTTP_BODY is required for an approved read-only ${values.HTTP_METHOD} operation.`);
    const needsAuthToken = candidate?.secretEnvironmentVariables?.includes("AUTH_TOKEN");
    if (values.AUTH_MODE === "bearer" && !needsAuthToken) errors.push(`${label} uses bearer authentication but its case does not declare AUTH_TOKEN.`);
    if (values.AUTH_MODE === "none" && needsAuthToken) errors.push(`${label} disables authentication but its case declares AUTH_TOKEN.`);
    if (plan.protocol === "grpc" && values.GRPC_REFLECTION === "false" && !values.GRPC_PROTOSET && (!values.GRPC_PROTO || !values.GRPC_IMPORT_PATHS)) errors.push(`${label}.values must bind GRPC_PROTOSET or GRPC_PROTO with GRPC_IMPORT_PATHS when reflection is disabled.`);
  }
}

function validateSerializedPayloads(values, errors, label) {
  if (!isObject(values)) return;
  for (const name of ["HTTP_BODY", "GRPC_PAYLOAD", "GRPC_PAYLOADS"]) {
    if (typeof values[name] !== "string") continue;
    try {
      const parsed = JSON.parse(values[name]);
      rejectEmbeddedSecrets(parsed, errors, `${label}.${name}`);
      if (name === "GRPC_PAYLOAD" && !isObject(parsed)) errors.push(`${label}.${name} must encode one JSON object.`);
      if (name === "GRPC_PAYLOADS" && (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((payload) => !isObject(payload)))) errors.push(`${label}.${name} must encode a non-empty array of JSON objects.`);
    } catch (error) {
      if (name.startsWith("GRPC_")) errors.push(`${label}.${name} must be valid JSON.`);
    }
  }
}

function validatePhaseScenario(values, phase, workload, errors, label) {
  if (!isObject(values)) return;
  if (values.PLAN_FINGERPRINT !== "$APPROVED_PLAN_FINGERPRINT") errors.push(`${label}.values.PLAN_FINGERPRINT must use $APPROVED_PLAN_FINGERPRINT.`);
  if (values.RUN_ID !== "$GENERATED_RUN_ID") errors.push(`${label}.values.RUN_ID must use $GENERATED_RUN_ID.`);
  let scenario;
  try {
    scenario = JSON.parse(values.SCENARIO_CONFIG);
  } catch {
    errors.push(`${label}.values.SCENARIO_CONFIG must be valid JSON.`);
    return;
  }
  if (!isObject(scenario) || scenario.executor !== values.EXECUTOR) errors.push(`${label}.values.SCENARIO_CONFIG.executor must match EXECUTOR.`);
  if (phase === "smoke") {
    if (scenario?.executor !== "shared-iterations" || scenario.vus !== 1 || scenario.iterations !== 1 || typeof scenario.maxDuration !== "string" || !DURATION.test(scenario.maxDuration)) errors.push(`${label} must use shared-iterations with one VU, one iteration, and a valid maxDuration.`);
    if (isObject(scenario) && Object.keys(scenario).some((key) => !["executor", "vus", "iterations", "maxDuration"].includes(key))) errors.push(`${label}.values.SCENARIO_CONFIG contains an unapproved smoke setting.`);
    if (values.SCENARIO_NAME !== "smoke") errors.push(`${label}.values.SCENARIO_NAME must be smoke.`);
    return;
  }
  if (!isObject(workload) || !isObject(scenario)) return;
  if (values.SCENARIO_NAME !== workload.scenario) errors.push(`${label}.values.SCENARIO_NAME must match workload.scenario.`);
  if (scenario.executor !== workload.executor) errors.push(`${label} executor must match workload.executor.`);
  const open = ["constant-arrival-rate", "ramping-arrival-rate"].includes(scenario.executor);
  if ((open ? "open" : "closed") !== workload.model) errors.push(`${label} SCENARIO_CONFIG model must match workload.model.`);
  validateScenarioShape(scenario, errors, `${label}.values.SCENARIO_CONFIG`);
  if (workload.vus !== null && ["constant-vus", "shared-iterations", "per-vu-iterations"].includes(scenario.executor) && scenario.vus !== workload.vus) errors.push(`${label}.values.SCENARIO_CONFIG.vus must match workload.vus.`);
  if (workload.arrivalRate !== null && (scenario.rate ?? scenario.startRate) !== workload.arrivalRate) errors.push(`${label}.values.SCENARIO_CONFIG rate must match workload.arrivalRate.`);
  if (["constant-vus", "constant-arrival-rate"].includes(scenario.executor) && scenario.duration !== workload.duration) errors.push(`${label}.values.SCENARIO_CONFIG.duration must match workload.duration.`);
  if (["shared-iterations", "per-vu-iterations"].includes(scenario.executor)) {
    if (scenario.iterations !== workload.iterations) errors.push(`${label}.values.SCENARIO_CONFIG.iterations must match workload.iterations.`);
    if (scenario.maxDuration !== workload.duration) errors.push(`${label}.values.SCENARIO_CONFIG.maxDuration must match workload.duration.`);
  }
  if (Array.isArray(scenario.stages)) {
    const planned = workload.stages?.map(({ duration, target }) => ({ duration, target }));
    if (stableStringify(scenario.stages) !== stableStringify(planned)) errors.push(`${label}.values.SCENARIO_CONFIG.stages must match workload.stages durations and targets.`);
  }
}

function validateScenarioShape(scenario, errors, label) {
  const requiredKeys = {
    "constant-vus": ["vus", "duration"],
    "constant-arrival-rate": ["rate", "timeUnit", "duration", "preAllocatedVUs", "maxVUs"],
    "ramping-vus": ["startVUs", "stages"],
    "ramping-arrival-rate": ["startRate", "timeUnit", "preAllocatedVUs", "maxVUs", "stages"],
    "shared-iterations": ["vus", "iterations", "maxDuration"],
    "per-vu-iterations": ["vus", "iterations", "maxDuration"],
  };
  for (const key of requiredKeys[scenario.executor] || []) if (!(key in scenario)) errors.push(`${label}.${key} is required for ${scenario.executor}.`);
  for (const key of ["vus", "iterations", "preAllocatedVUs", "maxVUs"]) if (key in scenario && (!Number.isInteger(scenario[key]) || scenario[key] <= 0)) errors.push(`${label}.${key} must be a positive integer.`);
  for (const key of ["rate", "startRate"]) if (key in scenario && (typeof scenario[key] !== "number" || !Number.isFinite(scenario[key]) || scenario[key] <= 0)) errors.push(`${label}.${key} must be positive.`);
  if ("startVUs" in scenario && (!Number.isInteger(scenario.startVUs) || scenario.startVUs < 0)) errors.push(`${label}.startVUs must be a non-negative integer.`);
  for (const key of ["duration", "timeUnit", "maxDuration"]) if (key in scenario && (typeof scenario[key] !== "string" || !DURATION.test(scenario[key]))) errors.push(`${label}.${key} must be a k6 duration.`);
  if ("stages" in scenario && (!Array.isArray(scenario.stages) || scenario.stages.length === 0 || scenario.stages.some((stage) => !isObject(stage) || typeof stage.duration !== "string" || !DURATION.test(stage.duration) || typeof stage.target !== "number" || !Number.isFinite(stage.target) || stage.target < 0))) errors.push(`${label}.stages must contain valid duration and non-negative target values.`);
}

function validateBindingCoverage(bindings, plan, errors) {
  if (!Array.isArray(bindings.smoke) || !Array.isArray(bindings.run)) return;
  for (const candidate of plan.cases || []) {
    const smoke = bindings.smoke.filter((entry) => entry?.caseId === candidate.id);
    if (smoke.length !== 1) errors.push(`Case ${candidate.id} must have exactly one smoke binding.`);
    for (let repetition = 1; repetition <= (plan.workload?.repetitions || 0); repetition += 1) {
      const run = bindings.run.filter((entry) => entry?.caseId === candidate.id && entry.repetition === repetition);
      if (run.length !== 1) errors.push(`Case ${candidate.id} must have exactly one run binding for repetition ${repetition}.`);
    }
    if (smoke[0]) for (const run of bindings.run.filter((entry) => entry?.caseId === candidate.id)) {
      const phaseSpecific = new Set(["EXECUTOR", "SCENARIO_CONFIG", "SCENARIO_NAME", "RUN_ID", "K6_RESULTS_DIR", "SAFETY_DELAY_ABORT_EVAL"]);
      for (const name of Object.keys(smoke[0].values || {})) if (!phaseSpecific.has(name) && name in (run.values || {}) && smoke[0].values[name] !== run.values[name]) errors.push(`Smoke/run binding drift for case ${candidate.id} immutable variable ${name}.`);
    }
  }
}

function validateCommands(commands, environmentVariables, environmentBindings, secretEnvironmentVariables, cases, generatedFiles, errors) {
  if (!isObject(commands)) {
    errors.push("commands must be an object.");
    return;
  }
  const declared = new Set([...(Array.isArray(environmentVariables) ? environmentVariables : []), ...(Array.isArray(secretEnvironmentVariables) ? secretEnvironmentVariables : []), "APPROVED_PLAN_FINGERPRINT", "GENERATED_RUN_ID"]);
  const secrets = new Set(Array.isArray(secretEnvironmentVariables) ? secretEnvironmentVariables : []);
  for (const key of ["start", "smoke", "run", "report", "cleanup"]) {
    requireCommandList(commands, key, errors);
    if (!Array.isArray(commands[key])) continue;
    for (const command of commands[key]) {
      if (typeof command !== "string") continue;
      for (const name of referencedEnvironmentVariables(command)) if (!declared.has(name)) errors.push(`commands.${key} references undeclared environment variable ${name}.`);
      for (const name of secrets) {
        const assignment = shellTokens(command).find((token) => token.startsWith(`${name}=`));
        if (assignment && ![`${name}=$${name}`, `${name}=\${${name}}`].includes(assignment)) errors.push(`commands.${key} must not embed a value for secret environment variable ${name}.`);
      }
    }
  }
  for (const group of ["smoke", "run", "report"]) {
    const commandsForPhase = Array.isArray(commands[group]) ? commands[group] : [];
    const bindingsForPhase = Array.isArray(environmentBindings?.[group]) ? environmentBindings[group] : [];
    if (commandsForPhase.length !== bindingsForPhase.length) errors.push(`commands.${group} and environmentBindings.${group} must be one-to-one.`);
    commandsForPhase.forEach((command, index) => {
      const values = bindingsForPhase[index]?.values || {};
      for (const [name, binding] of Object.entries(values)) {
        if (typeof binding === "string" && !shellTokens(command).includes(`${name}=${binding}`)) errors.push(`commands.${group}[${index}] must bind ${name} to its exact approved value.`);
      }
      if (group !== "report") {
        const binding = bindingsForPhase[index];
        const mappedEntrypoints = (Array.isArray(generatedFiles) ? generatedFiles : []).filter(
          (generated) => generated?.kind === "k6-entrypoint" && generated.bindingIds?.includes(binding?.id),
        );
        const commandPaths = executablePlanPaths(command);
        if (mappedEntrypoints.length === 1 && !commandPaths.includes(normalizePlanPath(mappedEntrypoints[0].path))) {
          errors.push(`commands.${group}[${index}] must invoke its mapped generated k6 entrypoint ${mappedEntrypoints[0].path}.`);
        }
        for (const executable of commandPaths) {
          if (!mappedEntrypoints.some((generated) => normalizePlanPath(generated.path) === executable)) {
            errors.push(`commands.${group}[${index}] invokes unlisted or unmapped executable ${executable}.`);
          }
        }
        const caseSecrets = binding?.kind === "composite"
          ? [...new Set((Array.isArray(cases) ? cases : []).flatMap((candidate) => candidate.secretEnvironmentVariables || []))]
          : (Array.isArray(cases) ? cases.find((candidate) => candidate.id === binding?.caseId)?.secretEnvironmentVariables : []) || [];
        for (const name of caseSecrets) if (!command.includes(name)) errors.push(`commands.${group}[${index}] must reference case secret environment variable name ${name} without storing its value.`);
      }
    });
  }
}

function executablePlanPaths(command) {
  return shellTokens(command)
    .map((token) => normalizePlanPath(token.replace(/^\.\//, "")))
    .filter((token) => /^docs\/performance-tests\/.+\.(?:js|mjs|cjs|ts)$/i.test(token));
}

async function validateDependencyClosure(plan, generatedContents, repositoryRoot, errors) {
  const listed = new Set((plan.generatedFiles || []).map((generated) => normalizePlanPath(generated?.path)));
  const dependencies = new Map();
  for (const generated of plan.generatedFiles || []) {
    const owner = normalizePlanPath(generated?.path);
    const content = generatedContents.get(owner);
    if (!content || !/\.(?:js|mjs|cjs|ts)$/i.test(owner)) continue;
    const source = content.toString("utf8");
    const specifiers = [
      ...[...source.matchAll(/\bimport\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g)].map((match) => match[1]),
      ...[...source.matchAll(/\bexport\s+[^"']*?\s+from\s+["']([^"']+)["']/g)].map((match) => match[1]),
      ...[...source.matchAll(/\b(?:open|readFile)\s*\(\s*["']([^"']+)["']/g)].map((match) => match[1]),
    ];
    for (const specifier of specifiers) {
      if (specifier.startsWith("k6") && !specifier.startsWith("k6/../")) continue;
      if (/^(?:https?:)?\/\//i.test(specifier)) {
        errors.push(`${owner} imports remote dependency ${specifier}; only hashed local dependencies are allowed.`);
        continue;
      }
      if (!specifier.startsWith(".")) continue;
      const dependency = normalizePlanPath(path.posix.normalize(path.posix.join(path.posix.dirname(owner), specifier)));
      dependencies.set(dependency, owner);
    }
  }

  const fileBindingNames = new Set(["GRPC_PROTO", "GRPC_PROTOSET", "HTTP_FIXTURE", "DATA_FILE", "FIXTURE_FILE", "CERT_FILE", "GRPC_TLS_CA_CERT", "GRPC_TLS_CLIENT_CERT", "GRPC_TLS_CLIENT_KEY"]);
  for (const phase of ["smoke", "run"]) for (const entry of plan.environmentBindings?.[phase] || []) {
    for (const [name, value] of Object.entries(entry?.values || {})) {
      if (!fileBindingNames.has(name) || typeof value !== "string") continue;
      for (const candidate of value.split(",").map((item) => item.trim()).filter(Boolean)) {
        dependencies.set(normalizePlanPath(candidate.replace(/^\.\//, "")), `environment binding ${entry.id}.${name}`);
      }
    }
  }

  for (const [dependency, owner] of dependencies) {
    if (!dependency.startsWith("docs/performance-tests/")) {
      errors.push(`${owner} references local dependency ${dependency} outside docs/performance-tests/.`);
      continue;
    }
    if (!listed.has(dependency)) {
      errors.push(`${owner} references unlisted local dependency ${dependency}; add it to generatedFiles with its SHA-256 hash.`);
      continue;
    }
    // The normal generated-file pass already verifies bytes and realpath. This
    // explicit existence check keeps closure errors clear when a listed path
    // could not be read.
    if (!generatedContents.has(dependency)) {
      try {
        await readFile(path.resolve(repositoryRoot, dependency));
      } catch {
        errors.push(`Cannot read local dependency ${dependency} referenced by ${owner}.`);
      }
    }
  }
}

function normalizePlanPath(value) {
  return typeof value === "string" ? value.replaceAll("\\", "/") : "";
}

function shellTokens(command) {
  const tokens = [];
  let token = "";
  let quote = null;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote === "'") {
      if (character === "'") quote = null;
      else token += character;
      continue;
    }
    if (quote === '"') {
      if (character === '"') quote = null;
      else if (character === "\\" && index + 1 < command.length) token += command[++index];
      else token += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "\\" && index + 1 < command.length) {
      token += command[++index];
      continue;
    }
    if (/\s/.test(character)) {
      if (token) tokens.push(token);
      token = "";
      continue;
    }
    token += character;
  }
  if (token) tokens.push(token);
  return tokens;
}

function validateArtifacts(artifacts, errors) {
  if (!isObject(artifacts)) {
    errors.push("artifacts must be an object.");
    return;
  }
  for (const key of ["root", "raw", "logs", "canonicalRun"]) requireString(artifacts, key, errors, `artifacts.${key}`);
  requireNonEmptyStringArray(artifacts, "reports", errors, "artifacts.reports");
  if (typeof artifacts.root === "string" && artifacts.root !== "docs/performance-tests") errors.push("artifacts.root must be docs/performance-tests.");
  for (const key of ["raw", "logs", "canonicalRun"]) if (typeof artifacts[key] === "string" && !isSafeArtifactPath(artifacts[key])) errors.push(`artifacts.${key} must stay under docs/performance-tests/.`);
  if (Array.isArray(artifacts.reports)) for (const report of artifacts.reports) if (!isSafeArtifactPath(report)) errors.push("artifacts.reports entries must stay under docs/performance-tests/.");
}

function validateGeneratedFiles(generatedFiles, environmentBindings, errors) {
  if (!Array.isArray(generatedFiles) || generatedFiles.length === 0) {
    errors.push("generatedFiles must list every generated test and SHA-256 hash.");
    return;
  }
  const paths = [];
  for (const [index, generated] of generatedFiles.entries()) {
    if (!isObject(generated)) {
      errors.push(`generatedFiles[${index}] must be an object.`);
      continue;
    }
    requireString(generated, "path", errors, `generatedFiles[${index}].path`);
    if (typeof generated.path === "string") paths.push(generated.path);
    if (typeof generated.path === "string" && !/^docs\/performance-tests\/(?!.*(?:^|\/)\.\.?(?:\/|$)).+/.test(generated.path)) errors.push(`generatedFiles[${index}].path must stay under docs/performance-tests/.`);
    if (typeof generated.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(generated.sha256)) errors.push(`generatedFiles[${index}].sha256 must be a lowercase 64-character SHA-256 digest.`);
    if (generated.kind !== "k6-entrypoint" && generated.kind !== "support") errors.push(`generatedFiles[${index}].kind must be k6-entrypoint or support.`);
    if (!Array.isArray(generated.bindingIds) || generated.bindingIds.some((id) => typeof id !== "string" || !id)) errors.push(`generatedFiles[${index}].bindingIds must be an array of binding ids.`);
    else {
      rejectDuplicates(generated.bindingIds, `generatedFiles[${index}].bindingIds`, errors);
      if (generated.kind === "k6-entrypoint" && generated.bindingIds.length === 0) errors.push(`generatedFiles[${index}].bindingIds must identify at least one smoke/run binding.`);
      if (generated.kind === "support" && generated.bindingIds.length !== 0) errors.push(`generatedFiles[${index}].bindingIds must be empty for a support file.`);
      for (const id of generated.bindingIds) if (!findBinding(environmentBindings, id)) errors.push(`generatedFiles[${index}].bindingIds contains unknown smoke/run binding ${id}.`);
    }
  }
  rejectDuplicates(paths, "generatedFiles[].path", errors);
  const mapped = new Map();
  for (const generated of generatedFiles) for (const id of Array.isArray(generated?.bindingIds) ? generated.bindingIds : []) mapped.set(id, (mapped.get(id) || 0) + 1);
  for (const phase of ["smoke", "run"]) for (const binding of Array.isArray(environmentBindings?.[phase]) ? environmentBindings[phase] : []) if (mapped.get(binding.id) !== 1) errors.push(`environmentBindings.${phase} entry ${binding.id} must map to exactly one generated k6 entrypoint.`);
}

function validateDownloads(downloads, errors) {
  if (!Array.isArray(downloads)) {
    errors.push("downloads must be an array.");
    return;
  }
  for (const [index, download] of downloads.entries()) {
    if (!isObject(download)) {
      errors.push(`downloads[${index}] must be an object.`);
      continue;
    }
    requireString(download, "source", errors, `downloads[${index}].source`);
    requireString(download, "version", errors, `downloads[${index}].version`);
    requireString(download, "reason", errors, `downloads[${index}].reason`);
    if (typeof download.version === "string" && !isPinnedVersion(download.version)) errors.push(`downloads[${index}].version must be an exact pinned semantic version.`);
    if (download.digest !== null && (typeof download.digest !== "string" || !/^sha256:[a-f0-9]{64}$/i.test(download.digest))) errors.push(`downloads[${index}].digest must be null or an exact SHA-256 digest.`);
  }
}

function validateGrafana(plan, errors) {
  const { grafana, downloads } = plan;
  if (!isObject(grafana)) {
    errors.push("grafana configuration is required for self-hosted-grafana.");
    return;
  }
  if (grafana.daemonVerified !== true) errors.push("grafana.daemonVerified must be true.");
  requireString(grafana, "daemonProvider", errors, "grafana.daemonProvider");
  if (grafana.experimentalPrometheusOutputAcknowledged !== true) errors.push("grafana.experimentalPrometheusOutputAcknowledged must be true.");
  requireString(grafana, "projectName", errors, "grafana.projectName");
  if (typeof grafana.projectName === "string" && !/^[a-z0-9][a-z0-9_-]*$/.test(grafana.projectName)) errors.push("grafana.projectName must be a plan/run-specific Compose project identifier.");
  if (grafana.preserveVolumes !== true) errors.push("grafana.preserveVolumes must be true.");
  if (!Array.isArray(grafana.images) || grafana.images.length === 0) errors.push("grafana.images must be a non-empty array.");
  else for (const [index, image] of grafana.images.entries()) {
    if (!isObject(image)) {
      errors.push(`grafana.images[${index}] must be an object.`);
      continue;
    }
    requireString(image, "name", errors, `grafana.images[${index}].name`);
    requireString(image, "version", errors, `grafana.images[${index}].version`);
    if (typeof image.version === "string" && !isPinnedVersion(image.version)) errors.push(`grafana.images[${index}].version must be an exact non-floating version.`);
    if (image.digest !== null && (typeof image.digest !== "string" || !/^sha256:[a-f0-9]{64}$/i.test(image.digest))) errors.push(`grafana.images[${index}].digest must be null or an exact SHA-256 digest.`);
    if (Array.isArray(downloads) && !downloads.some((download) => isObject(download) && download.source === image.name && download.version === image.version && download.digest === image.digest)) errors.push(`grafana.images[${index}] must have an exact matching downloads entry.`);
  }
  const runBindings = Array.isArray(plan.environmentBindings?.run) ? plan.environmentBindings.run : [];
  for (const [index, binding] of runBindings.entries()) {
    if (binding?.values?.K6_PROMETHEUS_RW_TREND_STATS !== "avg,p(50),p(95),p(99)") errors.push(`environmentBindings.run[${index}].values.K6_PROMETHEUS_RW_TREND_STATS must be avg,p(50),p(95),p(99) for the approved Grafana dashboard.`);
    if (typeof binding?.values?.K6_PROMETHEUS_RW_SERVER_URL !== "string" || !/^http:\/\/(?:localhost|127(?:\.\d{1,3}){3}|\[::1]):\d+\/api\/v1\/write$/.test(binding.values.K6_PROMETHEUS_RW_SERVER_URL)) errors.push(`environmentBindings.run[${index}].values.K6_PROMETHEUS_RW_SERVER_URL must be the approved loopback Prometheus remote-write endpoint.`);
    if (!/(?:^|\s)(?:-o|--out)(?:=|\s+)experimental-prometheus-rw(?:\s|$)/.test(plan.commands?.run?.[index] || "")) errors.push(`commands.run[${index}] must enable the experimental-prometheus-rw output.`);
  }
  const reportBindings = Array.isArray(plan.environmentBindings?.report) ? plan.environmentBindings.report : [];
  if (!reportBindings.some((binding) => binding?.values?.COMPOSE_PROJECT_NAME === grafana.projectName)) errors.push("An environmentBindings.report entry must bind COMPOSE_PROJECT_NAME to grafana.projectName.");
  if (!plan.commands?.start?.some((command) => command.includes(grafana.projectName) && /compose\b.*\bup\b/.test(command))) errors.push("commands.start must start the approved plan/run-specific Grafana Compose project.");
  if (!plan.commands?.cleanup?.some((command) => command.includes(grafana.projectName) && /compose\b.*\bdown\b/.test(command) && !/--volumes\b/.test(command))) errors.push("commands.cleanup must close the approved Grafana Compose project without deleting retained volumes.");
}

function validateEnvironmentNames(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array of environment-variable names.`);
    return;
  }
  for (const entry of value) if (typeof entry !== "string" || !ENVIRONMENT_NAME.test(entry)) errors.push(`${label} entries must be environment-variable name identifiers.`);
  rejectDuplicates(value, label, errors);
}

function requireString(object, key, errors, label = key) {
  if (typeof object[key] !== "string" || !object[key].trim()) errors.push(`${label} must be a non-empty string.`);
}

function requireStringArray(object, key, errors, label = key) {
  if (!Array.isArray(object[key]) || object[key].some((entry) => typeof entry !== "string" || !entry.trim())) errors.push(`${label} must be an array of non-empty strings.`);
}

function requireNonEmptyStringArray(object, key, errors, label = key) {
  requireStringArray(object, key, errors, label);
  if (Array.isArray(object[key]) && object[key].length === 0) errors.push(`${label} must not be empty.`);
}

function requirePositiveInteger(object, key, errors, label) {
  if (!Number.isInteger(object[key]) || object[key] <= 0) errors.push(`${label} must be a positive integer.`);
}

function requirePositiveNumber(object, key, errors, label) {
  if (typeof object[key] !== "number" || !Number.isFinite(object[key]) || object[key] <= 0) errors.push(`${label} must be a positive number.`);
}

function requireDuration(object, key, errors, label) {
  if (typeof object[key] !== "string" || !DURATION.test(object[key]) || /^0+(?:\.0+)?(?:ms|s|m|h)$/.test(object[key])) errors.push(`${label} must be a positive k6 duration.`);
}

function requireCommandList(commands, key, errors) {
  if (!Array.isArray(commands[key]) || commands[key].length === 0 || commands[key].some((entry) => !isExecutableCommand(entry))) errors.push(`commands.${key} must be a non-empty array of exact executable command strings without placeholders.`);
}

function isExecutableCommand(value) {
  return typeof value === "string" && value.trim().length > 2 && !/[\r\n\0]/.test(value) && !/(?:<[^>]+>|\bTODO\b|repository-supported|stop only|approved .* command)/i.test(value);
}

function classifyAddress(address, protocol) {
  try {
    const url = protocol === "http" ? new URL(address) : new URL(`http://${address}`);
    if (protocol === "http" && !["http:", "https:"].includes(url.protocol)) return "invalid";
    if (!url.port && protocol === "grpc") return "invalid";
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (host === "localhost" || host === "::1" || isIpv4InRange(host, 127)) return "loopback";
    if (isPrivateIp(host) || /^[a-z0-9][a-z0-9_-]*$/i.test(host) || /^(?:host|gateway)\.docker\.internal$/.test(host)) return "container";
    return "remote";
  } catch {
    return "invalid";
  }
}

function addressHost(address, protocol) {
  try {
    const url = protocol === "http" ? new URL(address) : new URL(`http://${address}`);
    return url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return undefined;
  }
}

function isPrivateIp(host) {
  const octets = parseIpv4(host);
  if (octets) return octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 169 && octets[1] === 254);
  return /^f[cd][0-9a-f]*:/i.test(host) || /^fe[89ab][0-9a-f]*:/i.test(host);
}

function isIpv4InRange(host, firstOctet) {
  const octets = parseIpv4(host);
  return Boolean(octets && octets[0] === firstOctet);
}

function parseIpv4(host) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return undefined;
  const octets = host.split(".").map(Number);
  return octets.every((entry) => entry >= 0 && entry <= 255) ? octets : undefined;
}

function isSafeArtifactPath(value) {
  return value.startsWith("docs/performance-tests/") && !value.split("/").includes("..") && !value.includes("\\") && !value.includes("\0");
}

function isPinnedVersion(version) {
  return /^v?\d+(?:\.\d+){2,3}(?:[-+][A-Za-z0-9_.-]+)?$/.test(version);
}

function referencedEnvironmentVariables(command) {
  const names = [];
  for (const match of command.matchAll(/\$(?:\{([A-Z_][A-Z0-9_]*)(?::-[^}]*)?\}|([A-Z_][A-Z0-9_]*))/g)) names.push(match[1] || match[2]);
  return names;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rejectEmbeddedSecrets(value, errors, path = "plan") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectEmbeddedSecrets(entry, errors, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveKey(key) && child !== null && child !== "") errors.push(`${path}.${key} is forbidden; list only its environment-variable name in secretEnvironmentVariables.`);
    rejectEmbeddedSecrets(child, errors, `${path}.${key}`);
  }
}

function isSensitiveKey(key) {
  const normalizedKey = key.replace(/[_-]/g, "").toLowerCase();
  return /^(?:password|passphrase|secret|token|authtoken|accesstoken|refreshtoken|apikey|privatekey|authorization|credential|credentials|cookie|session|sessionid)$/.test(normalizedKey);
}

function rejectNonJson(value, errors, path = "plan", seen = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(`${path} contains a non-finite number.`);
    return;
  }
  if (typeof value !== "object") {
    errors.push(`${path} contains a non-JSON value.`);
    return;
  }
  if (seen.has(value)) {
    errors.push(`${path} contains a cycle.`);
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) value.forEach((entry, index) => rejectNonJson(entry, errors, `${path}[${index}]`, seen));
  else for (const [key, child] of Object.entries(value)) rejectNonJson(child, errors, `${path}.${key}`, seen);
  seen.delete(value);
}

function rejectDuplicates(values, label, errors) {
  const strings = values.filter((value) => typeof value === "string");
  if (new Set(strings).size !== strings.length) errors.push(`${label} must not contain duplicates.`);
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function main() {
  const { file, markdownFile, repositoryRoot } = parseArguments(process.argv.slice(2));
  const plan = JSON.parse(await readFile(file, "utf8"));
  const errors = await validatePlanFiles(plan, { markdownFile, repositoryRoot });
  if (errors.length) {
    process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${JSON.stringify({ valid: true, fingerprint: fingerprintPlan(plan) })}\n`);
}

function parseArguments(args) {
  const file = args[0];
  if (!file || file.startsWith("--")) throw new Error("Usage: validate-plan.mjs <plan.json> --markdown <plan.md> [--root <repository-root>]");
  const options = { file };
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value) throw new Error("Every validator flag requires a value.");
    if (flag === "--markdown") options.markdownFile = value;
    else if (flag === "--root") options.repositoryRoot = value;
    else throw new Error(`Unsupported option ${flag}.`);
  }
  if (!options.markdownFile) throw new Error("--markdown is required to verify JSON/Markdown agreement.");
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
