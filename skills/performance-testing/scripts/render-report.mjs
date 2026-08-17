#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { renderCanonicalMarkdown, validateCanonicalRun } from "../assets/k6/lib/reporter.js";

export async function collectRawStatistics(rawFile) {
  const definitions = new Map();
  const series = new Map();
  const input = createInterface({ input: createReadStream(rawFile), crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of input) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid k6 JSON on line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (record.type === "Metric") {
      const metricName = typeof record.data?.name === "string" ? record.data.name : record.metric;
      if (typeof metricName === "string") definitions.set(metricName, { type: record.data?.type, contains: record.data?.contains });
      continue;
    }
    if (record.type !== "Point" || typeof record.metric !== "string" || typeof record.data?.value !== "number" || !Number.isFinite(record.data.value)) continue;
    const tags = normalizeTags(record.data.tags);
    const key = `${record.metric}\0${stableStringify(tags)}`;
    const aggregate = series.get(key) ?? { metric: record.metric, tags, values: [] };
    aggregate.values.push(record.data.value);
    series.set(key, aggregate);
  }

  const finalized = [...series.values()].map((entry) => {
    const definition = definitions.get(entry.metric) || {};
    return { ...entry, type: definition.type || "unknown", contains: definition.contains || "default", ...aggregate(entry.values, definition.type) };
  });
  return { series: finalized, byMetric: combineTrendMetrics(finalized) };
}

export async function collectTrendStatistics(rawFile) {
  return (await collectRawStatistics(rawFile)).byMetric;
}

export const collectTrendDeviation = collectTrendStatistics;

export function buildCanonicalRun(summary, context, rawStatistics) {
  const durationSeconds = context.run?.scenarioDurationMs / 1000 || summary?.config?.duration || summary?.state?.testRunDurationMs / 1000;
  if (!(durationSeconds > 0)) throw new Error("A positive scenario duration is required for throughput calculation.");
  const latencySeries = rawStatistics.series.filter(isSuccessfulLatencySeries);
  const dimensions = new Map();
  for (const series of rawStatistics.series) {
    if (!hasReportDimensions(series) || !["operation_requests", "operation_failed"].includes(series.metric)) continue;
    dimensions.set(reportDimensionKey(series.tags), series.tags);
  }
  for (const latency of latencySeries) dimensions.set(reportDimensionKey(latency.tags), latency.tags);
  const metrics = [];
  for (const tags of dimensions.values()) {
    const matchingLatencies = latencySeries.filter((latency) => sameReportDimensions(latency.tags, tags));
    for (const latency of matchingLatencies.length ? matchingLatencies : [undefined]) {
      const requests = findSeries(rawStatistics.series, "operation_requests", tags);
      const failures = findSeries(rawStatistics.series, "operation_failed", tags);
      const successfulSamples = latency?.count ?? 0;
      const operationAttempts = requests?.sum ?? failures?.total ?? successfulSamples;
      const sampleCount = latency ? successfulSamples : operationAttempts;
      const errorRate = failures?.rate ?? Math.max(0, (operationAttempts - successfulSamples) / Math.max(1, operationAttempts));
      metrics.push({
        case: tags.case,
        operation: tags.operation,
        scenario: tags.scenario,
        measurement: latency?.metric ?? "latency",
        unit: latency ? (latency.contains === "time" ? "ms" : latency.contains) : "ms",
        successfulSamples,
        sampleCount,
        mean: latency?.mean ?? null,
        p50Median: latency?.p50 ?? null,
        p95: latency?.p95 ?? null,
        p99: latency?.p99 ?? null,
        min: latency?.min ?? null,
        max: latency?.max ?? null,
        standardDeviation: latency?.stddev ?? null,
        throughputPerSecond: operationAttempts / durationSeconds,
        errorRate,
        p99Exploratory: successfulSamples < 1000,
      });
    }
  }

  const record = {
    schemaVersion: 1,
    plan: context.plan,
    run: context.run,
    environment: context.environment,
    workload: context.workload,
    metrics,
    functionalChecks: context.functionalChecks,
    slos: context.slos,
    safetyStops: context.safetyStops,
    excludedOperations: context.excludedOperations,
    instrumentationGaps: context.instrumentationGaps,
    artifacts: context.artifacts,
    analysis: context.analysis,
  };
  const errors = validateCanonicalRun(record);
  if (errors.length) throw new Error(errors.join("\n"));
  return record;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const summary = JSON.parse(await readFile(options.summary, "utf8"));
  const context = JSON.parse(await readFile(options.context, "utf8"));
  const rawStatistics = await collectRawStatistics(options.raw);
  const canonical = buildCanonicalRun(summary, context, rawStatistics);
  await writeFile(options["json-output"], `${JSON.stringify(canonical, null, 2)}\n`, "utf8");
  await writeFile(options.output, renderCanonicalMarkdown(canonical), "utf8");
}

function parseArguments(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || !value) throw new Error(usage());
    if (!["summary", "raw", "context", "json-output", "output"].includes(flag.slice(2))) throw new Error(`Unsupported option ${flag}. ${usage()}`);
    parsed[flag.slice(2)] = value;
  }
  for (const required of ["summary", "raw", "context", "json-output", "output"]) if (!parsed[required]) throw new Error(`--${required} is required. ${usage()}`);
  return parsed;
}

function usage() {
  return "Usage: render-report.mjs --summary <file> --raw <file> --context <file> --json-output <run.json> --output <report.md>";
}

function aggregate(values, type) {
  if (type === "trend") return trendStatistics(values);
  if (type === "counter") return { count: values.length, sum: values.reduce((sum, value) => sum + value, 0) };
  if (type === "rate") {
    const matches = values.filter((value) => value !== 0).length;
    return { count: values.length, matches, total: values.length, rate: values.length ? matches / values.length : 0 };
  }
  return { count: values.length, min: Math.min(...values), max: Math.max(...values), value: values.at(-1) };
}

function trendStatistics(values) {
  if (!values.length) return { count: 0, mean: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0, stddev: 0 };
  let mean = 0;
  let m2 = 0;
  values.forEach((value, index) => {
    const delta = value - mean;
    mean += delta / (index + 1);
    m2 += delta * (value - mean);
  });
  const sorted = [...values].sort((left, right) => left - right);
  return {
    count: values.length,
    mean,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    min: sorted[0],
    max: sorted.at(-1),
    stddev: values.length > 1 ? Math.sqrt(m2 / (values.length - 1)) : 0,
  };
}

function percentile(sorted, quantile) {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * quantile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function combineTrendMetrics(series) {
  const grouped = new Map();
  for (const entry of series) {
    if (entry.type !== "trend") continue;
    const values = grouped.get(entry.metric) || [];
    values.push(...entry.values);
    grouped.set(entry.metric, values);
  }
  return Object.fromEntries([...grouped].map(([metric, values]) => [metric, trendStatistics(values)]));
}

function isSuccessfulLatencySeries(series) {
  if (series.type !== "trend" || series.contains !== "time") return false;
  if (!series.tags.case || !series.tags.operation || !series.tags.scenario) return false;
  if (["grpc_operation_duration", "grpc_stream_duration", "grpc_stream_time_to_first_message", "grpc_stream_inter_message_gap", "grpc_stream_arrival_latency"].includes(series.metric)) return true;
  return series.metric.endsWith("_duration") && !/^(?:http_req_|grpc_req_|iteration_|group_)/.test(series.metric);
}

function hasReportDimensions(series) {
  return Boolean(series.tags.case && series.tags.operation && series.tags.scenario);
}

function reportDimensionKey(tags) {
  return `${tags.case}\0${tags.operation}\0${tags.scenario}`;
}

function sameReportDimensions(left, right) {
  return left.case === right.case && left.operation === right.operation && left.scenario === right.scenario;
}

function findSeries(series, metric, tags) {
  return series.find((candidate) => candidate.metric === metric && candidate.tags.case === tags.case && candidate.tags.operation === tags.operation && candidate.tags.scenario === tags.scenario);
}

function normalizeTags(tags) {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return Object.fromEntries(Object.keys(tags).sort().map((key) => [key, String(tags[key])]));
}

function stableStringify(value) {
  return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
