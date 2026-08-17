import { check } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";
import { buildSummaryOutputs, SUMMARY_TREND_STATS } from "./lib/reporter.js";

const planId = required("PLAN_ID");
const planFingerprint = requiredFingerprint();
const runId = required("RUN_ID");
const caseId = required("CASE_ID");
const scenarioName = required("SCENARIO_NAME");
const method = required("HTTP_METHOD").toUpperCase();
const target = requiredLocalHttpUrl("TARGET_URL");
const operation = required("OPERATION_NAME");
const approvedMethods = new Set(required("APPROVED_HTTP_METHODS").split(",").map((entry) => entry.trim().toUpperCase()).filter(Boolean));
if (!approvedMethods.has(method)) throw new Error(`HTTP_METHOD ${method} is not listed in APPROVED_HTTP_METHODS`);
const expectedStatuses = new Set(required("EXPECTED_STATUSES").split(",").map((entry) => Number(entry.trim())));
if ([...expectedStatuses].some((status) => !Number.isInteger(status) || status < 100 || status > 599)) throw new Error("EXPECTED_STATUSES must be a comma-separated list of HTTP status codes");
const body = ["GET", "HEAD", "OPTIONS"].includes(method) ? null : required("HTTP_BODY");
const safetyErrorRate = fraction("SAFETY_ERROR_RATE");
const safetyDelay = required("SAFETY_DELAY_ABORT_EVAL");

const operationDuration = new Trend(`${metricName(operation)}_duration`, true);
const operationRequests = new Counter("operation_requests");
const operationFailed = new Rate("operation_failed");

export const options = {
  scenarios: {
    approved: approvedScenario(),
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
  tags: { testid: runId },
  thresholds: {
    operation_failed: [{ threshold: `rate<${safetyErrorRate}`, abortOnFail: true, delayAbortEval: safetyDelay }],
  },
};

export default function () {
  const metricTags = tags();
  const response = http.request(method, target, body, {
    headers: authorizationHeaders(),
    tags: metricTags,
  });
  operationRequests.add(1, metricTags);
  const valid = check(response, {
    [`${operation}: expected status`]: (value) => expectedStatuses.has(value.status),
  });
  if (valid) operationDuration.add(response.timings.duration, metricTags);
  operationFailed.add(!valid, metricTags);
}

export function handleSummary(data) {
  return buildSummaryOutputs(data, {
    title: `Performance report: ${operation}`,
    planId,
    planFingerprint,
    target,
    scenario: scenarioName,
  });
}

function authorizationHeaders() {
  const mode = required("AUTH_MODE");
  if (mode === "none") return {};
  if (mode !== "bearer") throw new Error("AUTH_MODE must be none or bearer");
  return { Authorization: `Bearer ${required("AUTH_TOKEN")}` };
}

function tags() {
  return { case: caseId, operation, scenario: scenarioName };
}

function approvedScenario() {
  const executor = required("EXECUTOR");
  const scenario = JSON.parse(required("SCENARIO_CONFIG"));
  validateScenario(scenario, executor);
  return scenario;
}

function validateScenario(scenario, executor) {
  const requiredKeys = {
    "constant-vus": ["vus", "duration"],
    "constant-arrival-rate": ["rate", "timeUnit", "duration", "preAllocatedVUs", "maxVUs"],
    "ramping-vus": ["startVUs", "stages"],
    "ramping-arrival-rate": ["startRate", "timeUnit", "preAllocatedVUs", "maxVUs", "stages"],
    "shared-iterations": ["vus", "iterations", "maxDuration"],
    "per-vu-iterations": ["vus", "iterations", "maxDuration"],
  };
  if (!scenario || typeof scenario !== "object" || Array.isArray(scenario) || scenario.executor !== executor || !(executor in requiredKeys)) throw new Error("SCENARIO_CONFIG must be an approved supported executor object matching EXECUTOR");
  for (const key of requiredKeys[executor]) if (!(key in scenario)) throw new Error(`SCENARIO_CONFIG.${key} is required for ${executor}`);
  for (const key of ["vus", "iterations", "preAllocatedVUs", "maxVUs"]) if (key in scenario && (!Number.isInteger(scenario[key]) || scenario[key] <= 0)) throw new Error(`SCENARIO_CONFIG.${key} must be a positive integer`);
  for (const key of ["rate", "startRate"]) if (key in scenario && (!Number.isFinite(scenario[key]) || scenario[key] <= 0)) throw new Error(`SCENARIO_CONFIG.${key} must be positive`);
  if ("startVUs" in scenario && (!Number.isInteger(scenario.startVUs) || scenario.startVUs < 0)) throw new Error("SCENARIO_CONFIG.startVUs must be a non-negative integer");
  for (const key of ["duration", "timeUnit", "maxDuration"]) if (key in scenario && (typeof scenario[key] !== "string" || !scenario[key])) throw new Error(`SCENARIO_CONFIG.${key} must be a duration string`);
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
  return value;
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
