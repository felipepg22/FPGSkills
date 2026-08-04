import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentMetadata, InstallScope, TargetId } from "./types.js";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(sourceDirectory, "..");

export async function loadMetadata(): Promise<AgentMetadata> {
  const raw = await readFile(path.join(packageRoot, "agent.json"), "utf8");
  return JSON.parse(raw) as AgentMetadata;
}

export async function loadPrompt(): Promise<string> {
  return (await readFile(path.join(packageRoot, "core", "prompt.md"), "utf8")).trimEnd();
}

export const TARGET_DIRECTORIES: Record<Exclude<TargetId, "generic">, { local: string; global: string[] }> = {
  codex: {
    local: ".codex/agents",
    global: [".codex", "agents"],
  },
  opencode: {
    local: ".opencode/agents",
    global: [".config", "opencode", "agents"],
  },
  cursor: {
    local: ".cursor/agents",
    global: [".cursor", "agents"],
  },
  "claude-code": {
    local: ".claude/agents",
    global: [".claude", "agents"],
  },
  antigravity: {
    local: ".agents/agents",
    global: [".gemini", "config", "agents"],
  },
};

export function installationRoot(scope: InstallScope, project?: string): string {
  return scope === "global" ? homedir() : path.resolve(project ?? process.cwd());
}

export function manifestPath(scope: InstallScope, project?: string): string {
  return path.join(installationRoot(scope, project), ".fpgskills", "manifest.json");
}

export function adapterDirectory(target: Exclude<TargetId, "generic">, scope: InstallScope, project?: string): string {
  const root = installationRoot(scope, project);
  const config = TARGET_DIRECTORIES[target];
  return scope === "global" ? path.join(root, ...config.global) : path.join(root, config.local);
}

export function adapterExtension(target: TargetId): ".toml" | ".md" {
  return target === "codex" ? ".toml" : ".md";
}

export function adapterName(agentId: string, profile?: string): string {
  return profile ? `${agentId}-${profile}` : agentId;
}

export function adapterPath(
  target: Exclude<TargetId, "generic">,
  scope: InstallScope,
  agentId: string,
  profile?: string,
  project?: string,
): string {
  return path.join(adapterDirectory(target, scope, project), `${adapterName(agentId, profile)}${adapterExtension(target)}`);
}

export async function detectTargets(): Promise<Exclude<TargetId, "generic">[]> {
  const detected: Exclude<TargetId, "generic">[] = [];
  for (const [target, directories] of Object.entries(TARGET_DIRECTORIES) as Array<[
    Exclude<TargetId, "generic">,
    (typeof TARGET_DIRECTORIES)[Exclude<TargetId, "generic">],
  ]>) {
    const candidates = [path.join(process.cwd(), directories.local), path.join(homedir(), ...directories.global)];
    if (await anyExists(candidates)) detected.push(target);
  }
  return detected;
}

async function anyExists(paths: string[]): Promise<boolean> {
  for (const candidate of paths) {
    try {
      await access(candidate);
      return true;
    } catch {
      // Continue checking candidates.
    }
  }
  return false;
}
