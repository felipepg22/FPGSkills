#!/usr/bin/env node
import { parseArguments } from "./arguments.js";
import { completeInteractively, InteractiveCancellation, runInteractiveInstall } from "./interactive.js";
import { status, uninstall, type OperationResult } from "./installer.js";
import { stdin, stdout } from "node:process";

const HELP = `Task Executor installer

Usage:
  task-executor
  task-executor install --target <target> --scope <local|global> [options]
  task-executor uninstall --scope <local|global> [--target <target>] [--force]
  task-executor status --scope <local|global> [--json]

Targets:
  codex, opencode, cursor, claude-code, antigravity, generic

Options:
  --target <ids>          Repeat or use comma-separated target IDs
  --scope <scope>         local or global
  --project <path>        Project root for local scope (default: current directory interactively)
  --profile <name=model>  Install an additional named model profile; repeatable
  --profile-effort <name=level>
                          Set a profile reasoning effort; repeatable
  --output <path>         Required destination file or directory for generic Markdown
  --force                 Overwrite conflicts or remove modified owned adapters
  --json                  JSON output for status
  --help                  Show this help
`;

async function main(): Promise<void> {
  let args = parseArguments(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  if (!args.command) {
    if (stdin.isTTY && stdout.isTTY) args.command = "install";
    else {
      process.stdout.write(HELP);
      return;
    }
  }

  switch (args.command) {
    case "install": {
      const results = await runInteractiveInstall(args);
      if (results) printResults(results);
      break;
    }
    case "uninstall": {
      args = await completeInteractively(args);
      if (!args.scope) throw new Error("--scope is required when no interactive terminal is available.");
      printResults(await uninstall({ targets: args.targets, scope: args.scope, project: args.project, force: args.force }));
      break;
    }
    case "status": {
      args = await completeInteractively(args);
      if (!args.scope) throw new Error("--scope is required when no interactive terminal is available.");
      const entries = await status({ scope: args.scope, project: args.project });
      if (args.json) process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
      else if (entries.length === 0) process.stdout.write("No Task Executor adapters are recorded in this scope.\n");
      else for (const entry of entries) process.stdout.write(`${entry.state.padEnd(8)} ${entry.target.padEnd(12)} ${entry.profile.padEnd(12)} ${entry.path}\n`);
      break;
    }
  }
}

function printResults(results: OperationResult[]): void {
  if (results.length === 0) {
    process.stdout.write("No matching Task Executor adapters found.\n");
    return;
  }
  for (const result of results) {
    process.stdout.write(`${result.action.padEnd(10)} ${result.path}${result.detail ? ` (${result.detail})` : ""}\n`);
  }
}

main().catch((error: unknown) => {
  if (error instanceof InteractiveCancellation) return;
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
