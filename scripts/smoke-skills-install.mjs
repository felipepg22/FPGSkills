import { lstat, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSkillsRunner } from "./lib/spawn-skills-runner.mjs";

const repoRoot = path.resolve(process.env.SKILLS_REPO ?? process.cwd());
const cliVersion = process.env.SKILLS_CLI_VERSION ?? "1.5.23";
const mode = process.argv[2] ?? "copy";
const runner = process.env.SKILLS_RUNNER ?? "npx";
const expectedSkills = [
  "fpg-agents-md-writer",
  "implementation-spec-writer",
  "performance-testing",
];
const agentSnapshot = JSON.parse(
  await readFile(new URL("./skills-cli-1.5.23-agents.json", import.meta.url), "utf8"),
);

if (!new Set(["copy", "symlink"]).has(mode)) {
  throw new Error(`Unknown install mode: ${mode}`);
}

const installRoot = await mkdtemp(path.join(tmpdir(), `fpgskills-${mode}-`));
try {
  // Symlink mode only materializes destinations for detected agents. Seed every
  // pinned destination so `--agent '*'` exercises the complete registry in CI.
  if (mode === "symlink") {
    for (const destination of new Set(Object.values(agentSnapshot))) {
      await mkdir(path.join(installRoot, destination), { recursive: true });
    }
  }

  const args = runner === "bunx"
    ? [`skills@${cliVersion}`]
    : ["--yes", `skills@${cliVersion}`];
  args.push(
    "add",
    repoRoot,
    "--skill",
    "*",
    "--agent",
    "*",
    "-y",
    ...(mode === "copy" ? ["--copy"] : []),
  );

  const result = spawnSkillsRunner({
    runner,
    args,
    options: {
      cwd: installRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        CI: "1",
        DISABLE_TELEMETRY: "1",
        DO_NOT_TRACK: "1",
      },
    },
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status !== 0) {
    const launchError = result.error ? `\nLaunch error: ${result.error.message}` : "";
    throw new Error(`${runner} install failed (${result.status}):\n${output}${launchError}`);
  }
  const reportedAgentCount = Number(output.match(/Installing to all (\d+) agents/)?.[1]);
  if (!Number.isInteger(reportedAgentCount) || reportedAgentCount < 1) {
    throw new Error(`CLI did not report its installed-agent count:\n${output}`);
  }
  if (cliVersion !== "latest" && reportedAgentCount !== Object.keys(agentSnapshot).length) {
    throw new Error(
      `CLI reported ${reportedAgentCount || "no"} agents; pinned snapshot has ${Object.keys(agentSnapshot).length}`,
    );
  }

  for (const [agent, destination] of Object.entries(agentSnapshot)) {
    for (const skill of expectedSkills) {
      const source = await readFile(path.join(repoRoot, "skills", skill, "SKILL.md"), "utf8");
      const installedPath = path.join(installRoot, destination, skill, "SKILL.md");
      let installed;
      try {
        installed = await readFile(installedPath, "utf8");
      } catch (error) {
        throw new Error(`${agent} destination is missing ${skill}: ${installedPath}`, { cause: error });
      }
      // Eve normalizes frontmatter for its subagent format; every other target preserves the file.
      if (agent === "eve") {
        const heading = source.match(/^# .+$/m)?.[0];
        if (!heading || !installed.includes(heading)) {
          throw new Error(`Eve-normalized payload does not match ${skill}`);
        }
      } else if (source !== installed) {
        throw new Error(`Installed payload differs for ${agent}/${skill}`);
      }
    }
  }

  if (mode === "symlink") {
    const destinations = new Set(Object.values(agentSnapshot));
    destinations.delete(".agents/skills");
    destinations.delete("agent/skills"); // Eve materializes normalized subagent copies.
    for (const destination of destinations) {
      for (const skill of expectedSkills) {
        const installedRoot = path.join(installRoot, destination, skill);
        if (!(await lstat(installedRoot)).isSymbolicLink()) {
          throw new Error(`Expected symlink destination: ${destination}/${skill}`);
        }
      }
    }
    for (const skill of expectedSkills) {
      const eveRoot = path.join(installRoot, "agent/skills", skill);
      if (!(await lstat(eveRoot)).isDirectory()) throw new Error(`Expected Eve copy: ${skill}`);
    }
  } else {
    for (const destination of new Set(Object.values(agentSnapshot))) {
      for (const skill of expectedSkills) {
        const installedRoot = path.join(installRoot, destination, skill);
        const installedStat = await lstat(installedRoot);
        if (!installedStat.isDirectory() || installedStat.isSymbolicLink()) {
          throw new Error(`Expected a copied directory: ${destination}/${skill}`);
        }
      }
    }
  }

  console.log(`${runner} skills@${cliVersion} ${mode} install passed for all supported agents.`);
} finally {
  await rm(installRoot, { recursive: true, force: true });
}
