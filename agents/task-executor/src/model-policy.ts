import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { REASONING_EFFORTS, TARGET_IDS, type ModelCandidate, type ModelPolicy, type PolicyOverrides, type TargetId } from "./types.js";

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateModel(model: unknown): asserts model is string {
  if (typeof model !== "string" || !model.trim() || model !== model.trim() || /[\r\n\0]/.test(model)
    || ["inherit", "auto", "default"].includes(model.toLowerCase())) {
    throw new Error("An explicit model identifier is required; inherit, auto, and default are not model selections.");
  }
}

export function validatePolicy(value: unknown): ModelPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A model policy must be an object.");
  const policy = value as ModelPolicy;
  if (typeof policy.defaultProfile !== "string" || !NAME.test(policy.defaultProfile)) throw new Error("defaultProfile must be a profile name.");
  if (!Array.isArray(policy.candidates) || policy.candidates.length === 0) throw new Error("A policy needs model candidates.");
  const names = new Set<string>();
  for (const candidate of policy.candidates) {
    if (!candidate || typeof candidate !== "object" || typeof candidate.name !== "string" || !NAME.test(candidate.name) || ["inherit", "default"].includes(candidate.name)) {
      throw new Error("Invalid candidate name.");
    }
    if (names.has(candidate.name)) throw new Error(`Duplicate candidate: ${candidate.name}`);
    names.add(candidate.name);
    validateModel(candidate.model);
    if (candidate.reasoningEffort !== undefined && !REASONING_EFFORTS.includes(candidate.reasoningEffort)) {
      throw new Error(`Invalid reasoning effort for ${candidate.name}`);
    }
    if (!Number.isFinite(candidate.costRank) || candidate.costRank <= 0 || typeof candidate.cheap !== "boolean"
      || typeof candidate.capability !== "string" || !candidate.capability.trim()) {
      throw new Error(`Candidate ${candidate.name} needs a positive costRank, cheap boolean, and capability guidance.`);
    }
  }
  const primary = policy.candidates.find((candidate) => candidate.name === policy.defaultProfile);
  if (!primary?.cheap) throw new Error("defaultProfile must identify a cheap candidate.");
  if (policy.candidates.some((candidate) => candidate.cheap && candidate.costRank < primary.costRank)) {
    throw new Error("defaultProfile must be a lowest-cost cheap candidate.");
  }
  return structuredClone(policy);
}

export function validateOverrides(value: unknown): PolicyOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Policy overrides must map target IDs to policies.");
  const result: PolicyOverrides = {};
  for (const [target, policy] of Object.entries(value)) {
    if (!TARGET_IDS.includes(target as TargetId)) throw new Error(`Unknown policy target: ${target}`);
    result[target as TargetId] = validatePolicy(policy);
  }
  return result;
}

const bundled = validateOverrides(JSON.parse(readFileSync(new URL("../core/models.json", import.meta.url), "utf8")));

export function policyFor(target: TargetId, overrides: PolicyOverrides = {}): ModelPolicy {
  const policy = overrides[target] ?? bundled[target];
  if (!policy) throw new Error(`No model policy for ${target}`);
  return validatePolicy(policy);
}

export function defaultCandidate(policy: ModelPolicy): ModelCandidate {
  return policy.candidates.find((candidate) => candidate.name === policy.defaultProfile)!;
}

export async function loadPolicyOverrides(file?: string): Promise<PolicyOverrides> {
  return file ? validateOverrides(JSON.parse(await readFile(file, "utf8"))) : {};
}
