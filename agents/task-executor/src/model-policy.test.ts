import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultCandidate, policyFor, validateModel, validateOverrides, validatePolicy } from "./model-policy.js";
import { TARGET_IDS } from "./types.js";

test("every supported target has an explicit cheap default and ranked alternatives", () => {
  for (const target of TARGET_IDS) {
    const policy = policyFor(target);
    assert.equal(defaultCandidate(policy).cheap, true);
    assert.ok(policy.candidates.length > 1);
    for (const candidate of policy.candidates) validateModel(candidate.model);
  }
  assert.equal(defaultCandidate(policyFor("opencode")).model, "openai/gpt-5.6-luna");
  assert.equal(defaultCandidate(policyFor("claude-code")).model, "haiku");
  assert.equal(defaultCandidate(policyFor("antigravity")).model, "flash");
});

test("rejects defaults that are missing, expensive, or bypass cheaper starting candidates", () => {
  const policy = policyFor("codex");
  for (const defaultProfile of ["missing", "terra", "astra"]) {
    assert.throws(() => validatePolicy({ ...policy, defaultProfile }), /cheap candidate/);
  }
  policy.candidates.push({ ...defaultCandidate(policy), name: "cheaper", costRank: 0.5 });
  assert.throws(() => validatePolicy(policy), /lowest-cost/);
});

test("validates model IDs, ranking, effort, names and target mappings", () => {
  for (const model of ["", " ", "inherit", "AUTO", "default", " luna", "luna\nmax"]) assert.throws(() => validateModel(model));
  for (const patch of [{ costRank: 0 }, { costRank: "1" }, { capability: "" }, { cheap: "true" }, { reasoningEffort: "turbo" }]) {
    const policy = policyFor("codex");
    Object.assign(policy.candidates[0]!, patch);
    assert.throws(() => validatePolicy(policy));
  }
  const policy = policyFor("codex");
  policy.candidates.push(policy.candidates[0]!);
  assert.throws(() => validatePolicy(policy), /Duplicate/);
  assert.throws(() => validateOverrides({ typo: policy }), /Unknown policy target/);
  assert.throws(() => validatePolicy({ defaultProfile: 1, candidates: [{ name: 1, model: "luna", costRank: 1, cheap: true, capability: "Focused tasks" }] }), /profile name/);
  assert.throws(() => validatePolicy({ defaultProfile: "luna", candidates: [{ name: 1, model: "luna", costRank: 1, cheap: true, capability: "Focused tasks" }] }), /candidate name/);
});

test("overrides are per target and returned policy copies cannot mutate defaults", () => {
  const custom = policyFor("codex");
  custom.candidates[0]!.reasoningEffort = "medium";
  const overrides = validateOverrides({ codex: custom });
  assert.equal(defaultCandidate(policyFor("codex", overrides)).reasoningEffort, "medium");
  assert.equal(defaultCandidate(policyFor("cursor", overrides)).reasoningEffort, "max");
  overrides.codex!.candidates[0]!.model = "changed";
  assert.equal(defaultCandidate(policyFor("codex")).model, "gpt-5.6-luna");
});

test("default is reserved for the base artifact and cannot name a policy candidate", () => {
  const alternative = policyFor("codex");
  alternative.candidates[1]!.name = "default";
  assert.throws(() => validatePolicy(alternative), /Invalid candidate name/);
  const primary = policyFor("codex");
  primary.candidates[0]!.name = "default";
  primary.defaultProfile = "default";
  assert.throws(() => validatePolicy(primary), /Invalid candidate name/);
});
