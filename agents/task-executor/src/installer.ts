import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  adapterName,
  adapterPath,
  adapterDirectory,
  callerDirectory,
  loadCaller,
  installationRoot,
  loadMetadata,
  loadPrompt,
  manifestPath,
} from "./paths.js";
import { checksum, fileChecksum, readManifest, writeManifest } from "./manifest.js";
import { targetArtifacts, type ArtifactPlan } from "./artifacts.js";
import { loadPolicyOverrides, policyFor } from "./model-policy.js";
import type { InstallScope, ManifestArtifact, ModelProfile, TargetId } from "./types.js";

const PACKAGE_NAME = "@fpgskills/task-executor";

export interface InstallOptions {
  targets: TargetId[];
  scope: InstallScope;
  project?: string;
  profiles: ModelProfile[];
  output?: string;
  policy?: string;
  force?: boolean;
}

export interface OperationResult {
  action: "installed" | "updated" | "unchanged" | "removed" | "preserved" | "missing";
  path: string;
  detail?: string;
}

export interface InstallationPreview {
  target: TargetId;
  profile: string;
  path: string;
}

async function planInstall(options: InstallOptions): Promise<ArtifactPlan[]> {
  if (options.targets.length === 0) throw new Error("At least one target is required.");
  const metadata = await loadMetadata();
  const prompt = await loadPrompt();
  const caller = await loadCaller();
  const overrides = await loadPolicyOverrides(options.policy);
  const plans: ArtifactPlan[] = [];
  for (const target of new Set(options.targets)) {
    const basePath = resolveDestination(target, options, metadata.id);
    const agentDir = target === "generic" ? path.dirname(basePath) : adapterDirectory(target, options.scope, options.project);
    const skillDir = target === "generic" ? path.join(agentDir, "skills", "task-executor-routing") : callerDirectory(target, options.scope, options.project);
    plans.push(...targetArtifacts({ metadata, prompt, caller, target, policy: policyFor(target, overrides), profiles: options.profiles,
      agentDirectory: agentDir, skillDirectory: skillDir, basePath,
      projectRoot: options.scope === "local" ? installationRoot(options.scope, options.project) : undefined,
    }).map((plan) => ({ ...plan, policyOverride: overrides[target] !== undefined })));
  }
  const destinations = new Set<string>();
  for (const plan of plans) {
    assertWithinRoot(installationRoot(options.scope, options.project), plan.destination);
    if (destinations.has(plan.destination)) throw new Error(`Multiple artifacts target the same path: ${plan.destination}`);
    destinations.add(plan.destination);
  }
  return plans;
}

export async function previewInstall(options: InstallOptions): Promise<InstallationPreview[]> {
  return (await planInstall(options)).map((plan) => ({ target: plan.target, profile: plan.profile, path: plan.destination }));
}

export async function install(options: InstallOptions): Promise<OperationResult[]> {
  const metadata = await loadMetadata();
  const root = installationRoot(options.scope, options.project);
  const ownershipPath = manifestPath(options.scope, options.project);
  const manifest = await readManifest(ownershipPath);
  const results: OperationResult[] = [];
  const planned: Array<ArtifactPlan & { nextChecksum: string; manifestRelativePath: string; currentChecksum?: string }> = [];
  for (const plan of await planInstall(options)) {
    const nextChecksum = checksum(plan.content);
    const manifestRelativePath = toManifestPath(root, plan.destination);
    const existingEntry = manifest.artifacts.find((artifact) => artifact.package === PACKAGE_NAME && artifact.path === manifestRelativePath);
    const currentChecksum = await fileChecksum(plan.destination);
    if (currentChecksum && currentChecksum !== nextChecksum && existingEntry && plan.kind === "agent"
      && plan.profile !== "default" && !options.force && !plan.policyOverride && !options.profiles.some((profile) => profile.name === plan.profile)
      && (existingEntry.model !== plan.model || existingEntry.reasoningEffort !== plan.reasoningEffort)) {
      throw new Error(`Preserving existing named profile settings: ${plan.destination}\nUse --policy with matching settings or different candidate names; --force explicitly replaces it.`);
    }
    if (currentChecksum && currentChecksum !== nextChecksum && existingEntry?.checksum !== currentChecksum && !options.force) {
      throw new Error(`Refusing to overwrite modified or unowned file: ${plan.destination}\nRe-run with --force after reviewing it.`);
    }
    planned.push({ ...plan, nextChecksum, manifestRelativePath, currentChecksum });
  }

  for (const plan of planned) {
    await mkdir(path.dirname(plan.destination), { recursive: true });
    if (plan.currentChecksum !== plan.nextChecksum) await writeFile(plan.destination, plan.content, "utf8");
    const entry: ManifestArtifact = {
      package: PACKAGE_NAME,
      agent: metadata.id,
      target: plan.target,
      scope: options.scope,
      profile: plan.profile,
      kind: plan.kind,
      ...(plan.model ? { model: plan.model } : {}),
      ...(plan.reasoningEffort ? { reasoningEffort: plan.reasoningEffort } : {}),
      version: metadata.version,
      path: plan.manifestRelativePath,
      checksum: plan.nextChecksum,
    };
    upsertArtifact(manifest.artifacts, entry);

    results.push({
      action: plan.currentChecksum === plan.nextChecksum ? "unchanged" : plan.currentChecksum ? "updated" : "installed",
      path: plan.destination,
    });
  }

  await writeManifest(ownershipPath, manifest);
  return results;
}

export async function uninstall(
  options: Pick<InstallOptions, "targets" | "scope" | "project" | "force">,
): Promise<OperationResult[]> {
  const root = installationRoot(options.scope, options.project);
  const ownershipPath = manifestPath(options.scope, options.project);
  const manifest = await readManifest(ownershipPath);
  const targetSet = new Set(options.targets);
  const owned = manifest.artifacts.filter(
    (artifact) => artifact.package === PACKAGE_NAME && (targetSet.size === 0 || targetSet.has(artifact.target)),
  );
  const results: OperationResult[] = [];
  const removedPaths = new Set<string>();

  for (const artifact of owned) {
    const destination = resolveOwnedPath(root, artifact.path);
    const currentChecksum = await fileChecksum(destination);
    if (!currentChecksum) {
      results.push({ action: "missing", path: destination });
      removedPaths.add(artifact.path);
      continue;
    }
    if (currentChecksum !== artifact.checksum && !options.force) {
      results.push({ action: "preserved", path: destination, detail: "modified since installation" });
      continue;
    }
    await unlink(destination);
    results.push({ action: "removed", path: destination });
    removedPaths.add(artifact.path);
  }

  manifest.artifacts = manifest.artifacts.filter(
    (artifact) => artifact.package !== PACKAGE_NAME || !removedPaths.has(artifact.path),
  );
  await writeManifest(ownershipPath, manifest);
  return results;
}

export async function status(options: Pick<InstallOptions, "scope" | "project">): Promise<Array<ManifestArtifact & { state: string }>> {
  const root = installationRoot(options.scope, options.project);
  const manifest = await readManifest(manifestPath(options.scope, options.project));
  const output: Array<ManifestArtifact & { state: string }> = [];
  for (const artifact of manifest.artifacts.filter((entry) => entry.package === PACKAGE_NAME)) {
    const current = await fileChecksum(resolveOwnedPath(root, artifact.path));
    output.push({
      ...artifact,
      state: !current ? "missing" : current === artifact.checksum ? "current" : "modified",
    });
  }
  return output;
}

function resolveDestination(
  target: TargetId,
  options: InstallOptions,
  agentId: string,
  profile?: string,
): string {
  if (target !== "generic") return adapterPath(target, options.scope, agentId, profile, options.project);
  if (!options.output) throw new Error("The generic target requires --output <path>.");
  const requested = path.resolve(installationRoot(options.scope, options.project), options.output);
  return path.extname(requested).toLowerCase() === ".md"
    ? requested
    : path.join(requested, `${adapterName(agentId)}.md`);
}

function upsertArtifact(artifacts: ManifestArtifact[], next: ManifestArtifact): void {
  const index = artifacts.findIndex((artifact) => artifact.package === next.package && artifact.path === next.path);
  if (index < 0) artifacts.push(next);
  else artifacts[index] = next;
}

function toManifestPath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

function fromManifestPath(file: string): string {
  return file.split("/").join(path.sep);
}

function resolveOwnedPath(root: string, manifestFile: string): string {
  const destination = path.resolve(root, fromManifestPath(manifestFile));
  assertWithinRoot(root, destination);
  return destination;
}

function assertWithinRoot(root: string, destination: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(destination));
  if (relative === "" || relative === ".") throw new Error(`Refusing to use the installation root as an adapter file: ${destination}`);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Adapter path escapes the selected installation scope: ${destination}`);
  }
}
