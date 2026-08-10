import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { packageRoot } from "./paths.js";

const required = [
  "SKILL.md",
  "agents/openai.yaml",
  "references/authoring.md",
  "references/proposal.md",
  "references/research.md",
  "references/validation.md",
];

for (const relative of required) await access(path.join(packageRoot, relative));

const skill = await readFile(path.join(packageRoot, "SKILL.md"), "utf8");
if (!skill.startsWith("---\nname: fpg-agents-md-writer\ndescription:")) {
  throw new Error("SKILL.md frontmatter is invalid.");
}
for (const relative of required.filter((file) => file.startsWith("references/"))) {
  if (!skill.includes(`(${relative})`)) throw new Error(`SKILL.md does not route to ${relative}.`);
}

process.stdout.write("FPG AGENTS.md Writer source is valid.\n");
