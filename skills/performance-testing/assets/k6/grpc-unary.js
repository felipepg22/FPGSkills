import { check } from "k6";
import { Client, StatusOK } from "k6/net/grpc";
import { Counter, Rate, Trend } from "k6/metrics";
import { buildSummaryOutputs, SUMMARY_TREND_STATS } from "./lib/reporter.js";

const planId = required("PLAN_ID");
const planFingerprint = requiredFingerprint();
const runId = required("RUN_ID");
const caseId = required("CASE_ID");
const scenarioName = required("SCENARIO_NAME");
const address = requiredLocalGrpcAddress("GRPC_ADDRESS");
const method = required("GRPC_METHOD");
const proto = __ENV.GRPC_PROTO;
const protoset = __ENV.GRPC_PROTOSET;
const reflection = requiredBoolean("GRPC_REFLECTION");
const plaintext = requiredBoolean("GRPC_PLAINTEXT");
const client = new Client();
if (!reflection) {
  if (protoset) client.loadProtoset(protoset);
  else {
    if (!proto) throw new Error("GRPC_PROTO or GRPC_PROTOSET is required when reflection is disabled");
    client.load(required("GRPC_IMPORT_PATHS").split(",").map((entry) => entry.trim()), ...proto.split(",").map((entry) => entry.trim()));
  }
}
const operationDuration = new Trend("grpc_operation_duration", true);
const operationRequests = new Counter("operation_requests");
const operationFailed = new Rate("operation_failed");
const safetyErrorRate = fraction("SAFETY_ERROR_RATE");
const safetyDelay = required("SAFETY_DELAY_ABORT_EVAL");

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
  const metricTags = tags();
  let valid = false;
  let started;
  let connected = false;
  try {
    client.connect(address, connectionOptions());
    connected = true;
    started = Date.now();
    operationRequests.add(1, metricTags);
    const response = client.invoke(method, JSON.parse(required("GRPC_PAYLOAD")), {
      metadata: requestMetadata(),
      tags: metricTags,
      timeout: required("GRPC_TIMEOUT"),
    });
    valid = check(response, { [`${method}: status OK`]: (value) => value?.status === StatusOK });
  } finally {
    if (valid && started !== undefined) operationDuration.add(Date.now() - started, metricTags);
    operationFailed.add(!valid, metricTags);
    if (connected) client.close();
  }
}

export function handleSummary(data) {
  return buildSummaryOutputs(data, {
    title: `Performance report: ${method}`,
    planId,
    planFingerprint,
    target: address,
    scenario: scenarioName,
  });
}

function connectionOptions() {
  const result = {
    plaintext,
    reflect: reflection,
    timeout: required("GRPC_CONNECT_TIMEOUT"),
  };
  if (reflection) result.reflectMetadata = requestMetadata();
  return result;
}

function requestMetadata() {
  const mode = required("AUTH_MODE");
  if (mode === "none") return {};
  if (mode !== "bearer") throw new Error("AUTH_MODE must be none or bearer");
  return { authorization: `Bearer ${required("AUTH_TOKEN")}` };
}

function tags() {
  return { case: caseId, operation: method, rpc_type: "unary", scenario: scenarioName };
}

function approvedScenario() {
  const executor = required("EXECUTOR");
  const scenario = JSON.parse(required("SCENARIO_CONFIG"));
  validateScenario(scenario, executor);
  return scenario;
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

function requiredBoolean(name) {
  const value = required(name);
  if (value !== "true" && value !== "false") throw new Error(`${name} must be true or false`);
  return value === "true";
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

function fraction(name) {
  const value = Number(required(name));
  if (!Number.isFinite(value) || value <= 0 || value > 1) throw new Error(`${name} must be greater than 0 and at most 1`);
  return value;
}

function requiredLocalGrpcAddress(name) {
  const value = required(name);
  if (value.includes("://")) throw new Error(`${name} must be host:port without a URL scheme`);
  const match = value.match(/^\[([^\]]+)]:(\d+)$|^([^:]+):(\d+)$/);
  if (!match) throw new Error(`${name} must use host:port without a URL scheme`);
  const port = Number(match[2] || match[4]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${name} must use a port from 1 to 65535`);
  validateApprovedHost(match[1] || match[3]);
  return value;
}

function validateApprovedHost(hostname) {
  const host = hostname.toLowerCase();
  const locality = required("TARGET_LOCALITY");
  if (locality === "loopback") {
    if (!(host === "localhost" || host === "::1" || isLoopbackIpv4(host))) throw new Error("GRPC_ADDRESS does not match approved loopback locality");
    return;
  }
  if (locality === "container") {
    if (host !== required("APPROVED_CONTAINER_HOST").toLowerCase()) throw new Error("GRPC_ADDRESS host does not match APPROVED_CONTAINER_HOST");
    return;
  }
  throw new Error("TARGET_LOCALITY must be loopback or container");
}

function isLoopbackIpv4(host) {
  const parts = host.split(".").map(Number);
  return parts.length === 4 && parts[0] === 127 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
}
