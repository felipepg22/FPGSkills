import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { install, status, uninstall } from "./installer.js";

test("installs the canonical skill into all native project targets", async () => {
  const project = await temporaryProject();
  const targets = ["codex", "opencode", "cursor", "claude-code", "antigravity"] as const;
  const results = await install({ targets: [...targets], scope: "local", project });
  assert.equal(results.filter((result) => result.action === "installed").length, targets.length);

  const destinations = [
    ".codex/skills",
    ".opencode/skills",
    ".cursor/skills",
    ".claude/skills",
    ".agents/skills",
  ];
  for (const destination of destinations) {
    const skill = await readFile(path.join(project, destination, "fpg-agents-md-writer", "SKILL.md"), "utf8");
    assert.match(skill, /name: fpg-agents-md-writer/);
  }
});

test("keeps successful targets when another target conflicts", async () => {
  const project = await temporaryProject();
  const conflict = path.join(project, ".cursor/skills/fpg-agents-md-writer/SKILL.md");
  await mkdir(path.dirname(conflict), { recursive: true });
  await writeFile(conflict, "user-owned\n", "utf8");

  const results = await install({ targets: ["codex", "cursor"], scope: "local", project });
  assert.equal(results.find((result) => result.target === "codex")?.action, "installed");
  assert.equal(results.find((result) => result.target === "cursor")?.action, "failed");
  await readFile(path.join(project, ".codex/skills/fpg-agents-md-writer/SKILL.md"), "utf8");
  assert.equal(await readFile(conflict, "utf8"), "user-owned\n");
});

test("generic install requires a contained explicit output directory", async () => {
  const project = await temporaryProject();
  const missing = await install({ targets: ["generic"], scope: "local", project });
  assert.equal(missing[0]?.action, "failed");
  assert.match(missing[0]?.detail ?? "", /requires --output/);

  const escaping = await install({ targets: ["generic"], scope: "local", project, output: "../outside" });
  assert.equal(escaping[0]?.action, "failed");
  assert.match(escaping[0]?.detail ?? "", /escapes the selected installation scope/);
});

test("status detects modification and uninstall preserves modified files", async () => {
  const project = await temporaryProject();
  await install({ targets: ["codex"], scope: "local", project });
  const skillFile = path.join(project, ".codex/skills/fpg-agents-md-writer/SKILL.md");
  await writeFile(skillFile, "modified\n", "utf8");

  const entries = await status({ scope: "local", project });
  assert.equal(entries.find((entry) => entry.path.endsWith("SKILL.md"))?.state, "modified");
  const results = await uninstall({ targets: ["codex"], scope: "local", project });
  assert.equal(results.find((result) => result.path === skillFile)?.action, "preserved");
  assert.equal(await readFile(skillFile, "utf8"), "modified\n");
});

async function temporaryProject(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "fpg-agents-md-writer-"));
}
