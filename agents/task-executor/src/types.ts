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
  defaultModel: "inherit";
  targets: TargetId[];
}

export interface ModelProfile {
  name: string;
  model: string;
}

export interface RenderOptions {
  metadata: AgentMetadata;
  prompt: string;
  target: TargetId;
  profile?: ModelProfile;
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
}

export interface OwnershipManifest {
  schemaVersion: 1;
  artifacts: ManifestArtifact[];
}
