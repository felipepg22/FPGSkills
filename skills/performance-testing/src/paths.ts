import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { InstallScope, TargetId } from "./types.js";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(sourceDirectory, "..");
export const SKILL_ID = "performance-testing";

export const TARGET_DIRECTORIES: Record<Exclude<TargetId, "generic">, { local: string; global: string[] }> = {
  codex: {
    local: ".codex/skills",
    global: [".codex", "skills"],
  },
  opencode: {
    local: ".opencode/skills",
    global: [".config", "opencode", "skills"],
  },
  cursor: {
    local: ".cursor/skills",
    global: [".cursor", "skills"],
  },
  "claude-code": {
    local: ".claude/skills",
    global: [".claude", "skills"],
  },
  antigravity: {
    local: ".agents/skills",
    global: [".gemini", "config", "skills"],
  },
};

export function installationRoot(scope: InstallScope, project?: string): string {
  return scope === "global" ? homedir() : path.resolve(project ?? process.cwd());
}

export function manifestPath(scope: InstallScope, project?: string): string {
  return path.join(installationRoot(scope, project), ".fpgskills", "manifest.json");
}

export function skillDirectory(
  target: TargetId,
  scope: InstallScope,
  project?: string,
  output?: string,
): string {
  const root = installationRoot(scope, project);
  if (target === "generic") {
    if (!output) throw new Error("The generic target requires --output <directory>.");
    return path.join(path.resolve(root, output), SKILL_ID);
  }
  const config = TARGET_DIRECTORIES[target];
  const parent = scope === "global" ? path.join(root, ...config.global) : path.join(root, config.local);
  return path.join(parent, SKILL_ID);
}

export async function loadPackageVersion(): Promise<string> {
  const parsed = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")) as { version?: unknown };
  if (typeof parsed.version !== "string") throw new Error("Package version is missing.");
  return parsed.version;
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
