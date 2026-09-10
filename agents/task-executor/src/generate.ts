#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadCaller, loadMetadata, loadPrompt, packageRoot } from "./paths.js";
import { targetArtifacts } from "./artifacts.js";
import { policyFor } from "./model-policy.js";

async function main(): Promise<void> {
  const mode = process.argv.includes("--check") ? "check" : process.argv.includes("--write") ? "write" : undefined;
  if (!mode) throw new Error("Use --write to generate adapters or --check to validate committed adapters.");

  const metadata = await loadMetadata();
  const prompt = await loadPrompt();
  const caller = await loadCaller();
  const stale: string[] = [];
  const packageMetadata = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")) as {
    name?: string;
    version?: string;
  };
  if (packageMetadata.name !== "@fpgskills/task-executor" || packageMetadata.version !== metadata.version) {
    throw new Error("agent.json and package.json must use the same Task Executor version and package identity.");
  }

  for (const target of metadata.targets) {
    const bundleRoot = path.join(packageRoot, "adapters", target);
    const layouts = [{ agentDirectory: bundleRoot, skillDirectory: path.join(bundleRoot, "skills", "task-executor-routing") }];
    const native = nativeAdapterPath(target, metadata.id);
    if (native) layouts.push({ agentDirectory: path.dirname(native), skillDirectory: path.join(path.dirname(path.dirname(native)), "skills", "task-executor-routing") });
    for (const layout of layouts) {
      for (const plan of targetArtifacts({ metadata, prompt, caller, target, policy: policyFor(target), ...layout, portable: true })) {
        if (mode === "write") {
          await mkdir(path.dirname(plan.destination), { recursive: true });
          await writeFile(plan.destination, plan.content, "utf8");
          process.stdout.write(`generated ${path.relative(packageRoot, plan.destination)}\n`);
        } else {
          let current: string | undefined;
          try { current = await readFile(plan.destination, "utf8"); } catch { /* Missing generated artifact. */ }
          if (current !== plan.content) stale.push(path.relative(packageRoot, plan.destination));
        }
      }
    }
  }

  const nativeManifests = new Map<string, string>([
    [
      path.join(packageRoot, "native", "claude-code", ".claude-plugin", "plugin.json"),
      json({
        name: metadata.id,
        version: metadata.version,
        description: metadata.description,
        author: { name: "FPGSkills contributors" },
      }),
    ],
    [
      path.join(packageRoot, "native", "cursor", ".cursor-plugin", "plugin.json"),
      json({
        name: metadata.id,
        version: metadata.version,
        description: metadata.description,
      }),
    ],
    [path.join(packageRoot, "native", "antigravity", "plugin.json"), json({ name: metadata.id })],
  ]);
  for (const [output, content] of nativeManifests) {
    if (mode === "write") {
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, content, "utf8");
      process.stdout.write(`generated ${path.relative(packageRoot, output)}\n`);
    } else {
      let current: string | undefined;
      try {
        current = await readFile(output, "utf8");
      } catch {
        // A missing manifest is stale.
      }
      if (current !== content) stale.push(path.relative(packageRoot, output));
    }
  }

  if (stale.length > 0) {
    throw new Error(`Generated adapters are stale:\n${stale.map((file) => `- ${file}`).join("\n")}\nRun npm run generate.`);
  }
  if (mode === "check") process.stdout.write("All generated adapters are current.\n");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function nativeAdapterPath(target: string, agentId: string): string | undefined {
  switch (target) {
    case "claude-code":
      return path.join(packageRoot, "native", "claude-code", "agents", `${agentId}.md`);
    case "cursor":
      return path.join(packageRoot, "native", "cursor", "agents", `${agentId}.md`);
    case "antigravity":
      return path.join(packageRoot, "native", "antigravity", "agents", `${agentId}.md`);
    default:
      return undefined;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
