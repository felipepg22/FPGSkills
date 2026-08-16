import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { packageRoot } from "./paths.js";
import { CANONICAL_FILES } from "./resources.js";

for (const relative of CANONICAL_FILES) await access(path.join(packageRoot, relative));
for (const relative of ["LICENSE", "README.md", "evals/cases.md", "evals/native-smoke.md", "evals/fixtures/read-only-server.mjs"]) await access(path.join(packageRoot, relative));

const skill = await readFile(path.join(packageRoot, "SKILL.md"), "utf8");
if (!skill.startsWith("---\nname: performance-testing\ndescription:")) {
  throw new Error("SKILL.md frontmatter is invalid.");
}
const frontmatter = skill.split("---", 3)[1]?.trim().split("\n") ?? [];
if (frontmatter.length !== 2 || frontmatter.some((line) => !/^(name|description): /.test(line))) {
  throw new Error("SKILL.md frontmatter may contain only name and description.");
}
if (skill.includes("disable-model-invocation")) throw new Error("Performance Testing must remain model-invoked.");
if (skill.indexOf("structurally validate every generated executable") > skill.indexOf("Stop until the user replies")) {
  throw new Error("Generated executables must be validated before plan approval.");
}
for (const relative of CANONICAL_FILES.filter((file) => file.startsWith("references/"))) {
  if (!skill.includes(`(${relative})`)) throw new Error(`SKILL.md does not route to ${relative}.`);
}
for (const phrase of ["local k6", "REST/HTTP", "gRPC", "Refuse GraphQL", "mutating operations"]) {
  if (!frontmatter[1]?.includes(phrase)) throw new Error(`SKILL.md description must include: ${phrase}.`);
}

const interfaceFile = await readFile(path.join(packageRoot, "agents/openai.yaml"), "utf8");
if (!interfaceFile.includes("$performance-testing")) throw new Error("agents/openai.yaml must invoke $performance-testing.");

const evaluations = await readFile(path.join(packageRoot, "evals/cases.md"), "utf8");
for (const phrase of ["REST endpoint", "Streaming gRPC", "Approval and executable invalidation", "Delegation and fallback", "Report modes and downloads", "Secret sentinel", "Enforced safety stops"]) {
  if (!evaluations.includes(phrase)) throw new Error(`Evaluation cases must include: ${phrase}.`);
}

const planSchema = await readFile(path.join(packageRoot, "references/plan-schema.md"), "utf8");
for (const phrase of ["generatedFiles", "k6-entrypoint", "bindingIds", "environmentBindings", "secretEnvironmentVariables", "configurationProfile", "implementation", "containerService"]) {
  if (!planSchema.includes(phrase)) throw new Error(`Plan schema must include: ${phrase}.`);
}

const runSchema = await readFile(path.join(packageRoot, "references/run-schema.md"), "utf8");
for (const phrase of ["p50Median", "p95", "p99", "standardDeviation", "throughputPerSecond", "errorRate", "p99Exploratory"]) {
  if (!runSchema.includes(phrase)) throw new Error(`Run schema must include: ${phrase}.`);
}

const dashboard = JSON.parse(await readFile(path.join(packageRoot, "assets/grafana/provisioning/dashboards/k6-local.json"), "utf8")) as { uid?: unknown };
if (dashboard.uid !== "local-k6-performance-tests") throw new Error("Grafana dashboard UID is invalid.");

process.stdout.write("Performance Testing source is valid.\n");
