import { mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { checksum, fileChecksum, readManifest, writeManifest } from "./manifest.js";
import { installationRoot, loadPackageVersion, manifestPath, packageRoot, SKILL_ID, skillDirectory } from "./paths.js";
import { CANONICAL_FILES } from "./resources.js";
import { TARGET_IDS, type InstallScope, type ManifestArtifact, type TargetId } from "./types.js";

const PACKAGE_NAME = "@fpgskills/performance-testing";
const SOURCE_FILES = CANONICAL_FILES;

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
  await assertSafeManifestPath(root, ownershipPath);
  const manifest = await readManifest(ownershipPath);
  const version = await loadPackageVersion();
  const results: OperationResult[] = [];

  for (const target of options.targets) {
    let destinationRoot = target === "generic"
      ? path.resolve(root, options.output ?? "<required-output>", SKILL_ID)
      : skillDirectory(target, options.scope, options.project, options.output);
    try {
      destinationRoot = resolveSkillDirectory(target, options);
      await assertResolvedWithinRoot(root, destinationRoot);
      await assertResolvedWithinDirectory(path.dirname(destinationRoot), destinationRoot);
      const plans = await planTarget(target, destinationRoot, root, manifest.artifacts, options.force ?? false);
      for (const plan of plans) {
        await assertResolvedWithinRoot(root, plan.destination);
        await assertResolvedWithinDirectory(destinationRoot, plan.destination);
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
      await assertSafeManifestPath(root, ownershipPath);
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
  await assertSafeManifestPath(root, ownershipPath);
  const manifest = await readManifest(ownershipPath);
  const targetSet = new Set(options.targets);
  const owned = manifest.artifacts.filter(
    (artifact) => artifact.package === PACKAGE_NAME && (targetSet.size === 0 || targetSet.has(artifact.target)),
  );
  const results: OperationResult[] = [];
  const removedPaths = new Set<string>();

  for (const artifact of owned) {
    let destination = typeof artifact.path === "string"
      ? path.resolve(root, artifact.path.split("/").join(path.sep))
      : root;
    try {
      destination = await resolveAllowedArtifactPath(root, artifact, options.scope, options.project);
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
  await assertSafeManifestPath(root, ownershipPath);
  await writeManifest(ownershipPath, manifest);
  return results;
}

export async function status(
  options: Pick<InstallOptions, "scope" | "project">,
): Promise<Array<ManifestArtifact & { state: string }>> {
  const root = installationRoot(options.scope, options.project);
  const ownershipPath = manifestPath(options.scope, options.project);
  await assertSafeManifestPath(root, ownershipPath);
  const manifest = await readManifest(ownershipPath);
  const output: Array<ManifestArtifact & { state: string }> = [];
  for (const artifact of manifest.artifacts.filter((entry) => entry.package === PACKAGE_NAME)) {
    try {
      const destination = await resolveAllowedArtifactPath(root, artifact, options.scope, options.project);
      const current = await fileChecksum(destination);
      output.push({ ...artifact, state: !current ? "missing" : current === artifact.checksum ? "current" : "modified" });
    } catch {
      output.push({ ...artifact, state: "invalid" });
    }
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
    await assertResolvedWithinRoot(installationRootPath, destination);
    await assertResolvedWithinDirectory(destinationRoot, destination);
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

async function resolveAllowedArtifactPath(
  root: string,
  artifact: ManifestArtifact,
  scope: InstallScope,
  project?: string,
): Promise<string> {
  if (
    artifact.skill !== SKILL_ID
    || artifact.scope !== scope
    || !isTargetId(artifact.target)
    || typeof artifact.path !== "string"
    || artifact.path.length === 0
  ) {
    throw new Error(`Refusing invalid ownership manifest artifact: ${artifact.path}`);
  }

  const destination = resolveOwnedPath(root, artifact.path);
  const allowedRoot = artifact.target === "generic"
    ? genericSkillRoot(root, artifact.path)
    : skillDirectory(artifact.target, scope, project);
  assertWithinDirectory(allowedRoot, destination);
  const relativeArtifact = path.relative(allowedRoot, destination).split(path.sep).join("/");
  if (!(SOURCE_FILES as readonly string[]).includes(relativeArtifact)) {
    throw new Error(`Manifest artifact is not a canonical ${SKILL_ID} package file: ${destination}`);
  }
  await assertResolvedWithinRoot(root, destination);
  await assertResolvedWithinDirectory(allowedRoot, destination);
  return destination;
}

function genericSkillRoot(root: string, manifestFile: string): string {
  const components = manifestFile.split("/");
  if (components.some((component) => component === "" || component === "." || component === "..")) {
    throw new Error(`Refusing invalid generic ownership path: ${manifestFile}`);
  }
  const skillIndex = components.lastIndexOf(SKILL_ID);
  if (skillIndex < 0 || skillIndex === components.length - 1) {
    throw new Error(`Generic ownership path is not inside a ${SKILL_ID} installation: ${manifestFile}`);
  }
  return path.resolve(root, ...components.slice(0, skillIndex + 1));
}

function isTargetId(value: unknown): value is TargetId {
  return typeof value === "string" && (TARGET_IDS as readonly string[]).includes(value);
}

function assertWithinDirectory(directory: string, destination: string): void {
  const relative = path.relative(path.resolve(directory), path.resolve(destination));
  if (relative === "" || relative === "." || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Manifest artifact is outside its ${SKILL_ID} installation: ${destination}`);
  }
}

async function assertResolvedWithinRoot(root: string, destination: string): Promise<void> {
  assertWithinRoot(root, destination);
  const resolvedRoot = await resolveThroughExistingAncestors(root);
  const resolvedDestination = await resolveThroughExistingAncestors(destination);
  const relative = path.relative(resolvedRoot, resolvedDestination);
  if (relative === "" || relative === "." || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Skill path resolves outside the selected installation scope: ${destination}`);
  }
}

async function assertSafeManifestPath(root: string, destination: string): Promise<void> {
  await assertResolvedWithinRoot(root, destination);
  await assertResolvedWithinDirectory(path.dirname(destination), destination);
}

async function assertResolvedWithinDirectory(directory: string, destination: string): Promise<void> {
  const resolvedDirectory = await resolveThroughExistingAncestors(directory);
  const resolvedDestination = await resolveThroughExistingAncestors(destination);
  const relative = path.relative(resolvedDirectory, resolvedDestination);
  if (relative === "" || relative === "." || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Manifest artifact resolves outside its ${SKILL_ID} installation: ${destination}`);
  }
}

async function resolveThroughExistingAncestors(candidate: string): Promise<string> {
  let current = path.resolve(candidate);
  const missing: string[] = [];
  while (true) {
    try {
      return path.join(await realpath(current), ...missing.reverse());
    } catch (error: unknown) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missing.push(path.basename(current));
      current = parent;
    }
  }
}

function assertWithinRoot(root: string, destination: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(destination));
  if (relative === "" || relative === ".") throw new Error(`Refusing to use the installation root as a skill directory: ${destination}`);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Skill path escapes the selected installation scope: ${destination}`);
  }
}
