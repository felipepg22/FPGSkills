export const SUMMARY_TREND_STATS = ["avg", "min", "med", "p(50)", "p(95)", "p(99)", "max", "count"];

export function buildSummaryOutputs(data, context = {}) {
  const environment = typeof __ENV === "object" && __ENV !== null ? __ENV : {};
  const resultDir = context.resultDir || environment.K6_RESULTS_DIR || ".";
  return {
    [`${resultDir}/summary.json`]: `${JSON.stringify(data, null, 2)}\n`,
    [`${resultDir}/report.md`]: renderMarkdown(data, context),
  };
}

export function renderMarkdown(data, context = {}, deviations = {}) {
  const model = buildReportModel(data, context, deviations);
  const lines = [
    `# ${escapeHeading(model.context.title || "Performance test report")}`,
    "",
    `- Generated: ${inline(model.context.generatedAt || new Date().toISOString())}`,
    `- Plan: ${inline(model.context.planId || "not recorded")}`,
    `- Fingerprint: ${inline(model.context.planFingerprint || "not recorded")}`,
    `- Target: ${inline(model.context.target || "not recorded")}`,
    `- Scenario: ${inline(model.context.scenario || "not recorded")}`,
    `- Run duration: ${format(model.durationSeconds)}${model.durationSeconds === undefined ? "" : " s"}`,
    `- Verdict: ${Array.isArray(model.context.slos) && model.context.slos.length ? "evaluate only the supplied SLOs" : "baseline; no SLO verdict"}`,
    "",
    "## Key indicators",
    "",
    `- Throughput: ${model.throughput ? `${format(model.throughput.value)} ${model.throughput.unit} (${inline(model.throughput.metric)})` : "unavailable"}`,
    `- Error rate: ${model.errorRate ? `${formatPercent(model.errorRate.value)} (${inline(model.errorRate.metric)})` : "unavailable"}`,
    "",
    "## Metrics",
    "",
    "| Metric | Type | Unit | Samples | Mean | p50 (median) | p95 | p99 | Min | Max | Std dev | Rate / throughput |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const metric of model.metrics) {
    const p99Note = metric.p99Exploratory ? " ⚠ exploratory" : "";
    lines.push(`| ${escapeCell(metric.name)} | ${escapeCell(metric.type)} | ${escapeCell(metric.unit)} | ${format(metric.samples)} | ${format(metric.mean)} | ${format(metric.p50)} | ${format(metric.p95)} | ${format(metric.p99)}${p99Note} | ${format(metric.min)} | ${format(metric.max)} | ${format(metric.stddev)} | ${metric.type === "rate" ? formatPercent(metric.rate) : format(metric.throughput)} |`);
  }
  if (model.metrics.some((metric) => metric.p99Exploratory)) {
    lines.push("", "> p99 is exploratory for marked metrics because fewer than 1,000 samples were available.");
  }
  lines.push("", "## Interpretation", "", "Correlate these results with the approved workload, environment fingerprint, functional checks, instrumentation gaps, and evidence-backed bottleneck hypotheses. Do not infer a pass/fail verdict without a conversation-supplied SLO.", "");
  return `${lines.join("\n")}\n`;
}

export function normalizeMetrics(data) {
  if (Array.isArray(data?.results?.metrics)) {
    const checks = Array.isArray(data.results.checks?.metrics) ? data.results.checks.metrics : [];
    return [...data.results.metrics, ...checks];
  }
  if (data?.metrics && typeof data.metrics === "object") {
    return Object.entries(data.metrics).map(([name, metric]) => ({ name, ...metric }));
  }
  return [];
}

export function buildReportModel(data, context = {}, deviations = {}) {
  const durationSeconds = firstNumber(context.durationSeconds, data?.config?.duration, millisecondsToSeconds(data?.state?.testRunDurationMs));
  const metrics = normalizeMetrics(data).map((metric) => normalizeMetric(metric, deviations, durationSeconds));
  const throughputMetric = selectMetric(metrics, ["operation_requests", "http_reqs", "grpc_reqs", "iterations"], "counter");
  const errorMetric = selectMetric(metrics, ["operation_failed", "http_req_failed", "checks_failed"], "rate");
  return {
    context,
    durationSeconds,
    metrics,
    throughput: throughputMetric?.throughput === undefined ? undefined : {
      metric: throughputMetric.name,
      unit: throughputMetric.unit === "byte" ? "B/s" : "operations/s",
      value: throughputMetric.throughput,
    },
    errorRate: errorMetric?.rate === undefined ? undefined : { metric: errorMetric.name, value: errorMetric.rate },
  };
}

export function renderCanonicalMarkdown(record) {
  const errors = validateCanonicalRun(record);
  if (errors.length) throw new Error(errors.join("\n"));
  const lines = [
    `# Performance report: ${escapeHeading(record.plan.id)}`,
    "",
    `- Run: ${inline(record.run.id)}`,
    `- Status: ${inline(record.run.status)}`,
    `- Plan fingerprint: ${inline(record.plan.fingerprint)}`,
    `- Started: ${inline(record.run.startedAt)}`,
    `- Ended: ${inline(record.run.endedAt)}`,
    `- Campaign wall-clock time: ${format(record.run.wallClockMs)} ms`,
    `- Scenario time: ${format(record.run.scenarioDurationMs)} ms`,
    `- Target: ${inline(record.environment.target)}`,
    `- k6: ${inline(record.environment.k6Version)}`,
    `- Verdict: ${record.slos.length ? "evaluate only the supplied SLOs" : "baseline; no SLO verdict"}`,
    "",
    "## Per-case and per-scenario metrics",
    "",
    "| Case | Operation | Scenario | Measurement | Successful samples | Total samples | Mean | p50 (median) | p95 | p99 | Min | Max | Std dev | Throughput/s | Error rate |",
    "|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const metric of record.metrics) {
    const p99Note = metric.p99Exploratory ? " ⚠ exploratory" : "";
    lines.push(`| ${escapeCell(metric.case)} | ${escapeCell(metric.operation)} | ${escapeCell(metric.scenario)} | ${escapeCell(metric.measurement || "latency")} | ${format(metric.successfulSamples)} | ${format(metric.sampleCount)} | ${format(metric.mean)} | ${format(metric.p50Median)} | ${format(metric.p95)} | ${format(metric.p99)}${p99Note} | ${format(metric.min)} | ${format(metric.max)} | ${format(metric.standardDeviation)} | ${format(metric.throughputPerSecond)} | ${formatPercent(metric.errorRate)} |`);
  }
  if (record.metrics.some((metric) => metric.p99Exploratory)) lines.push("", "> p99 is exploratory for marked rows because fewer than 1,000 successful samples were available.");
  lines.push(
    "",
    "## Coverage and safety",
    "",
    `- Incomplete coverage: ${record.run.incompleteCoverage.length ? record.run.incompleteCoverage.map(inline).join("; ") : "none"}`,
    `- Safety stops: ${record.safetyStops.length ? record.safetyStops.map((entry) => inline(typeof entry === "string" ? entry : JSON.stringify(entry))).join("; ") : "none triggered"}`,
    `- Instrumentation gaps: ${record.instrumentationGaps.length ? record.instrumentationGaps.map(inline).join("; ") : "none recorded"}`,
    "",
    "## Bottleneck analysis",
    "",
    `- Observations: ${renderItems(record.analysis.observations)}`,
    `- Correlations: ${renderItems(record.analysis.correlations)}`,
    `- Hypotheses: ${renderItems(record.analysis.hypotheses)}`,
    `- Confirmed causes: ${renderItems(record.analysis.confirmedCauses)}`,
    "",
  );
  return `${lines.join("\n")}\n`;
}

export function validateCanonicalRun(record) {
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) return ["Canonical run must be an object."];
  if (record.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  if (!record.plan || typeof record.plan.id !== "string" || !record.plan.id || !/^sha256:[a-f0-9]{64}$/.test(record.plan.fingerprint || "")) errors.push("plan.id and a lowercase SHA-256 plan.fingerprint are required.");
  if (!record.run || typeof record.run.id !== "string" || !record.run.id) errors.push("run.id is required.");
  if (!record.run || !["complete", "partial", "aborted", "blocked"].includes(record.run.status)) errors.push("run.status is invalid.");
  for (const key of ["wallClockMs", "scenarioDurationMs"]) if (!finiteNonNegative(record.run?.[key])) errors.push(`run.${key} must be finite and non-negative.`);
  if (!Array.isArray(record.run?.incompleteCoverage)) errors.push("run.incompleteCoverage must be an array.");
  for (const key of ["startedAt", "endedAt"]) if (!isIsoTimestamp(record.run?.[key])) errors.push(`run.${key} must be an ISO timestamp.`);
  if (!Number.isNaN(Date.parse(record.run?.startedAt)) && !Number.isNaN(Date.parse(record.run?.endedAt)) && Date.parse(record.run.endedAt) < Date.parse(record.run.startedAt)) errors.push("run.endedAt may not precede startedAt.");
  validateCanonicalEnvironment(record.environment, errors);
  validateCanonicalWorkload(record.workload, errors);
  if (!Array.isArray(record.metrics)) errors.push("metrics must be an array.");
  else if (record.metrics.length === 0 && !(record.run?.status === "blocked" && record.run?.incompleteCoverage?.length > 0)) errors.push("metrics must contain at least one per-case/scenario row unless a blocked pre-execution run records incomplete coverage.");
  else for (const [index, metric] of record.metrics.entries()) validateCanonicalMetric(metric, index, errors);
  for (const key of ["functionalChecks", "slos", "safetyStops", "excludedOperations", "instrumentationGaps"]) if (!Array.isArray(record[key])) errors.push(`${key} must be an array.`);
  if (!record.artifacts || typeof record.artifacts !== "object" || Array.isArray(record.artifacts)) errors.push("artifacts must be an object.");
  if (Array.isArray(record.slos)) for (const [index, slo] of record.slos.entries()) if (slo?.source !== "conversation") errors.push(`slos[${index}].source must be conversation.`);
  for (const key of ["observations", "correlations", "hypotheses", "confirmedCauses"]) if (!Array.isArray(record.analysis?.[key])) errors.push(`analysis.${key} must be an array.`);
  rejectCanonicalSecrets(record, errors);
  return errors;
}

function validateCanonicalEnvironment(environment, errors) {
  if (!environment || typeof environment !== "object" || Array.isArray(environment)) {
    errors.push("environment is required.");
    return;
  }
  for (const key of ["gitRevision", "os", "cpu", "applicationProfile", "target", "k6Version"]) if (typeof environment[key] !== "string" || !environment[key]) errors.push(`environment.${key} is required.`);
  if (typeof environment.gitDirty !== "boolean") errors.push("environment.gitDirty must be a boolean.");
  if (!finiteNonNegative(environment.memoryBytes)) errors.push("environment.memoryBytes must be finite and non-negative.");
  if (environment.containerLimits !== null && (!environment.containerLimits || typeof environment.containerLimits !== "object" || Array.isArray(environment.containerLimits))) errors.push("environment.containerLimits must be null or an object.");
}

function validateCanonicalWorkload(workload, errors) {
  if (!workload || typeof workload !== "object" || Array.isArray(workload)) {
    errors.push("workload is required.");
    return;
  }
  for (const key of ["scenario", "model", "executor", "dataVolume"]) if (typeof workload[key] !== "string" || !workload[key]) errors.push(`workload.${key} is required.`);
  if (!Array.isArray(workload.stages)) errors.push("workload.stages must be an array.");
  if (!Number.isInteger(workload.repetition) || workload.repetition <= 0) errors.push("workload.repetition must be a positive integer.");
  if (workload.concurrency !== null && (!Number.isInteger(workload.concurrency) || workload.concurrency <= 0)) errors.push("workload.concurrency must be null or a positive integer.");
  if (workload.arrivalRate !== null && (typeof workload.arrivalRate !== "number" || !Number.isFinite(workload.arrivalRate) || workload.arrivalRate <= 0)) errors.push("workload.arrivalRate must be null or a positive number.");
  if (workload.concurrency === null && workload.arrivalRate === null) errors.push("workload must record concurrency or arrivalRate.");
  if (workload.streamCompletionSemantics !== null && (typeof workload.streamCompletionSemantics !== "string" || !workload.streamCompletionSemantics)) errors.push("workload.streamCompletionSemantics must be null or a non-empty string.");
}

function validateCanonicalMetric(metric, index, errors) {
  for (const key of ["case", "operation", "scenario", "unit"]) if (typeof metric?.[key] !== "string" || !metric[key]) errors.push(`metrics[${index}].${key} is required.`);
  for (const key of ["successfulSamples", "sampleCount"]) if (!Number.isInteger(metric?.[key]) || metric[key] < 0) errors.push(`metrics[${index}].${key} must be a non-negative integer.`);
  for (const key of ["throughputPerSecond", "errorRate"]) if (!finiteNonNegative(metric?.[key])) errors.push(`metrics[${index}].${key} must be finite and non-negative.`);
  const latencyKeys = ["mean", "p50Median", "p95", "p99", "min", "max", "standardDeviation"];
  if (metric?.successfulSamples === 0) {
    for (const key of latencyKeys) if (metric?.[key] !== null) errors.push(`metrics[${index}].${key} must be null when no successful latency samples exist.`);
  } else {
    for (const key of latencyKeys) if (!finiteNonNegative(metric?.[key])) errors.push(`metrics[${index}].${key} must be finite and non-negative.`);
  }
  if (Number.isFinite(metric?.successfulSamples) && Number.isFinite(metric?.sampleCount) && metric.successfulSamples > metric.sampleCount) errors.push(`metrics[${index}].successfulSamples may not exceed sampleCount.`);
  if (Number.isFinite(metric?.errorRate) && metric.errorRate > 1) errors.push(`metrics[${index}].errorRate must be between 0 and 1.`);
  if (typeof metric?.p99Exploratory !== "boolean" || metric.p99Exploratory !== (metric?.successfulSamples < 1000)) errors.push(`metrics[${index}].p99Exploratory must equal successfulSamples < 1000.`);
  const ordered = [metric?.min, metric?.p50Median, metric?.p95, metric?.p99, metric?.max];
  if (ordered.every(Number.isFinite) && ordered.some((value, position) => position > 0 && value < ordered[position - 1])) errors.push(`metrics[${index}] percentile values must be monotonic from min through max.`);
  if (Number.isFinite(metric?.mean) && Number.isFinite(metric?.min) && Number.isFinite(metric?.max) && (metric.mean < metric.min || metric.mean > metric.max)) errors.push(`metrics[${index}].mean must be between min and max.`);
}

function rejectCanonicalSecrets(value, errors, path = "run") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectCanonicalSecrets(entry, errors, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.replace(/[_-]/g, "").toLowerCase();
    if (/^(?:password|passphrase|secret|token|authtoken|accesstoken|refreshtoken|apikey|privatekey|authorization|credential|credentials|cookie|session|sessionid)$/.test(normalizedKey) && child !== null && child !== "") errors.push(`${path}.${key} may not contain a secret value.`);
    rejectCanonicalSecrets(child, errors, `${path}.${key}`);
  }
}

function finiteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isIsoTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function renderItems(items) {
  return items.length ? items.map((entry) => inline(typeof entry === "string" ? entry : JSON.stringify(entry))).join("; ") : "none recorded";
}

function normalizeMetric(metric, deviations, durationSeconds) {
  const values = metric?.values && typeof metric.values === "object" ? metric.values : {};
  const type = String(metric?.type || "unknown").toLowerCase();
  const samples = firstNumber(
    deviations[metric.name]?.count,
    values.count,
    values.total,
    number(values.passes) === undefined || number(values.fails) === undefined ? undefined : values.passes + values.fails,
  );
  const count = number(values.count);
  const reportedThroughput = number(values.rate);
  return {
    name: String(metric?.name || "unnamed"),
    type,
    unit: metric?.contains === "time" ? "ms" : metric?.contains === "data" ? "byte" : "value",
    samples,
    mean: number(values.avg),
    p50: firstNumber(values["p(50)"], values.med),
    p95: number(values["p(95)"]),
    p99: number(values["p(99)"]),
    min: number(values.min),
    max: number(values.max),
    stddev: number(deviations[metric?.name]?.stddev),
    rate: type === "rate" ? number(values.rate) : undefined,
    throughput: type === "counter" ? firstNumber(reportedThroughput, count !== undefined && durationSeconds > 0 ? count / durationSeconds : undefined) : undefined,
    p99Exploratory: type === "trend" && samples !== undefined && samples < 1000,
  };
}

function selectMetric(metrics, preferredNames, type) {
  for (const name of preferredNames) {
    const metric = metrics.find((candidate) => candidate.name === name && candidate.type === type);
    if (metric) return metric;
  }
  return undefined;
}

function isTrend(metric) {
  return String(metric.type).toLowerCase() === "trend";
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function firstNumber(...values) {
  for (const value of values) {
    const numeric = number(value);
    if (numeric !== undefined) return numeric;
  }
  return undefined;
}

function millisecondsToSeconds(value) {
  const milliseconds = number(value);
  return milliseconds === undefined ? undefined : milliseconds / 1000;
}

function format(value) {
  const numeric = number(value);
  if (numeric === undefined) return "—";
  if (Number.isInteger(numeric)) return String(numeric);
  return numeric.toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function formatPercent(value) {
  const numeric = number(value);
  return numeric === undefined ? "—" : `${format(numeric * 100)}%`;
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function escapeHeading(value) {
  return String(value).replaceAll("\n", " ").replace(/^#+\s*/, "");
}

function inline(value) {
  return String(value).replaceAll("\n", " ");
}
