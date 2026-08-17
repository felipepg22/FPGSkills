import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { packageRoot } from "./paths.js";

const execFileAsync = promisify(execFile);

type Plan = ReturnType<typeof validPlan>;

test("validates and fingerprints a complete safe local plan deterministically", async () => {
  const validator = await loadValidator();
  const plan: any = validPlan();
  assert.deepEqual(validator.validatePlan(plan), []);
  assert.equal(validator.fingerprintPlan(plan), validator.fingerprintPlan(structuredClone(plan)));

  const changed = structuredClone(plan);
  changed.application.revision = "f".repeat(40);
  assert.notEqual(validator.fingerprintPlan(plan), validator.fingerprintPlan(changed));
});

test("rejects mutation, remote targets, inferred SLOs, browser metrics, and embedded secrets", async () => {
  const { validatePlan } = await loadValidator();
  const plan: any = validPlan();
  plan.target.address = "https://example.com/health";
  plan.cases[0].mutatesBusinessData = true;
  plan.slos = [{ source: "inferred", metric: "p(95)", scope: "health", comparator: "<", unit: "ms", threshold: 200 }];
  plan.measurements.push("browser experience");
  Object.assign(plan, { credential: "embedded", token: "UPPERCASE_SECRET_VALUE" });
  const errors = validatePlan(plan).join("\n");
  assert.match(errors, /loopback target/);
  assert.match(errors, /mutatesBusinessData/);
  assert.match(errors, /source: conversation/);
  assert.match(errors, /Browser-experience/);
  assert.match(errors, /plan\.credential is forbidden/);
  assert.match(errors, /plan\.token is forbidden/);
});

test("rejects target, case, workload, ambient-binding, and command drift", async () => {
  const { validatePlan } = await loadValidator();
  const misleadingCommand = validPlan();
  misleadingCommand.commands.run[0] = misleadingCommand.commands.run[0]!.replace("AUTH_MODE='none'", "AUTH_MODE='bearer' NOTE='none'");
  assert.match(validatePlan(misleadingCommand).join("\n"), /bind AUTH_MODE to its exact approved value/);

  const plan = validPlan();
  plan.environmentBindings.run[0]!.values.TARGET_URL = "http://127.0.0.1:3000/other";
  plan.environmentBindings.run[0]!.values.CASE_ID = "other";
  plan.environmentBindings.run[0]!.values.SCENARIO_CONFIG = JSON.stringify({ executor: "constant-vus", vus: 2, duration: "30s" });
  plan.environmentBindings.run[0]!.values.RUN_ID = "$AMBIENT_RUN_ID";
  plan.commands.run = [];
  const errors = validatePlan(plan).join("\n");
  assert.match(errors, /target address must match/);
  assert.match(errors, /CASE_ID must match/);
  assert.match(errors, /vus must match workload\.vus/);
  assert.match(errors, /may not use an ambient-value sentinel/);
  assert.match(errors, /commands\.run must be a non-empty array/);
  assert.match(errors, /must be one-to-one/);
});

test("rejects a smoke or run command that invokes an unmapped entrypoint", async () => {
  const { validatePlan } = await loadValidator();
  const plan = validPlan();
  plan.commands.run[0] = plan.commands.run[0]!.replace("docs/performance-tests/k6/health.js", "docs/performance-tests/k6/unlisted.js");
  const errors = validatePlan(plan).join("\n");
  assert.match(errors, /must invoke its mapped generated k6 entrypoint/);
  assert.match(errors, /invokes unlisted or unmapped executable/);
});

test("accepts GET without a body and requires an exact body for an approved read-only POST", async () => {
  const { validatePlan } = await loadValidator();
  const getPlan = validPlan();
  assert.equal("HTTP_BODY" in getPlan.environmentBindings.run[0]!.values, false);
  assert.deepEqual(validatePlan(getPlan), []);

  const postPlan = validPlan();
  for (const entry of [...postPlan.environmentBindings.smoke, ...postPlan.environmentBindings.run]) {
    entry.values.HTTP_METHOD = "POST";
    entry.values.OPERATION_NAME = "POST /search";
    entry.values.HTTP_BODY = '{"query":"approved fixture"}';
  }
  postPlan.cases[0]!.operation = "POST /search";
  refreshEnvironmentAndCommands(postPlan);
  assert.deepEqual(validatePlan(postPlan), []);

  delete postPlan.environmentBindings.run[0]!.values.HTTP_BODY;
  refreshEnvironmentAndCommands(postPlan);
  assert.match(validatePlan(postPlan).join("\n"), /HTTP_BODY is required/);
});

test("accepts only an inspected local container target and binds its exact host", async () => {
  const { validatePlan } = await loadValidator();
  const plan: any = validPlan();
  plan.target = {
    environment: "local",
    locality: "container",
    address: "http://app:3000/health",
    localityEvidence: ["compose.yaml service app", "docker network inspect perf-test returned service address app"],
    daemonVerified: true,
    containerNetwork: "perf-test",
    containerService: "app",
  };
  for (const entry of [...plan.environmentBindings.smoke, ...plan.environmentBindings.run]) {
    entry.values.TARGET_URL = plan.target.address;
    entry.values.TARGET_LOCALITY = "container";
    entry.values.APPROVED_CONTAINER_HOST = "app";
  }
  refreshEnvironmentAndCommands(plan);
  assert.deepEqual(validatePlan(plan), []);
  plan.environmentBindings.run[0]!.values.APPROVED_CONTAINER_HOST = "other";
  refreshEnvironmentAndCommands(plan);
  assert.match(validatePlan(plan).join("\n"), /must match the approved container address host/);
});

test("verifies hashes, binding-scoped requirements, safety wiring, and Markdown agreement", async () => {
  const validator = await loadValidator();
  const temporary = await mkdtemp(path.join(tmpdir(), "performance-plan-"));
  const generatedPath = "docs/performance-tests/k6/health.js";
  const absoluteGenerated = path.join(temporary, generatedPath);
  await mkdir(path.dirname(absoluteGenerated), { recursive: true });
  const source = await readFile(path.join(packageRoot, "assets/k6/http-endpoint.js"));
  await writeFile(absoluteGenerated, source);
  const helperPath = "docs/performance-tests/k6/lib/reporter.js";
  const helper = await readFile(path.join(packageRoot, "assets/k6/lib/reporter.js"));
  await mkdir(path.dirname(path.join(temporary, helperPath)), { recursive: true });
  await writeFile(path.join(temporary, helperPath), helper);

  const plan = validPlan();
  plan.generatedFiles[0]!.sha256 = createHash("sha256").update(source).digest("hex");
  plan.generatedFiles.push({ path: helperPath, sha256: createHash("sha256").update(helper).digest("hex"), kind: "support", bindingIds: [] });
  plan.application.configurationEvidence.push("literal ``` injection attempt");
  const markdownFile = path.join(temporary, "plan.md");
  const markdown = validator.renderPlanMarkdown(plan);
  assert.match(markdown, /````json/);
  await writeFile(markdownFile, markdown, "utf8");
  assert.deepEqual(await validator.validatePlanFiles(plan, { repositoryRoot: temporary, markdownFile }), []);

  plan.generatedFiles[0]!.sha256 = "f".repeat(64);
  assert.match((await validator.validatePlanFiles(plan, { repositoryRoot: temporary, markdownFile })).join("\n"), /hash mismatch/);
});

test("rejects omitted and mutated imported helpers from the generated dependency closure", async () => {
  const validator = await loadValidator();
  const temporary = await mkdtemp(path.join(tmpdir(), "performance-import-closure-"));
  const entrypointPath = "docs/performance-tests/k6/health.js";
  const helperPath = "docs/performance-tests/k6/lib/helper.js";
  const entrypoint = "import { value } from './lib/helper.js';\nexport const options = { thresholds: { operation_failed: [{ threshold: 'rate<0.2', abortOnFail: true }] } };\nexport default function () { return value; }\n";
  const helper = "export const value = 1;\n";
  await mkdir(path.dirname(path.join(temporary, helperPath)), { recursive: true });
  await writeFile(path.join(temporary, entrypointPath), entrypoint, "utf8");
  await writeFile(path.join(temporary, helperPath), helper, "utf8");
  const plan = validPlan();
  plan.generatedFiles[0]!.sha256 = createHash("sha256").update(entrypoint).digest("hex");
  assert.match((await validator.validatePlanFiles(plan, { repositoryRoot: temporary })).join("\n"), /references unlisted local dependency/);

  plan.generatedFiles.push({ path: helperPath, sha256: createHash("sha256").update(helper).digest("hex"), kind: "support", bindingIds: [] });
  assert.deepEqual(await validator.validatePlanFiles(plan, { repositoryRoot: temporary }), []);
  await writeFile(path.join(temporary, helperPath), "export const value = 2;\n", "utf8");
  assert.match((await validator.validatePlanFiles(plan, { repositoryRoot: temporary })).join("\n"), /hash mismatch/);
});

test("keeps endpoint and journey requirements isolated in a whole-application plan", async () => {
  const validator = await loadValidator();
  const temporary = await mkdtemp(path.join(tmpdir(), "performance-whole-app-"));
  const plan = wholeApplicationPlan();
  for (const generated of plan.generatedFiles) {
    const absolute = path.join(temporary, generated.path);
    await mkdir(path.dirname(absolute), { recursive: true });
    const asset = generated.kind === "support" ? "lib/reporter.js" : generated.path.endsWith("journey.js") ? "http-journey.js" : "http-endpoint.js";
    const source = await readFile(path.join(packageRoot, "assets/k6", asset));
    await writeFile(absolute, source);
    generated.sha256 = createHash("sha256").update(source).digest("hex");
  }
  assert.deepEqual(validator.validatePlan(plan), []);
  assert.deepEqual(await validator.validatePlanFiles(plan, { repositoryRoot: temporary }), []);
});

test("rejects a generated-file symlink that resolves outside the approved artifact tree", async () => {
  const validator = await loadValidator();
  const temporary = await mkdtemp(path.join(tmpdir(), "performance-symlink-plan-"));
  const outside = path.join(await mkdtemp(path.join(tmpdir(), "performance-symlink-outside-")), "test.js");
  const generatedPath = path.join(temporary, "docs/performance-tests/k6/health.js");
  await mkdir(path.dirname(generatedPath), { recursive: true });
  const source = "export const options = { thresholds: { operation_failed: [{ threshold: 'rate<0.2', abortOnFail: true }] } };\n";
  await writeFile(outside, source, "utf8");
  await symlink(outside, generatedPath);
  const plan = validPlan();
  plan.generatedFiles[0]!.sha256 = createHash("sha256").update(source).digest("hex");
  assert.match((await validator.validatePlanFiles(plan, { repositoryRoot: temporary })).join("\n"), /resolves outside docs\/performance-tests/);
});

test("renders canonical Markdown/JSON from real-format k6 raw records with exact statistics", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "performance-report-"));
  const summaryFile = path.join(temporary, "summary.json");
  const rawFile = path.join(temporary, "raw.json");
  const contextFile = path.join(temporary, "context.json");
  const jsonOutput = path.join(temporary, "run.json");
  const markdownOutput = path.join(temporary, "report.md");
  await writeFile(summaryFile, JSON.stringify({ config: { duration: 2 } }), "utf8");
  await writeFile(rawFile, rawFixture([100, 200], 3, [0, 0, 1]), "utf8");
  await writeFile(contextFile, JSON.stringify(validContext()), "utf8");
  await execFileAsync(process.execPath, [
    path.join(packageRoot, "scripts/render-report.mjs"),
    "--summary", summaryFile,
    "--raw", rawFile,
    "--context", contextFile,
    "--json-output", jsonOutput,
    "--output", markdownOutput,
  ]);
  const canonical = JSON.parse(await readFile(jsonOutput, "utf8"));
  const metric = canonical.metrics[0];
  assert.equal(metric.successfulSamples, 2);
  assert.equal(metric.sampleCount, 2);
  assert.equal(metric.mean, 150);
  assert.equal(metric.p50Median, 150);
  assert.equal(metric.p95, 195);
  assert.equal(metric.p99, 199);
  assert.equal(metric.standardDeviation, Math.sqrt(5000));
  assert.equal(metric.throughputPerSecond, 1.5);
  assert.equal(metric.errorRate, 1 / 3);
  assert.equal(metric.p99Exploratory, true);
  const markdown = await readFile(markdownOutput, "utf8");
  assert.match(markdown, /p50 \(median\)/);
  assert.match(markdown, /70\.711/);
  assert.match(markdown, /exploratory/);
});

test("reports all-failed, blocked pre-execution, and multi-message stream measurements", async () => {
  const reporter = await loadRunReporter();
  const temporary = await mkdtemp(path.join(tmpdir(), "performance-edge-report-"));

  const allFailedFile = path.join(temporary, "all-failed.json");
  await writeFile(allFailedFile, rawFixture([], 2, [1, 1]), "utf8");
  const allFailed = reporter.buildCanonicalRun({ config: { duration: 2 } }, validContext({ status: "aborted" }), await reporter.collectRawStatistics(allFailedFile));
  assert.equal(allFailed.metrics[0].successfulSamples, 0);
  assert.equal(allFailed.metrics[0].sampleCount, 2);
  assert.equal(allFailed.metrics[0].mean, null);
  assert.equal(allFailed.metrics[0].throughputPerSecond, 1);
  assert.equal(allFailed.metrics[0].errorRate, 1);

  const emptyFile = path.join(temporary, "empty.json");
  await writeFile(emptyFile, "", "utf8");
  const blocked = reporter.buildCanonicalRun(
    { config: { duration: 1 } },
    validContext({ status: "blocked", incompleteCoverage: ["application did not start"] }),
    await reporter.collectRawStatistics(emptyFile),
  );
  assert.deepEqual(blocked.metrics, []);

  const streamFile = path.join(temporary, "stream.json");
  await writeFile(streamFile, rawFixture([10, 20, 30], 1, [0], "grpc_stream_arrival_latency"), "utf8");
  const stream = reporter.buildCanonicalRun({ config: { duration: 2 } }, validContext(), await reporter.collectRawStatistics(streamFile));
  assert.equal(stream.metrics[0].successfulSamples, 3);
  assert.equal(stream.metrics[0].sampleCount, 3);
  assert.equal(stream.metrics[0].throughputPerSecond, 0.5);
});

test("normalizes legacy and k6 v2 summaries without losing rate semantics", async () => {
  const reporter = await loadReporter();
  const v2 = reporter.buildReportModel({
    config: { duration: 10 },
    results: { metrics: [
      { name: "operation_requests", type: "counter", contains: "default", values: { count: 50 } },
      { name: "operation_failed", type: "rate", contains: "default", values: { matches: 10, total: 50, rate: 0.2 } },
    ] },
  });
  assert.equal(v2.throughput.value, 5);
  assert.equal(v2.errorRate.value, 0.2);

  const legacy = reporter.buildReportModel({
    state: { testRunDurationMs: 10_000 },
    metrics: {
      operation_requests: { type: "counter", contains: "default", values: { count: 20 } },
      operation_failed: { type: "rate", contains: "default", values: { passes: 18, fails: 2, rate: 0.1 } },
    },
  });
  assert.equal(legacy.throughput.value, 2);
  assert.equal(legacy.errorRate.value, 0.1);
});

test("bundled templates, dashboards, and collectors pass focused structural checks", async () => {
  const scripts = [
    "assets/k6/http-endpoint.js",
    "assets/k6/http-journey.js",
    "assets/k6/grpc-unary.js",
    "assets/k6/grpc-stream.js",
    "assets/k6/lib/reporter.js",
    "scripts/render-report.mjs",
    "scripts/validate-plan.mjs",
  ];
  for (const relative of scripts) await execFileAsync(process.execPath, ["--check", path.join(packageRoot, relative)]);
  for (const relative of scripts.slice(0, 4)) {
    const source = await readFile(path.join(packageRoot, relative), "utf8");
    assert.match(source, /required\("PLAN_FINGERPRINT"\)/);
    assert.match(source, /required\("CASE_ID"\)/);
    assert.match(source, /required\("AUTH_MODE"\)/);
    assert.match(source, /required\("SCENARIO_CONFIG"\)/);
    assert.match(source, /abortOnFail:\s*true/);
  }
  const stream = await readFile(path.join(packageRoot, "assets/k6/grpc-stream.js"), "utf8");
  assert.match(stream, /finally\s*{/);
  assert.match(stream, /safeEnd\(stream\)/);
  assert.match(stream, /safeClose\(client\)/);

  await execFileAsync("sh", ["-n", path.join(packageRoot, "assets/monitor/collect-posix.sh")]);
  const posix = await readFile(path.join(packageRoot, "assets/monitor/collect-posix.sh"), "utf8");
  const powershell = await readFile(path.join(packageRoot, "assets/monitor/collect-windows.ps1"), "utf8");
  assert.match(posix, /timestamp_utc,cpu_percent,rss_kb,vsz_kb/);
  assert.match(powershell, /timestamp_utc,cpu_percent,rss_kb,vsz_kb/);
  assert.match(powershell, /StreamWriter/);
  assert.doesNotMatch(powershell, /Export-Csv/);

  const dashboard = JSON.parse(await readFile(path.join(packageRoot, "assets/grafana/provisioning/dashboards/k6-local.json"), "utf8"));
  const expressions = dashboard.panels.flatMap((panel: { targets?: Array<{ expr?: string }> }) => panel.targets || []).map((target: { expr?: string }) => target.expr || "");
  assert(expressions.some((expression: string) => expression.includes("sum(rate(")));
  assert(expressions.filter((expression: string) => /_(?:p50|p95|p99|avg)\b/.test(expression)).every((expression: string) => !/avg\s*\(/.test(expression)));
  const compose = await readFile(path.join(packageRoot, "assets/grafana/compose.yaml.tmpl"), "utf8");
  assert.match(compose, /COMPOSE_PROJECT_NAME:\?Set the approved plan\/run-specific/);
  assert.match(compose, /127\.0\.0\.1:/);
  assert.match(compose, /GF_SECURITY_ADMIN_PASSWORD__FILE/);
});

async function loadValidator() {
  return await import(pathToFileURL(path.join(packageRoot, "scripts/validate-plan.mjs")).href) as {
    fingerprintPlan: (plan: unknown) => string;
    renderPlanMarkdown: (plan: unknown) => string;
    validatePlan: (plan: unknown) => string[];
    validatePlanFiles: (plan: unknown, options?: { repositoryRoot?: string; markdownFile?: string }) => Promise<string[]>;
  };
}

async function loadReporter() {
  return await import(pathToFileURL(path.join(packageRoot, "assets/k6/lib/reporter.js")).href) as {
    buildReportModel: (summary: unknown) => any;
  };
}

async function loadRunReporter() {
  return await import(pathToFileURL(path.join(packageRoot, "scripts/render-report.mjs")).href) as {
    buildCanonicalRun: (summary: unknown, context: unknown, raw: any) => any;
    collectRawStatistics: (file: string) => Promise<any>;
  };
}

function validPlan() {
  const smokeValues: Record<string, string> = {
    PLAN_ID: "health-baseline",
    PLAN_FINGERPRINT: "$APPROVED_PLAN_FINGERPRINT",
    RUN_ID: "$GENERATED_RUN_ID",
    CASE_ID: "health",
    SCENARIO_NAME: "smoke",
    TARGET_URL: "http://127.0.0.1:3000/health",
    TARGET_LOCALITY: "loopback",
    HTTP_METHOD: "GET",
    OPERATION_NAME: "GET /health",
    APPROVED_HTTP_METHODS: "GET",
    EXPECTED_STATUSES: "200",
    AUTH_MODE: "none",
    EXECUTOR: "shared-iterations",
    SCENARIO_CONFIG: JSON.stringify({ executor: "shared-iterations", vus: 1, iterations: 1, maxDuration: "30s" }),
    SAFETY_ERROR_RATE: "0.2",
    SAFETY_DELAY_ABORT_EVAL: "0s",
  };
  const runValues: Record<string, string> = {
    ...smokeValues,
    SCENARIO_NAME: "baseline",
    EXECUTOR: "constant-vus",
    SCENARIO_CONFIG: JSON.stringify({ executor: "constant-vus", vus: 1, duration: "30s" }),
    SAFETY_DELAY_ABORT_EVAL: "10s",
  };
  const plan = {
    schemaVersion: 1,
    id: "health-baseline",
    application: {
      revision: "0123456789abcdef0123456789abcdef01234567",
      dirty: false,
      configurationProfile: "local-test",
      configurationEvidence: ["config/test.yaml"],
    },
    targetType: "endpoint",
    protocol: "http",
    target: {
      environment: "local",
      locality: "loopback",
      address: "http://127.0.0.1:3000/health",
      localityEvidence: ["compose.yaml publishes 127.0.0.1:3000"],
      daemonVerified: false,
      containerNetwork: null,
      containerService: null,
    },
    cases: [{
      id: "health",
      operation: "GET /health",
      mutatesBusinessData: false,
      readOnlyEvidence: ["src/routes.ts health handler reads status only"],
      functionalChecks: ["status is 200"],
      testDataRefs: [],
      secretEnvironmentVariables: [] as string[],
    }],
    excludedOperations: [],
    workload: {
      model: "closed",
      scenario: "baseline",
      executor: "constant-vus",
      duration: "30s",
      vus: 1,
      arrivalRate: null as number | null,
      repetitions: 1,
      stages: [{ name: "steady", duration: "30s", target: 1 }],
      compositeWeights: null as Record<string, number> | null,
    },
    measurements: ["response behavior", "target process CPU and memory"],
    reports: ["markdown"],
    slos: [] as Array<Record<string, unknown>>,
    safety: {
      remoteWritableDependenciesVerifiedAbsent: true,
      effectiveConfigurationEvidence: ["config/test.yaml disables remote dependencies"],
      expectedSideEffects: [] as string[],
      stops: [
        { id: "runaway-errors", observable: "operation error rate", threshold: "greater than 20%", action: "abort active scenario", implementation: "k6 threshold with abortOnFail" },
        { id: "max-duration", observable: "campaign wall clock", threshold: "60s", action: "abort campaign", implementation: "executor supervisor timeout of 60 seconds" },
      ],
    },
    environmentVariables: [] as string[],
    environmentBindings: {
      smoke: [{ id: "health-smoke", caseId: "health", values: smokeValues }],
      run: [{ id: "health-baseline-r1", caseId: "health", scenario: "baseline", repetition: 1, values: runValues }],
      report: [{ id: "health-report", values: {} as Record<string, string> }],
    },
    secretEnvironmentVariables: [] as string[],
    generatedFiles: [{
      path: "docs/performance-tests/k6/health.js",
      sha256: "0".repeat(64),
      kind: "k6-entrypoint",
      bindingIds: ["health-smoke", "health-baseline-r1"],
    }],
    commands: {
      start: ["npm run start:test"],
      smoke: [] as string[],
      run: [] as string[],
      report: ["node scripts/render-report.mjs --summary docs/performance-tests/.artifacts/health/summary.json --raw docs/performance-tests/.artifacts/health/raw.json --context docs/performance-tests/.artifacts/health/context.json --json-output docs/performance-tests/.artifacts/health/run.json --output docs/performance-tests/reports/health.md"],
      cleanup: ["npm run stop:test"],
    },
    artifacts: {
      root: "docs/performance-tests",
      raw: "docs/performance-tests/.artifacts/health/raw.json",
      logs: "docs/performance-tests/.artifacts/health/execution.log",
      canonicalRun: "docs/performance-tests/.artifacts/health/run.json",
      reports: ["docs/performance-tests/reports/health.md"],
    },
    toolVersions: { k6: "1.5.0" },
    downloads: [] as Array<Record<string, unknown>>,
  };
  refreshEnvironmentAndCommands(plan);
  return plan;
}

function wholeApplicationPlan() {
  const plan: any = validPlan();
  plan.targetType = "whole-application";
  plan.cases.push({
    id: "browse",
    operation: "browse journey",
    mutatesBusinessData: false,
    readOnlyEvidence: ["src/routes.ts journey uses GET routes only"],
    functionalChecks: ["every step is successful"],
    testDataRefs: [],
    secretEnvironmentVariables: [],
  });
  const journeySmoke = { ...plan.environmentBindings.smoke[0].values, CASE_ID: "browse", JOURNEY_NAME: "browse journey", THINK_TIME: "0.1" };
  delete journeySmoke.HTTP_METHOD;
  delete journeySmoke.OPERATION_NAME;
  delete journeySmoke.APPROVED_HTTP_METHODS;
  delete journeySmoke.EXPECTED_STATUSES;
  const journeyRun = { ...plan.environmentBindings.run[0].values, CASE_ID: "browse", JOURNEY_NAME: "browse journey", THINK_TIME: "0.1" };
  delete journeyRun.HTTP_METHOD;
  delete journeyRun.OPERATION_NAME;
  delete journeyRun.APPROVED_HTTP_METHODS;
  delete journeyRun.EXPECTED_STATUSES;
  plan.environmentBindings.smoke.push({ id: "browse-smoke", caseId: "browse", values: journeySmoke });
  plan.environmentBindings.run.push({ id: "browse-baseline-r1", caseId: "browse", scenario: "baseline", repetition: 1, values: journeyRun });
  plan.generatedFiles = [
    { ...plan.generatedFiles[0], bindingIds: ["health-smoke", "health-baseline-r1"] },
    { path: "docs/performance-tests/k6/journey.js", sha256: "0".repeat(64), kind: "k6-entrypoint", bindingIds: ["browse-smoke", "browse-baseline-r1"] },
    { path: "docs/performance-tests/k6/lib/reporter.js", sha256: "0".repeat(64), kind: "support", bindingIds: [] },
  ];
  refreshEnvironmentAndCommands(plan);
  return plan;
}

function refreshEnvironmentAndCommands(plan: any) {
  plan.environmentVariables = [...new Set([
    ...plan.environmentBindings.smoke.flatMap((entry: any) => Object.keys(entry.values)),
    ...plan.environmentBindings.run.flatMap((entry: any) => Object.keys(entry.values)),
    ...plan.environmentBindings.report.flatMap((entry: any) => Object.keys(entry.values)),
  ])];
  plan.commands.smoke = plan.environmentBindings.smoke.map((entry: any) => bindingCommand(entry.values, entry.id.includes("browse") ? "journey.js" : "health.js"));
  plan.commands.run = plan.environmentBindings.run.map((entry: any) => bindingCommand(entry.values, entry.id.includes("browse") ? "journey.js" : "health.js"));
}

function bindingCommand(values: Record<string, string>, script: string) {
  const assignments = Object.entries(values).map(([name, value]) => {
    if (value === "$APPROVED_PLAN_FINGERPRINT" || value === "$GENERATED_RUN_ID") return `${name}=${value}`;
    return `${name}='${value.replaceAll("'", "'\\''")}'`;
  });
  return `env ${assignments.join(" ")} k6 run docs/performance-tests/k6/${script}`;
}

function validContext(runOverrides: { status?: string; incompleteCoverage?: string[] } = {}) {
  return {
    plan: { id: "health-baseline", fingerprint: `sha256:${"a".repeat(64)}` },
    run: {
      id: "health-20260815T120000Z",
      status: runOverrides.status || "complete",
      startedAt: "2026-08-15T12:00:00Z",
      endedAt: "2026-08-15T12:00:02Z",
      wallClockMs: 2000,
      scenarioDurationMs: 2000,
      incompleteCoverage: runOverrides.incompleteCoverage || [],
    },
    environment: {
      gitRevision: "0123456789abcdef0123456789abcdef01234567",
      gitDirty: false,
      os: "darwin",
      cpu: "test CPU",
      memoryBytes: 16_000_000_000,
      applicationProfile: "local-test",
      target: "http://127.0.0.1:3000/health",
      k6Version: "1.5.0",
      containerLimits: null,
    },
    workload: {
      scenario: "baseline",
      model: "closed",
      executor: "constant-vus",
      stages: [{ duration: "2s", target: 1 }],
      concurrency: 1,
      arrivalRate: null,
      repetition: 1,
      dataVolume: "fixed health request",
      streamCompletionSemantics: null,
    },
    functionalChecks: [],
    slos: [],
    safetyStops: [],
    excludedOperations: [],
    instrumentationGaps: [],
    artifacts: {},
    analysis: { observations: [], correlations: [], hypotheses: [], confirmedCauses: [] },
  };
}

function rawFixture(latencies: number[], requests: number, failures: number[], latencyMetric = "health_duration") {
  const tags = { case: "health", operation: "GET /health", scenario: "baseline" };
  const records: unknown[] = [
    { type: "Metric", data: { name: latencyMetric, type: "trend", contains: "time" } },
    { type: "Metric", data: { name: "operation_requests", type: "counter", contains: "default" } },
    { type: "Metric", data: { name: "operation_failed", type: "rate", contains: "default" } },
    ...latencies.map((value) => ({ type: "Point", metric: latencyMetric, data: { value, tags } })),
    ...Array.from({ length: requests }, () => ({ type: "Point", metric: "operation_requests", data: { value: 1, tags } })),
    ...failures.map((value) => ({ type: "Point", metric: "operation_failed", data: { value, tags } })),
  ];
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}
