import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] ?? process.cwd());
const skillsRoot = path.join(root, "skills");
const expectedSkills = [
  "bdd-plan",
  "fpg-agents-md-writer",
  "fpg-implement",
  "implementation-spec-writer",
  "performance-testing",
];
const forbiddenNames = new Set([
  "dist",
  "node_modules",
  "package.json",
  "src",
  "test",
  "tests",
  "tsconfig.json",
]);
const forbiddenPathPatterns = [
  /(?:^|[\s`'"(])~?\/?\.claude\/skills\//i,
  /(?:^|[\s`'"(])~?\/?\.codex\/skills\//i,
  /(?:^|[\s`'"(])~?\/?\.cursor\/skills\//i,
];
const textExtensions = new Set([".json", ".md", ".sh", ".ts", ".txt", ".yaml", ".yml"]);
const errors = [];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    const directoryContents = entry.isDirectory() ? await readdir(entryPath) : null;
    if (forbiddenNames.has(entry.name) && (!entry.isDirectory() || directoryContents.length > 0)) {
      errors.push(`development-only payload entry: ${path.relative(root, entryPath)}`);
    }
    if (entry.isDirectory()) files.push(...await walk(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

const skillEntries = (await readdir(skillsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (JSON.stringify(skillEntries) !== JSON.stringify(expectedSkills)) {
  errors.push(`expected exactly ${expectedSkills.join(", ")}; found ${skillEntries.join(", ")}`);
}

for (const skill of expectedSkills) {
  const skillRoot = path.join(skillsRoot, skill);
  try {
    if (!(await stat(path.join(skillRoot, "SKILL.md"))).isFile()) {
      errors.push(`missing skills/${skill}/SKILL.md`);
      continue;
    }
  } catch {
    errors.push(`missing skills/${skill}/SKILL.md`);
    continue;
  }

  for (const file of await walk(skillRoot)) {
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    const contents = await readFile(file, "utf8");
    for (const pattern of forbiddenPathPatterns) {
      if (pattern.test(contents)) {
        errors.push(`agent-specific install path in ${path.relative(root, file)} (${pattern})`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Skill payloads are lean and agent-path portable.");
}
