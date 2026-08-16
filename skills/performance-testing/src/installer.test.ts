import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { install, status, uninstall } from "./installer.js";
import { checksum, writeManifest } from "./manifest.js";

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
    const skill = await readFile(path.join(project, destination, "performance-testing", "SKILL.md"), "utf8");
    assert.match(skill, /name: performance-testing/);
    const reporter = await readFile(path.join(project, destination, "performance-testing", "assets/k6/lib/reporter.js"), "utf8");
    assert.match(reporter, /p50 \(median\)/);
  }
});

test("keeps successful targets when another target conflicts", async () => {
  const project = await temporaryProject();
  const conflict = path.join(project, ".cursor/skills/performance-testing/SKILL.md");
  await mkdir(path.dirname(conflict), { recursive: true });
  await writeFile(conflict, "user-owned\n", "utf8");

  const results = await install({ targets: ["codex", "cursor"], scope: "local", project });
  assert.equal(results.find((result) => result.target === "codex")?.action, "installed");
  assert.equal(results.find((result) => result.target === "cursor")?.action, "failed");
  await readFile(path.join(project, ".codex/skills/performance-testing/SKILL.md"), "utf8");
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

test("install rejects a target directory symlink that resolves outside the project", async () => {
  const project = await temporaryProject();
  const outside = await mkdtemp(path.join(tmpdir(), "performance-testing-outside-"));
  await mkdir(path.join(project, ".codex"), { recursive: true });
  await symlink(outside, path.join(project, ".codex/skills"), directoryLinkType());

  const results = await install({ targets: ["codex"], scope: "local", project });
  assert.equal(results[0]?.action, "failed");
  assert.match(results[0]?.detail ?? "", /resolves outside the selected installation scope/);
  await assert.rejects(
    readFile(path.join(outside, "performance-testing/SKILL.md")),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "ENOENT",
  );
});

test("install rejects a manifest parent symlink that resolves outside the project", async () => {
  const project = await temporaryProject();
  const outside = await mkdtemp(path.join(tmpdir(), "performance-testing-manifest-outside-"));
  await symlink(outside, path.join(project, ".fpgskills"), directoryLinkType());

  await assert.rejects(
    install({ targets: ["codex"], scope: "local", project }),
    /resolves outside the selected installation scope/,
  );
  await assert.rejects(
    readFile(path.join(outside, "manifest.json")),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "ENOENT",
  );
});

test("uninstall rejects a forged manifest artifact outside the target skill directory", async () => {
  const project = await temporaryProject();
  const userFile = path.join(project, "README.md");
  const userContent = "user-owned project file\n";
  await writeFile(userFile, userContent, "utf8");
  await writeManifest(path.join(project, ".fpgskills/manifest.json"), {
    schemaVersion: 1,
    artifacts: [{
      package: "@fpgskills/performance-testing",
      skill: "performance-testing",
      target: "codex",
      scope: "local",
      version: "0.1.0",
      path: "README.md",
      checksum: checksum(userContent),
    }],
  });

  const results = await uninstall({ targets: ["codex"], scope: "local", project });
  assert.equal(results[0]?.action, "failed");
  assert.match(results[0]?.detail ?? "", /outside its performance-testing installation/);
  assert.equal(await readFile(userFile, "utf8"), userContent);
  const persistedManifest = await readFile(path.join(project, ".fpgskills/manifest.json"), "utf8");
  assert.match(persistedManifest, /"path": "README.md"/);
});

test("uninstall rejects a forged non-package file inside the target skill directory", async () => {
  const project = await temporaryProject();
  const userFile = path.join(project, ".codex/skills/performance-testing/user-notes.md");
  const userContent = "notes owned by the user\n";
  await mkdir(path.dirname(userFile), { recursive: true });
  await writeFile(userFile, userContent, "utf8");
  await writeManifest(path.join(project, ".fpgskills/manifest.json"), {
    schemaVersion: 1,
    artifacts: [{
      package: "@fpgskills/performance-testing",
      skill: "performance-testing",
      target: "codex",
      scope: "local",
      version: "0.1.0",
      path: ".codex/skills/performance-testing/user-notes.md",
      checksum: checksum(userContent),
    }],
  });

  const results = await uninstall({ targets: ["codex"], scope: "local", project });
  assert.equal(results[0]?.action, "failed");
  assert.match(results[0]?.detail ?? "", /not a canonical performance-testing package file/);
  assert.equal(await readFile(userFile, "utf8"), userContent);
});

test("status detects modification and uninstall preserves modified files", async () => {
  const project = await temporaryProject();
  await install({ targets: ["codex"], scope: "local", project });
  const skillFile = path.join(project, ".codex/skills/performance-testing/SKILL.md");
  await writeFile(skillFile, "modified\n", "utf8");

  const entries = await status({ scope: "local", project });
  assert.equal(entries.find((entry) => entry.path.endsWith("SKILL.md"))?.state, "modified");
  const results = await uninstall({ targets: ["codex"], scope: "local", project });
  assert.equal(results.find((result) => result.path === skillFile)?.action, "preserved");
  assert.equal(await readFile(skillFile, "utf8"), "modified\n");
});

async function temporaryProject(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "performance-testing-"));
}

function directoryLinkType(): "dir" | "junction" {
  return process.platform === "win32" ? "junction" : "dir";
}
