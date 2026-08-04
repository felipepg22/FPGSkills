import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OwnershipManifest } from "./types.js";

export const EMPTY_MANIFEST: OwnershipManifest = { schemaVersion: 1, artifacts: [] };

export async function readManifest(file: string): Promise<OwnershipManifest> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<OwnershipManifest>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.artifacts)) {
      throw new Error(`Unsupported ownership manifest: ${file}`);
    }
    return { schemaVersion: 1, artifacts: parsed.artifacts };
  } catch (error: unknown) {
    if (isMissing(error)) return { ...EMPTY_MANIFEST, artifacts: [] };
    throw error;
  }
}

export async function writeManifest(file: string, manifest: OwnershipManifest): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const ordered: OwnershipManifest = {
    schemaVersion: 1,
    artifacts: [...manifest.artifacts].sort((left, right) => left.path.localeCompare(right.path)),
  };
  await writeFile(file, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
}

export function checksum(content: string | Buffer): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export async function fileChecksum(file: string): Promise<string | undefined> {
  try {
    return checksum(await readFile(file));
  } catch (error: unknown) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
