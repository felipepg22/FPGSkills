import { check } from "k6";
import { Client, Stream } from "k6/net/grpc";
import { Counter, Rate, Trend } from "k6/metrics";
import { buildSummaryOutputs, SUMMARY_TREND_STATS } from "./lib/reporter.js";

const planId = required("PLAN_ID");
const planFingerprint = requiredFingerprint();
const runId = required("RUN_ID");
const caseId = required("CASE_ID");
const scenarioName = required("SCENARIO_NAME");
const address = requiredLocalGrpcAddress("GRPC_ADDRESS");
const method = required("GRPC_METHOD");
const rpcType = required("GRPC_STREAM_TYPE");
if (!["server", "client", "bidi"].includes(rpcType)) throw new Error("GRPC_STREAM_TYPE must be server, client, or bidi");
const reflection = requiredBoolean("GRPC_REFLECTION");
const plaintext = requiredBoolean("GRPC_PLAINTEXT");
const proto = __ENV.GRPC_PROTO;
const protoset = __ENV.GRPC_PROTOSET;
const client = new Client();
if (!reflection) {
  if (protoset) client.loadProtoset(protoset);
  else {
    if (!proto) throw new Error("GRPC_PROTO or GRPC_PROTOSET is required when reflection is disabled");
    client.load(required("GRPC_IMPORT_PATHS").split(",").map((entry) => entry.trim()), ...proto.split(",").map((entry) => entry.trim()));
  }
}

const wholeStreamDuration = new Trend("grpc_stream_duration", true);
const timeToFirstMessage = new Trend("grpc_stream_time_to_first_message", true);
const interMessageGap = new Trend("grpc_stream_inter_message_gap", true);
const cumulativeArrivalLatency = new Trend("grpc_stream_arrival_latency", true);
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

export default async function () {
  const payloads = JSON.parse(required("GRPC_PAYLOADS"));
  if (!Array.isArray(payloads) || payloads.length === 0) throw new Error("GRPC_PAYLOADS must be a non-empty JSON array");
  if (rpcType === "server" && payloads.length !== 1) throw new Error("Server-streaming RPCs require exactly one request payload");

  const timeoutMs = positiveInteger("STREAM_TIMEOUT_MS");
  const messageLimit = nonNegativeInteger("STREAM_MESSAGE_LIMIT");
  const minimumMessages = nonNegativeInteger("STREAM_MIN_MESSAGES");
  const termination = required("STREAM_TERMINATION");
  if (!["server-end", "message-limit", "either"].includes(termination)) throw new Error("STREAM_TERMINATION must be server-end, message-limit, or either");
  if (termination === "server-end" && messageLimit !== 0) throw new Error("STREAM_MESSAGE_LIMIT must be 0 for STREAM_TERMINATION=server-end");
  if (termination !== "server-end" && messageLimit === 0) throw new Error("A positive STREAM_MESSAGE_LIMIT is required for message-limit/either termination");

  const metricTags = tags();
  let connected = false;
  let stream;
  let requestSideEnded = false;
  let outcomeRecorded = false;
  try {
    client.connect(address, connectionOptions());
    connected = true;
    stream = new Stream(client, method, { metadata: requestMetadata() });
    operationRequests.add(1, metricTags);
    const started = Date.now();
    let firstMessageAt;
    let previousMessageAt;
    let received = 0;
    let messagesValid = true;
    let settled = false;

    await new Promise((resolve, reject) => {
      const finish = (error, cancel = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const valid = !error && messagesValid && received >= minimumMessages;
        if (valid) wholeStreamDuration.add(Date.now() - started, metricTags);
        operationFailed.add(!valid, metricTags);
        outcomeRecorded = true;
        if (cancel) {
          if (!requestSideEnded) requestSideEnded = safeEnd(stream);
          if (connected) {
            safeClose(client);
            connected = false;
          }
        }
        if (error) reject(error);
        else if (!valid) reject(new Error(`Stream received ${received} messages; expected at least ${minimumMessages}`));
        else resolve();
      };
      const timer = setTimeout(() => finish(new Error(`Stream exceeded ${timeoutMs}ms`), true), timeoutMs);

      stream.on("data", (message) => {
        const now = Date.now();
        received += 1;
        const messageValid = check(message, { [`${method}: received valid message`]: (value) => value !== null && value !== undefined });
        messagesValid = messageValid && messagesValid;
        if (messageValid && firstMessageAt === undefined) {
          firstMessageAt = now;
          timeToFirstMessage.add(now - started, metricTags);
        }
        if (messageValid) cumulativeArrivalLatency.add(now - started, metricTags);
        if (messageValid && previousMessageAt !== undefined) interMessageGap.add(now - previousMessageAt, metricTags);
        previousMessageAt = now;
        if (messageLimit > 0 && received >= messageLimit && termination !== "server-end") finish(undefined, true);
      });
      stream.on("error", (error) => finish(error, true));
      stream.on("end", () => finish(undefined, false));

      try {
        for (const payload of payloads) stream.write(payload);
        if (rpcType === "client" || rpcType === "bidi") {
          stream.end();
          requestSideEnded = true;
        }
      } catch (error) {
        finish(error, true);
      }
    });
  } catch (error) {
    if (!outcomeRecorded) operationFailed.add(true, metricTags);
    throw error;
  } finally {
    if (stream && !requestSideEnded) requestSideEnded = safeEnd(stream);
    if (connected) safeClose(client);
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

function tags() {
  return { case: caseId, operation: method, rpc_type: rpcType, scenario: scenarioName };
}

function requestMetadata() {
  const mode = required("AUTH_MODE");
  if (mode === "none") return {};
  if (mode !== "bearer") throw new Error("AUTH_MODE must be none or bearer");
  return { authorization: `Bearer ${required("AUTH_TOKEN")}` };
}

function connectionOptions() {
  const result = { plaintext, reflect: reflection, timeout: required("GRPC_CONNECT_TIMEOUT") };
  if (reflection) result.reflectMetadata = requestMetadata();
  return result;
}

function safeEnd(stream) {
  try {
    stream.end();
    return true;
  } catch {
    return false;
  }
}

function safeClose(grpcClient) {
  try {
    grpcClient.close();
  } catch {
    // The stream error path can already have closed the underlying connection.
  }
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

function nonNegativeInteger(name) {
  const value = Number(required(name));
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function positiveInteger(name) {
  const value = nonNegativeInteger(name);
  if (value === 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function fraction(name) {
  const value = Number(required(name));
  if (!Number.isFinite(value) || value <= 0 || value > 1) throw new Error(`${name} must be greater than 0 and at most 1`);
  return value;
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
