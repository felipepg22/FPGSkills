import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { packageRoot } from "./paths.js";

const required = [
  "SKILL.md",
  "agents/openai.yaml",
  "references/workflow.md",
  "references/spec-schema.md",
  "references/readiness.md",
];

for (const relative of required) await access(path.join(packageRoot, relative));

const skill = await readFile(path.join(packageRoot, "SKILL.md"), "utf8");
if (!skill.startsWith("---\nname: implementation-spec-writer\ndescription:")) {
  throw new Error("SKILL.md frontmatter is invalid.");
}
if (!skill.includes("disable-model-invocation: true")) {
  throw new Error("SKILL.md must remain user-invoked.");
}
for (const relative of required.filter((file) => file.startsWith("references/"))) {
  if (!skill.includes(`(${relative})`)) throw new Error(`SKILL.md does not route to ${relative}.`);
}

process.stdout.write("Implementation Spec Writer source is valid.\n");
