import assert from "node:assert/strict";
import { homedir } from "node:os";
import path from "node:path";
import test from "node:test";
import { skillDirectory, TARGET_DIRECTORIES } from "./paths.js";

test("defines local and global destinations for every native target", () => {
  assert.deepEqual(Object.keys(TARGET_DIRECTORIES), ["codex", "opencode", "cursor", "claude-code", "antigravity"]);
  for (const target of Object.keys(TARGET_DIRECTORIES) as Array<keyof typeof TARGET_DIRECTORIES>) {
    assert.match(skillDirectory(target, "local", "/tmp/project"), /fpg-agents-md-writer$/);
    assert.ok(skillDirectory(target, "global").startsWith(homedir()));
  }
});

test("generic output is resolved beneath the selected root", () => {
  assert.equal(
    skillDirectory("generic", "local", "/tmp/project", "custom/skills"),
    path.join("/tmp/project", "custom/skills", "fpg-agents-md-writer"),
  );
});
