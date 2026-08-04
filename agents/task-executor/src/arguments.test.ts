import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArguments, parseProfile } from "./arguments.js";

test("parses scripted installation with repeated profiles", () => {
  const parsed = parseArguments([
    "install",
    "--target",
    "codex,cursor",
    "--scope=local",
    "--profile",
    "luna=gpt-5.6-luna",
    "--profile=grok=xai/grok",
  ]);
  assert.deepEqual(parsed.targets, ["codex", "cursor"]);
  assert.equal(parsed.scope, "local");
  assert.deepEqual(parsed.profiles, [
    { name: "luna", model: "gpt-5.6-luna" },
    { name: "grok", model: "xai/grok" },
  ]);
});

test("rejects reserved or malformed profile names", () => {
  assert.throws(() => parseProfile("inherit=model"));
  assert.throws(() => parseProfile("Bad Name=model"));
  assert.throws(() => parseProfile("missing-model="));
});
