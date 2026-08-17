import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArguments, parseProfile, parseProfileEffort } from "./arguments.js";

test("parses scripted installation with repeated profiles", () => {
  const parsed = parseArguments([
    "install",
    "--target",
    "codex,cursor",
    "--scope=local",
    "--profile",
    "luna=gpt-5.6-luna",
    "--profile-effort",
    "luna=max",
    "--profile=grok=xai/grok",
    "--profile-effort=grok=high",
  ]);
  assert.deepEqual(parsed.targets, ["codex", "cursor"]);
  assert.equal(parsed.scope, "local");
  assert.deepEqual(parsed.profiles, [
    { name: "luna", model: "gpt-5.6-luna", reasoningEffort: "max" },
    { name: "grok", model: "xai/grok", reasoningEffort: "high" },
  ]);
});

test("rejects reserved or malformed profile names", () => {
  assert.throws(() => parseProfile("inherit=model"));
  assert.throws(() => parseProfile("Bad Name=model"));
  assert.throws(() => parseProfile("missing-model="));
});

test("rejects malformed, duplicate, and orphaned profile efforts", () => {
  assert.throws(() => parseProfileEffort("luna="));
  assert.throws(() => parseProfileEffort("luna=turbo"));
  assert.throws(() => parseArguments(["install", "--profile-effort", "luna=max"]), /unknown profile/);
  assert.throws(() => parseArguments([
    "install", "--profile", "luna=gpt-5.6-luna", "--profile-effort", "luna=max", "--profile-effort", "luna=high",
  ]), /Duplicate profile effort/);
});
