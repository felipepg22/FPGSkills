import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { checksum, fileChecksum, readManifest, writeManifest } from "./manifest.js";
import { installationRoot, loadPackageVersion, manifestPath, packageRoot, SKILL_ID, skillDirectory } from "./paths.js";
import type { InstallScope, ManifestArtifact, TargetId } from "./types.js";

const PACKAGE_NAME = "@fpgskills/fpg-agents-md-writer";
const SOURCE_FILES = [
  "SKILL.md",
  "agents/openai.yaml",
  "references/authoring.md",
  "references/proposal.md",
  "references/research.md",
  "references/validation.md",
] as const;

export interface InstallOptions {
  targets: TargetId[];
  scope: InstallScope;
  project?: string;
  output?: string;
  force?: boolean;
}

export interface OperationResult {
  action: "installed" | "updated" | "unchanged" | "removed" | "preserved" | "missing" | "failed";
  target: TargetId;
  path: string;
  detail?: string;
}

export interface InstallationPreview {
  target: TargetId;
  path: string;
}

interface FilePlan {
  destination: string;
  relativeSource: string;
  content: Buffer;
  nextChecksum: string;
  currentChecksum?: string;
  manifestRelativePath: string;
}

export async function previewInstall(options: InstallOptions): Promise<InstallationPreview[]> {
  return options.targets.map((target) => ({
    target,
    path: resolveSkillDirectory(target, options),
  }));
}

export async function install(options: InstallOptions): Promise<OperationResult[]> {
  if (options.targets.length === 0) throw new Error("At least one target is required.");
  const root = installationRoot(options.scope, options.project);
  const ownershipPath = manifestPath(options.scope, options.project);
  const manifest = await readManifest(ownershipPath);
  const version = await loadPackageVersion();
  const results: OperationResult[] = [];

  for (const target of options.targets) {
    let destinationRoot = target === "generic"
      ? path.resolve(root, options.output ?? "<required-output>", SKILL_ID)
      : skillDirectory(target, options.scope, options.project, options.output);
    try {
      destinationRoot = resolveSkillDirectory(target, options);
      const plans = await planTarget(target, destinationRoot, root, manifest.artifacts, options.force ?? false);
      for (const plan of plans) {
        await mkdir(path.dirname(plan.destination), { recursive: true });
        if (plan.currentChecksum !== plan.nextChecksum) await writeFile(plan.destination, plan.content);
        upsertArtifact(manifest.artifacts, {
          package: PACKAGE_NAME,
          skill: SKILL_ID,
          target,
          scope: options.scope,
          version,
          path: plan.manifestRelativePath,
          checksum: plan.nextChecksum,
        });
      }
      await writeManifest(ownershipPath, manifest);
      const changed = plans.filter((plan) => plan.currentChecksum !== plan.nextChecksum);
      results.push({
        action: changed.length === 0 ? "unchanged" : changed.some((plan) => plan.currentChecksum) ? "updated" : "installed",
        target,
        path: destinationRoot,
      });
    } catch (error: unknown) {
      results.push({
        action: "failed",
        target,
        path: destinationRoot,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
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
    try {
      const currentChecksum = await fileChecksum(destination);
      if (!currentChecksum) {
        results.push({ action: "missing", target: artifact.target, path: destination });
        removedPaths.add(artifact.path);
      } else if (currentChecksum !== artifact.checksum && !options.force) {
        results.push({ action: "preserved", target: artifact.target, path: destination, detail: "modified since installation" });
      } else {
        await unlink(destination);
        results.push({ action: "removed", target: artifact.target, path: destination });
        removedPaths.add(artifact.path);
      }
    } catch (error: unknown) {
      results.push({
        action: "failed",
        target: artifact.target,
        path: destination,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  manifest.artifacts = manifest.artifacts.filter(
    (artifact) => artifact.package !== PACKAGE_NAME || !removedPaths.has(artifact.path),
  );
  await writeManifest(ownershipPath, manifest);
  return results;
}

export async function status(
  options: Pick<InstallOptions, "scope" | "project">,
): Promise<Array<ManifestArtifact & { state: string }>> {
  const root = installationRoot(options.scope, options.project);
  const manifest = await readManifest(manifestPath(options.scope, options.project));
  const output: Array<ManifestArtifact & { state: string }> = [];
  for (const artifact of manifest.artifacts.filter((entry) => entry.package === PACKAGE_NAME)) {
    const current = await fileChecksum(resolveOwnedPath(root, artifact.path));
    output.push({ ...artifact, state: !current ? "missing" : current === artifact.checksum ? "current" : "modified" });
  }
  return output;
}

function resolveSkillDirectory(target: TargetId, options: InstallOptions): string {
  const root = installationRoot(options.scope, options.project);
  const destination = skillDirectory(target, options.scope, options.project, options.output);
  assertWithinRoot(root, destination);
  return destination;
}

async function planTarget(
  target: TargetId,
  destinationRoot: string,
  installationRootPath: string,
  artifacts: ManifestArtifact[],
  force: boolean,
): Promise<FilePlan[]> {
  const plans: FilePlan[] = [];
  for (const relativeSource of SOURCE_FILES) {
    const source = path.join(packageRoot, relativeSource);
    const destination = path.join(destinationRoot, relativeSource);
    assertWithinRoot(installationRootPath, destination);
    const content = await readFile(source);
    const nextChecksum = checksum(content);
    const currentChecksum = await fileChecksum(destination);
    const manifestRelativePath = toManifestPath(installationRootPath, destination);
    const existingEntry = artifacts.find(
      (artifact) => artifact.package === PACKAGE_NAME && artifact.target === target && artifact.path === manifestRelativePath,
    );
    if (currentChecksum && currentChecksum !== nextChecksum) {
      const isOwnedAndUnmodified = existingEntry?.checksum === currentChecksum;
      if (!isOwnedAndUnmodified && !force) {
        throw new Error(`Refusing to overwrite modified or unowned file: ${destination}`);
      }
    }
    plans.push({ destination, relativeSource, content, nextChecksum, currentChecksum, manifestRelativePath });
  }
  return plans;
}

function upsertArtifact(artifacts: ManifestArtifact[], next: ManifestArtifact): void {
  const index = artifacts.findIndex((artifact) => artifact.package === next.package && artifact.path === next.path);
  if (index < 0) artifacts.push(next);
  else artifacts[index] = next;
}

function toManifestPath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

function resolveOwnedPath(root: string, manifestFile: string): string {
  const destination = path.resolve(root, manifestFile.split("/").join(path.sep));
  assertWithinRoot(root, destination);
  return destination;
}

function assertWithinRoot(root: string, destination: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(destination));
  if (relative === "" || relative === ".") throw new Error(`Refusing to use the installation root as a skill directory: ${destination}`);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Skill path escapes the selected installation scope: ${destination}`);
  }
}
