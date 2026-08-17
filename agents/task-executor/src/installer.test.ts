import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { install, status, uninstall } from "./installer.js";

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
  assert.equal(results.length, 4);
  assert.match(await readFile(path.join(project, ".codex/agents/task-executor.toml"), "utf8"), /developer_instructions/);
  assert.match(await readFile(path.join(project, ".codex/agents/task-executor-luna.toml"), "utf8"), /gpt-5\.6-luna/);
  assert.match(await readFile(path.join(project, ".codex/agents/task-executor-luna.toml"), "utf8"), /model_reasoning_effort = "max"/);
  const entries = await status({ scope: "local", project });
  assert.equal(entries.length, 4);
  assert.ok(entries.every((entry) => entry.state === "current"));
  assert.ok(entries.every((entry) => !path.isAbsolute(entry.path)));
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
