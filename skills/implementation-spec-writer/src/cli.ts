#!/usr/bin/env node
import { stdin, stdout } from "node:process";
import { parseArguments } from "./arguments.js";
import { completeInteractively, InteractiveCancellation, runInteractiveInstall } from "./interactive.js";
import { status, uninstall, type OperationResult } from "./installer.js";

const HELP = `Implementation Spec Writer installer

Usage:
  implementation-spec-writer
  implementation-spec-writer install --target <target> --scope <local|global> [options]
  implementation-spec-writer uninstall --scope <local|global> [--target <target>] [--force]
  implementation-spec-writer status --scope <local|global> [--json]

Targets:
  codex, opencode, cursor, claude-code, antigravity, generic

Options:
  --target <ids>      Repeat or use comma-separated target IDs
  --scope <scope>     local or global
  --project <path>    Project root for local scope
  --output <path>     Required parent directory for Generic Markdown
  --force             Replace conflicts or remove modified managed files
  --json              JSON output for status
  --help              Show this help
`;

async function main(): Promise<void> {
  let args = parseArguments(process.argv.slice(2));
  if (args.help) {
    stdout.write(HELP);
    return;
  }
  if (!args.command) {
    if (stdin.isTTY && stdout.isTTY) args.command = "install";
    else {
      stdout.write(HELP);
      return;
    }
  }

  switch (args.command) {
    case "install": {
      const results = await runInteractiveInstall(args);
      if (results) {
        printResults(results);
        if (results.some((result) => result.action === "failed")) process.exitCode = 1;
      }
      break;
    }
    case "uninstall": {
      args = await completeInteractively(args);
      if (!args.scope) throw new Error("--scope is required when no interactive terminal is available.");
      const results = await uninstall({ targets: args.targets, scope: args.scope, project: args.project, force: args.force });
      printResults(results);
      if (results.some((result) => result.action === "failed")) process.exitCode = 1;
      break;
    }
    case "status": {
      args = await completeInteractively(args);
      if (!args.scope) throw new Error("--scope is required when no interactive terminal is available.");
      const entries = await status({ scope: args.scope, project: args.project });
      if (args.json) stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
      else if (entries.length === 0) stdout.write("No Implementation Spec Writer files are recorded in this scope.\n");
      else for (const entry of entries) stdout.write(`${entry.state.padEnd(8)} ${entry.target.padEnd(12)} ${entry.path}\n`);
      break;
    }
  }
}

function printResults(results: OperationResult[]): void {
  if (results.length === 0) {
    stdout.write("No matching Implementation Spec Writer files found.\n");
    return;
  }
  for (const result of results) {
    stdout.write(`${result.action.padEnd(10)} ${result.target.padEnd(12)} ${result.path}${result.detail ? ` (${result.detail})` : ""}\n`);
  }
}

main().catch((error: unknown) => {
  if (error instanceof InteractiveCancellation) return;
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
