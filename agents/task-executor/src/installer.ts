import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  adapterName,
  adapterPath,
  installationRoot,
  loadMetadata,
  loadPrompt,
  manifestPath,
} from "./paths.js";
import { checksum, fileChecksum, readManifest, writeManifest } from "./manifest.js";
import { renderAdapter } from "./render.js";
import type { InstallScope, ManifestArtifact, ModelProfile, TargetId } from "./types.js";

const PACKAGE_NAME = "@fpgskills/task-executor";

export interface InstallOptions {
  targets: TargetId[];
  scope: InstallScope;
  project?: string;
  profiles: ModelProfile[];
  output?: string;
  force?: boolean;
}

export interface OperationResult {
  action: "installed" | "updated" | "unchanged" | "removed" | "preserved" | "missing";
  path: string;
  detail?: string;
}

export async function install(options: InstallOptions): Promise<OperationResult[]> {
  const metadata = await loadMetadata();
  const prompt = await loadPrompt();
  const root = installationRoot(options.scope, options.project);
  const ownershipPath = manifestPath(options.scope, options.project);
  const manifest = await readManifest(ownershipPath);
  const results: OperationResult[] = [];
  const planned: Array<{
    target: TargetId;
    profile?: ModelProfile;
    destination: string;
    content: string;
    nextChecksum: string;
    manifestRelativePath: string;
    currentChecksum?: string;
  }> = [];

  for (const target of options.targets) {
    const profiles: Array<ModelProfile | undefined> = target === "generic" ? [undefined] : [undefined, ...options.profiles];
    for (const profile of profiles) {
      const destination = resolveDestination(target, options, metadata.id, profile?.name);
      assertWithinRoot(root, destination);
      const content = renderAdapter({ metadata, prompt, target, profile });
      const nextChecksum = checksum(content);
      const manifestRelativePath = toManifestPath(root, destination);
      const existingEntry = manifest.artifacts.find(
        (artifact) => artifact.package === PACKAGE_NAME && artifact.path === manifestRelativePath,
      );
      const currentChecksum = await fileChecksum(destination);

      if (currentChecksum && currentChecksum !== nextChecksum) {
        const isOwnedAndUnmodified = existingEntry?.checksum === currentChecksum;
        if (!isOwnedAndUnmodified && !options.force) {
          throw new Error(`Refusing to overwrite modified or unowned file: ${destination}\nRe-run with --force after reviewing it.`);
        }
      }

      planned.push({ target, profile, destination, content, nextChecksum, manifestRelativePath, currentChecksum });
    }
  }

  for (const plan of planned) {
    await mkdir(path.dirname(plan.destination), { recursive: true });
    if (plan.currentChecksum !== plan.nextChecksum) await writeFile(plan.destination, plan.content, "utf8");
    const entry: ManifestArtifact = {
      package: PACKAGE_NAME,
      agent: metadata.id,
      target: plan.target,
      scope: options.scope,
      profile: plan.profile?.name ?? "inherit",
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
