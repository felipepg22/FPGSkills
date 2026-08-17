import { check, group, sleep } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";
import { buildSummaryOutputs, SUMMARY_TREND_STATS } from "./lib/reporter.js";

const planId = required("PLAN_ID");
const planFingerprint = requiredFingerprint();
const runId = required("RUN_ID");
const caseId = required("CASE_ID");
const scenarioName = required("SCENARIO_NAME");
const baseUrl = requiredLocalHttpUrl("TARGET_URL");
const journey = required("JOURNEY_NAME");
const safetyErrorRate = fraction("SAFETY_ERROR_RATE");
const safetyDelay = required("SAFETY_DELAY_ABORT_EVAL");
const thinkTime = nonNegativeNumber("THINK_TIME");
const steps = [
  { name: "health", path: "/health", check: (response) => response.status >= 200 && response.status < 300 },
];
const durations = Object.fromEntries(steps.map((step) => [step.name, new Trend(`${metricName(step.name)}_duration`, true)]));
const stepRequests = Object.fromEntries(steps.map((step) => [step.name, new Counter(`${metricName(step.name)}_requests`)]));
const stepFailed = Object.fromEntries(steps.map((step) => [step.name, new Rate(`${metricName(step.name)}_failed`)]));
const operationRequests = new Counter("operation_requests");
const operationFailed = new Rate("operation_failed");

export const options = {
  scenarios: {
    approved: {
      ...approvedScenario(),
    },
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
  tags: { testid: runId },
  thresholds: {
    operation_failed: [{ threshold: `rate<${safetyErrorRate}`, abortOnFail: true, delayAbortEval: safetyDelay }],
  },
};

export default function () {
  group(journey, () => {
    for (const step of steps) {
      const response = http.get(`${baseUrl}${step.path}`, {
        headers: authorizationHeaders(),
        tags: { case: caseId, operation: step.name, scenario: scenarioName },
      });
      operationRequests.add(1, { case: caseId, operation: step.name, scenario: scenarioName });
      stepRequests[step.name].add(1, { case: caseId, operation: step.name, scenario: scenarioName });
      const valid = check(response, { [`${step.name}: expected response`]: step.check });
      if (valid) durations[step.name].add(response.timings.duration, { case: caseId, operation: step.name, scenario: scenarioName });
      operationFailed.add(!valid, { case: caseId, operation: step.name, scenario: scenarioName });
      stepFailed[step.name].add(!valid, { case: caseId, operation: step.name, scenario: scenarioName });
      if (thinkTime > 0) sleep(thinkTime);
    }
  });
}

export function handleSummary(data) {
  return buildSummaryOutputs(data, {
    title: `Performance report: ${journey}`,
    planId,
    planFingerprint,
    target: baseUrl,
    scenario: scenarioName,
  });
}

function authorizationHeaders() {
  const mode = required("AUTH_MODE");
  if (mode === "none") return {};
  if (mode !== "bearer") throw new Error("AUTH_MODE must be none or bearer");
  return { Authorization: `Bearer ${required("AUTH_TOKEN")}` };
}

function nonNegativeNumber(name) {
  const value = Number(required(name));
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`);
  return value;
}

function approvedScenario() {
  const executor = required("EXECUTOR");
  const scenario = JSON.parse(required("SCENARIO_CONFIG"));
  validateScenario(scenario, executor, new Set(["constant-vus", "ramping-vus", "shared-iterations", "per-vu-iterations"]));
  return scenario;
}

function validateScenario(scenario, executor, allowed) {
  const requiredKeys = {
    "constant-vus": ["vus", "duration"],
    "ramping-vus": ["startVUs", "stages"],
    "shared-iterations": ["vus", "iterations", "maxDuration"],
    "per-vu-iterations": ["vus", "iterations", "maxDuration"],
  };
  if (!scenario || typeof scenario !== "object" || Array.isArray(scenario) || scenario.executor !== executor || !allowed.has(executor)) throw new Error("SCENARIO_CONFIG must be an approved closed executor object matching EXECUTOR");
  for (const key of requiredKeys[executor]) if (!(key in scenario)) throw new Error(`SCENARIO_CONFIG.${key} is required for ${executor}`);
  for (const key of ["vus", "iterations"]) if (key in scenario && (!Number.isInteger(scenario[key]) || scenario[key] <= 0)) throw new Error(`SCENARIO_CONFIG.${key} must be a positive integer`);
  if ("startVUs" in scenario && (!Number.isInteger(scenario.startVUs) || scenario.startVUs < 0)) throw new Error("SCENARIO_CONFIG.startVUs must be a non-negative integer");
  for (const key of ["duration", "maxDuration"]) if (key in scenario && (typeof scenario[key] !== "string" || !scenario[key])) throw new Error(`SCENARIO_CONFIG.${key} must be a duration string`);
  if ("stages" in scenario && (!Array.isArray(scenario.stages) || scenario.stages.length === 0 || scenario.stages.some((stage) => !stage || typeof stage.duration !== "string" || !stage.duration || !Number.isFinite(stage.target) || stage.target < 0))) throw new Error("SCENARIO_CONFIG.stages must contain duration and non-negative target values");
}

function metricName(value) {
  const safe = String(value).replace(/[^A-Za-z0-9_]/g, "_").slice(0, 110);
  return /^[A-Za-z_]/.test(safe) ? safe : `operation_${safe}`;
}

function required(name) {
  const value = __ENV[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required by the approved plan`);
  return value.trim();
}

function requiredFingerprint() {
  const value = required("PLAN_FINGERPRINT");
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error("PLAN_FINGERPRINT must be a lowercase SHA-256 fingerprint");
  return value;
}

function fraction(name) {
  const value = Number(required(name));
  if (!Number.isFinite(value) || value <= 0 || value > 1) throw new Error(`${name} must be greater than 0 and at most 1`);
  return value;
}

function requiredLocalHttpUrl(name) {
  const value = required(name);
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`${name} must use HTTP or HTTPS`);
  if (parsed.username || parsed.password) throw new Error(`${name} must not embed URL credentials`);
  validateApprovedHost(parsed.hostname);
  return value.replace(/\/$/, "");
}

function validateApprovedHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const locality = required("TARGET_LOCALITY");
  if (locality === "loopback") {
    if (!(host === "localhost" || host === "::1" || isLoopbackIpv4(host))) throw new Error("TARGET_URL does not match approved loopback locality");
    return;
  }
  if (locality === "container") {
    if (host !== required("APPROVED_CONTAINER_HOST").toLowerCase()) throw new Error("TARGET_URL host does not match APPROVED_CONTAINER_HOST");
    return;
  }
  throw new Error("TARGET_LOCALITY must be loopback or container");
}

function isLoopbackIpv4(host) {
  const parts = host.split(".").map(Number);
  return parts.length === 4 && parts[0] === 127 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
}
