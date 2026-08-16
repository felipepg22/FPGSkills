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

export interface ManifestArtifact {
  package: string;
  skill: string;
  target: TargetId;
  scope: InstallScope;
  version: string;
  path: string;
  checksum: string;
}

export interface OwnershipManifest {
  schemaVersion: 1;
  artifacts: ManifestArtifact[];
}
