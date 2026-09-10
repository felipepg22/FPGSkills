import path from "node:path";
import { adapterExtension } from "./paths.js";
import { defaultCandidate, validateModel, validatePolicy } from "./model-policy.js";
import { renderAdapter } from "./render.js";
import type { AgentMetadata, ManifestArtifact, ModelPolicy, ModelProfile, TargetId } from "./types.js";

export interface ArtifactPlan {
  target: TargetId;
  profile: string;
  kind: NonNullable<ManifestArtifact["kind"]>;
  destination: string;
  content: string;
  model?: string;
  reasoningEffort?: ModelProfile["reasoningEffort"];
  policyOverride?: boolean;
}

export function targetArtifacts(options: {
  metadata: AgentMetadata;
  prompt: string;
  caller: string;
  target: TargetId;
  policy: ModelPolicy;
  profiles?: ModelProfile[];
  agentDirectory: string;
  skillDirectory: string;
  basePath?: string;
  portable?: boolean;
  projectRoot?: string;
}): ArtifactPlan[] {
  const { metadata, prompt, caller, target, agentDirectory, skillDirectory } = options;
  const policy = validatePolicy(options.policy);
  const profiles = options.profiles ?? [];
  const names = new Set<string>();
  for (const profile of profiles) {
    validateModel(profile.model);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profile.name) || ["inherit", "default"].includes(profile.name) || names.has(profile.name)) {
      throw new Error(`Invalid or duplicate profile: ${profile.name}`);
    }
    names.add(profile.name);
    const candidate = policy.candidates.find((entry) => entry.name === profile.name);
    if (candidate && (candidate.model !== profile.model || candidate.reasoningEffort !== profile.reasoningEffort)) {
      throw new Error(`Profile ${profile.name} conflicts with the ${target} shortlist. Use --policy to change its model, effort, and cost guidance together.`);
    }
  }
  const primary = defaultCandidate(policy);
  const installedProfiles = new Map(policy.candidates.filter((entry) => entry.name !== primary.name).map((entry) => [entry.name, entry] as [string, ModelProfile]));
  for (const profile of profiles) installedProfiles.set(profile.name, profile);
  const callerPath = options.portable ? "task-executor-routing (skills/task-executor-routing/SKILL.md in this bundle)"
    : options.projectRoot ? `${path.relative(options.projectRoot, path.join(skillDirectory, "SKILL.md")).split(path.sep).join("/")} (relative to the project root)`
    : path.join(skillDirectory, "SKILL.md");
  const selectionPlans: Array<{ profile?: ModelProfile; selection: ModelProfile }> = [
    { selection: primary },
    ...[...installedProfiles.values()].map((profile) => ({ profile, selection: profile })),
  ];
  const plans: ArtifactPlan[] = selectionPlans.map(({ profile, selection }) => ({
    target,
    profile: profile?.name ?? "default",
    kind: "agent",
    destination: !profile && options.basePath ? options.basePath : path.join(agentDirectory, `${metadata.id}${profile ? `-${profile.name}` : ""}${adapterExtension(target)}`),
    content: renderAdapter({ metadata, prompt, target, profile, selection, callerPath }),
    model: selection.model,
    ...(selection.reasoningEffort && target !== "claude-code" && target !== "antigravity" ? { reasoningEffort: selection.reasoningEffort } : {}),
  }));
  const runtimePolicy = {
    schemaVersion: 1,
    target,
    defaultProfile: policy.defaultProfile,
    availability: "Discover through the session launch mechanism; configured bindings alone are unverified.",
    effortControl: target === "claude-code" || target === "antigravity" ? "host-controlled; adapter does not emit effort" : target === "generic" ? "caller must bind explicitly" : "adapter requests explicit effort when configured",
    candidates: policy.candidates.map((candidate) => ({
      ...candidate,
      agent: candidate.name === primary.name ? metadata.id : `${metadata.id}-${candidate.name}`,
      ...(options.portable
        ? { definitionFile: path.basename(plans.find((plan) => plan.profile === (candidate.name === primary.name ? "default" : candidate.name))!.destination) }
        : { definition: path.relative(skillDirectory, plans.find((plan) => plan.profile === (candidate.name === primary.name ? "default" : candidate.name))!.destination).split(path.sep).join("/") }),
    })),
  };
  plans.push(
    { target, profile: "routing", kind: "skill", destination: path.join(skillDirectory, "SKILL.md"), content: caller },
    { target, profile: "routing", kind: "policy", destination: path.join(skillDirectory, "models.json"), content: `${JSON.stringify(runtimePolicy, null, 2)}\n` },
  );
  return plans;
}
