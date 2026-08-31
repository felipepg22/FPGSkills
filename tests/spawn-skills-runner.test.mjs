import assert from "node:assert/strict";
import test from "node:test";
import { spawnSkillsRunner } from "../scripts/lib/spawn-skills-runner.mjs";

test("runs Windows command wrappers through cmd.exe", () => {
  let invocation;
  const result = spawnSkillsRunner({
    runner: "npx",
    args: ["--yes", "skills@1.5.23"],
    options: { cwd: "C:\\temp" },
    platform: "win32",
    env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" },
    spawn: (...values) => {
      invocation = values;
      return { status: 0 };
    },
  });

  assert.equal(result.status, 0);
  assert.deepEqual(invocation, [
    "C:\\Windows\\System32\\cmd.exe",
    ["/d", "/s", "/c", "npx.cmd", "--yes", "skills@1.5.23"],
    { cwd: "C:\\temp" },
  ]);
});

test("spawns native runners directly outside Windows", () => {
  let invocation;
  spawnSkillsRunner({
    runner: "bunx",
    args: ["skills@1.5.23"],
    options: { cwd: "/tmp/install" },
    platform: "linux",
    spawn: (...values) => {
      invocation = values;
      return { status: 0 };
    },
  });

  assert.deepEqual(invocation, [
    "bunx",
    ["skills@1.5.23"],
    { cwd: "/tmp/install" },
  ]);
});
