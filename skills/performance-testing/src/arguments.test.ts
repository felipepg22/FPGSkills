import assert from "node:assert/strict";
import test from "node:test";
import { parseArguments } from "./arguments.js";

test("parses a fully specified multi-target installation", () => {
  assert.deepEqual(parseArguments([
    "install",
    "--target=codex,cursor",
    "--target",
    "generic",
    "--scope=local",
    "--project",
    "/tmp/project",
    "--output",
    ".agents/skills",
  ]), {
    command: "install",
    targets: ["codex", "cursor", "generic"],
    scope: "local",
    project: "/tmp/project",
    output: ".agents/skills",
    force: false,
    json: false,
    help: false,
  });
});

test("rejects unknown targets", () => {
  assert.throws(() => parseArguments(["install", "--target", "unknown"]), /Unsupported target/);
});
