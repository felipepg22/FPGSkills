import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { install, previewInstall, status, uninstall } from "./installer.js";
import { checksum } from "./manifest.js";
import { policyFor } from "./model-policy.js";
import { TARGET_IDS } from "./types.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("installs base and named profiles with a project manifest", async () => {
  const project = await temporaryProject();
  const results = await install({
    targets: ["codex", "claude-code"],
    scope: "local",
    project,
    profiles: [{ name: "luna", model: "gpt-5.6-luna", reasoningEffort: "max" }],
  });
  assert.equal(results.length, 13);
  assert.match(await readFile(path.join(project, ".codex/agents/task-executor.toml"), "utf8"), /developer_instructions/);
  assert.match(await readFile(path.join(project, ".codex/agents/task-executor-luna.toml"), "utf8"), /gpt-5\.6-luna/);
  assert.match(await readFile(path.join(project, ".codex/agents/task-executor-luna.toml"), "utf8"), /model_reasoning_effort = "max"/);
  const entries = await status({ scope: "local", project });
  assert.equal(entries.length, 13);
  assert.ok(entries.every((entry) => entry.state === "current"));
  assert.ok(entries.every((entry) => !path.isAbsolute(entry.path)));
});

test("Cursor named profiles render effort with native bracket syntax", async () => {
  const project = await temporaryProject();
  await install({
    targets: ["cursor"],
    scope: "local",
    project,
    profiles: [{ name: "luna", model: "gpt-5.6-luna", reasoningEffort: "max" }],
  });
  const rendered = await readFile(path.join(project, ".cursor/agents/task-executor-luna.md"), "utf8");
  assert.match(rendered, /model: "gpt-5\.6-luna\[effort=max\]"/);
  assert.doesNotMatch(rendered, /gpt-5\.6-luna-max/);
});

test("refuses to overwrite an unowned adapter without force", async () => {
  const project = await temporaryProject();
  const destination = path.join(project, ".cursor/agents/task-executor.md");
  await writeFileWithParents(destination, "user-owned\n");
  await assert.rejects(
    install({ targets: ["cursor"], scope: "local", project, profiles: [] }),
    /Refusing to overwrite/,
  );
  assert.equal(await readFile(destination, "utf8"), "user-owned\n");
});

test("preflights every conflict before writing any adapter", async () => {
  const project = await temporaryProject();
  const conflict = path.join(project, ".cursor/agents/task-executor.md");
  await writeFileWithParents(conflict, "user-owned\n");
  await assert.rejects(
    install({ targets: ["codex", "cursor"], scope: "local", project, profiles: [] }),
    /Refusing to overwrite/,
  );
  await assert.rejects(readFile(path.join(project, ".codex/agents/task-executor.toml"), "utf8"));
});

test("uninstall preserves modified adapters and removes only owned unmodified files", async () => {
  const project = await temporaryProject();
  await install({ targets: ["opencode", "cursor"], scope: "local", project, profiles: [] });
  const modified = path.join(project, ".cursor/agents/task-executor.md");
  await writeFile(modified, "modified by user\n", "utf8");

  const results = await uninstall({ targets: [], scope: "local", project });
  assert.equal(results.find((result) => result.path === modified)?.action, "preserved");
  await assert.rejects(readFile(path.join(project, ".opencode/agents/task-executor.md"), "utf8"));
  assert.equal(await readFile(modified, "utf8"), "modified by user\n");
});

test("generic output requires an explicit destination", async () => {
  const project = await temporaryProject();
  await assert.rejects(
    install({ targets: ["generic"], scope: "local", project, profiles: [] }),
    /requires --output/,
  );
});

test("generic output cannot escape the selected scope", async () => {
  const project = await temporaryProject();
  await assert.rejects(
    install({ targets: ["generic"], scope: "local", project, profiles: [], output: "../task-executor.md" }),
    /escapes the selected installation scope/,
  );
});

test("all targets install explicit defaults, resolvable shortlists and caller skills", async () => {
  const project = await temporaryProject();
  const options = { targets: [...TARGET_IDS], scope: "local" as const, project, profiles: [], output: "generic/custom-name.md" };
  const preview = await previewInstall(options);
  const results = await install(options);
  assert.deepEqual(results.map((result) => result.path), preview.map((entry) => entry.path));
  const entries = await status({ scope: "local", project });
  for (const entry of entries.filter((entry) => entry.kind === "policy")) {
    const file = path.join(project, entry.path);
    const policy = JSON.parse(await readFile(file, "utf8"));
    assert.equal(policy.target, entry.target);
    for (const candidate of policy.candidates) {
      const definition = await readFile(path.resolve(path.dirname(file), candidate.definition), "utf8");
      assert.ok(definition.includes(candidate.model));
      assert.ok(definition.includes(path.relative(project, path.join(path.dirname(file), "SKILL.md")).split(path.sep).join("/")));
      assert.ok(!definition.includes(project));
    }
    assert.ok((await readFile(path.join(path.dirname(file), "SKILL.md"), "utf8")).includes("(models.json)"));
  }
  assert.ok(entries.filter((entry) => entry.kind === "agent").every((entry) => entry.model && entry.model !== "inherit"));
});

test("a per-target policy override changes the base model and its shortlist together", async () => {
  const project = await temporaryProject();
  const custom = policyFor("codex");
  custom.candidates[0]!.reasoningEffort = "medium";
  const policy = path.join(project, "policy.json");
  await writeFile(policy, JSON.stringify({ codex: custom }));
  await install({ targets: ["codex", "cursor"], scope: "local", project, profiles: [], policy });
  assert.match(await readFile(path.join(project, ".codex/agents/task-executor.toml"), "utf8"), /model_reasoning_effort = "medium"/);
  assert.match(await readFile(path.join(project, ".cursor/agents/task-executor.md"), "utf8"), /gpt-5.6-luna\[effort=max\]/);
  const saved = JSON.parse(await readFile(path.join(project, ".codex/skills/task-executor-routing/models.json"), "utf8"));
  assert.equal(saved.candidates[0].reasoningEffort, "medium");
});

test("skill conflicts are preflighted before any agents are written", async () => {
  const project = await temporaryProject();
  const skill = path.join(project, ".codex/skills/task-executor-routing/SKILL.md");
  await writeFileWithParents(skill, "custom skill");
  await assert.rejects(install({ targets: ["codex"], scope: "local", project, profiles: [] }), /Refusing to overwrite/);
  await assert.rejects(readFile(path.join(project, ".codex/agents/task-executor.toml")));
});

test("migration updates owned inherited base and preserves omitted custom profiles", async () => {
  const project = await temporaryProject();
  const base = ".codex/agents/task-executor.toml";
  const legacy = ".codex/agents/task-executor-custom.toml";
  const old = '# old inherited base\nname = "task-executor"\n';
  const custom = 'name = "task-executor-custom"\nmodel = "custom-model"\n';
  await writeFileWithParents(path.join(project, base), old);
  await writeFileWithParents(path.join(project, legacy), custom);
  await writeFileWithParents(path.join(project, ".fpgskills/manifest.json"), JSON.stringify({ schemaVersion: 1, artifacts: [
    { package: "@fpgskills/task-executor", agent: "task-executor", target: "codex", scope: "local", profile: "inherit", version: "1.1.2", path: base, checksum: checksum(old) },
    { package: "@fpgskills/task-executor", agent: "task-executor", target: "codex", scope: "local", profile: "custom", version: "1.1.2", path: legacy, checksum: checksum(custom) },
  ] }));
  await install({ targets: ["codex"], scope: "local", project, profiles: [] });
  assert.match(await readFile(path.join(project, base), "utf8"), /model = "gpt-5.6-luna"/);
  assert.equal(await readFile(path.join(project, legacy), "utf8"), custom);
  assert.ok((await status({ scope: "local", project })).some((entry) => entry.path === legacy));
});

test("uninstall preserves customized caller policy and removes owned companion files", async () => {
  const project = await temporaryProject();
  await install({ targets: ["codex"], scope: "local", project, profiles: [] });
  const policy = path.join(project, ".codex/skills/task-executor-routing/models.json");
  await writeFile(policy, "custom policy");
  const results = await uninstall({ targets: ["codex"], scope: "local", project });
  assert.equal(results.find((result) => result.path === policy)?.action, "preserved");
  await assert.rejects(readFile(path.join(project, ".codex/skills/task-executor-routing/SKILL.md")));
});

test("a bundled alias cannot silently replace an earlier user-selected model", async () => {
  const project = await temporaryProject();
  const file = ".codex/agents/task-executor-terra.toml";
  const content = 'name = "task-executor-terra"\nmodel = "my-custom-model"\n';
  await writeFileWithParents(path.join(project, file), content);
  await writeFileWithParents(path.join(project, ".fpgskills/manifest.json"), JSON.stringify({ schemaVersion: 1, artifacts: [
    { package: "@fpgskills/task-executor", agent: "task-executor", target: "codex", scope: "local", profile: "terra", version: "1.1.2", path: file, checksum: checksum(content) },
  ] }));
  await assert.rejects(install({ targets: ["codex"], scope: "local", project, profiles: [] }), /Preserving existing named profile/);
  assert.equal(await readFile(path.join(project, file), "utf8"), content);
  await assert.rejects(readFile(path.join(project, ".codex/agents/task-executor.toml")));
  const custom = policyFor("codex");
  custom.candidates.find((candidate) => candidate.name === "terra")!.model = "my-custom-model";
  const policy = path.join(project, "override.json");
  await writeFile(policy, JSON.stringify({ codex: custom }));
  await install({ targets: ["codex"], scope: "local", project, profiles: [], policy });
  assert.match(await readFile(path.join(project, file), "utf8"), /model = "my-custom-model"/);
});

test("rejects conflicting shortlist profiles and duplicate output paths before writes", async () => {
  const project = await temporaryProject();
  await assert.rejects(install({ targets: ["codex"], scope: "local", project, profiles: [{ name: "luna", model: "expensive" }] }), /conflicts with/);
  await assert.rejects(install({ targets: ["codex"], scope: "local", project, profiles: [{ name: "default", model: "custom" }] }), /Invalid or duplicate profile/);
  await assert.rejects(install({ targets: ["generic"], scope: "local", project, profiles: [], output: "task-executor-terra.md" }), /same path/);
  await assert.rejects(install({ targets: [], scope: "local", project, profiles: [] }), /At least one target/);
});

async function temporaryProject(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "fpgskills-task-executor-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeFileWithParents(file: string, content: string): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}
