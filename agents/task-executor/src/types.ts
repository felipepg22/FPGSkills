export const TARGET_IDS = [
  "codex",
  "opencode",
  "cursor",
  "claude-code",
  "antigravity",
  "generic",
] as const;

export type TargetId = (typeof TARGET_IDS)[number];
export type InstallScope = "local" | "global";

export interface AgentMetadata {
  id: string;
  displayName: string;
  version: string;
  description: string;
  manualInvocationOnly: true;
  defaultModel: "cheap";
  targets: TargetId[];
}

export interface ModelProfile {
  name: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
}

export interface ModelCandidate extends ModelProfile {
  costRank: number;
  capability: string;
  cheap: boolean;
}

export interface ModelPolicy {
  defaultProfile: string;
  candidates: ModelCandidate[];
}

export type PolicyOverrides = Partial<Record<TargetId, ModelPolicy>>;

export const REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export interface RenderOptions {
  metadata: AgentMetadata;
  prompt: string;
  target: TargetId;
  profile?: ModelProfile;
  selection?: ModelProfile;
  callerPath?: string;
}

export interface ManifestArtifact {
  package: string;
  agent: string;
  target: TargetId;
  scope: InstallScope;
  profile: string;
  version: string;
  path: string;
  checksum: string;
  kind?: "agent" | "skill" | "policy";
  model?: string;
  reasoningEffort?: ReasoningEffort;
}

export interface OwnershipManifest {
  schemaVersion: 1;
  artifacts: ManifestArtifact[];
}
