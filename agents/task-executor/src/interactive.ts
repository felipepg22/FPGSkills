import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { isTarget, parseProfile, type CliArguments } from "./arguments.js";
import { detectTargets } from "./paths.js";
import type { InstallScope, TargetId } from "./types.js";

export async function completeInteractively(args: CliArguments): Promise<CliArguments> {
  if (!stdin.isTTY || !stdout.isTTY) return args;
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    if ((args.command === "install" || args.command === "uninstall") && args.targets.length === 0) {
      const detected = await detectTargets();
      stdout.write(`Targets: codex, opencode, cursor, claude-code, antigravity, generic\n`);
      if (detected.length > 0) stdout.write(`Detected: ${detected.join(", ")}\n`);
      const answer = await prompt.question(`Select comma-separated targets${detected.length ? ` [${detected.join(",")}]` : ""}: `);
      args.targets = parseTargets(answer || detected.join(","));
    }
    if (!args.scope) {
      const answer = (await prompt.question("Scope local/global [local]: ")).trim();
      args.scope = parseScope(answer || "local");
    }
    if (args.scope === "local" && !args.project) {
      const answer = (await prompt.question(`Project root [${process.cwd()}]: `)).trim();
      args.project = answer || process.cwd();
    }
    if (args.command === "install" && args.profiles.length === 0) {
      const answer = (await prompt.question("Optional model profiles (name=model-id, comma-separated; blank for inherit only): ")).trim();
      if (answer) args.profiles = answer.split(",").map((value) => parseProfile(value.trim()));
    }
    if (args.command === "install" && args.targets.includes("generic") && !args.output) {
      args.output = (await prompt.question("Generic Markdown output path: ")).trim();
    }
    return args;
  } finally {
    prompt.close();
  }
}

function parseTargets(value: string): TargetId[] {
  const targets = value.split(",").map((target) => target.trim()).filter(Boolean);
  for (const target of targets) {
    if (!isTarget(target)) throw new Error(`Unsupported target: ${target}`);
  }
  return [...new Set(targets)] as TargetId[];
}

function parseScope(value: string): InstallScope {
  if (value !== "local" && value !== "global") throw new Error(`Invalid scope: ${value}`);
  return value;
}
