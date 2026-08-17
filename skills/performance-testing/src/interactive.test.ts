import assert from "node:assert/strict";
import test from "node:test";
import type { CliArguments } from "./arguments.js";
import { runInteractiveInstall, type InteractiveInstallDependencies } from "./interactive.js";
import type { InstallOptions } from "./installer.js";

test("guided install defaults to detected targets and project scope", async () => {
  const args: CliArguments = { targets: [], force: false, json: false, help: false };
  let installed: InstallOptions | undefined;
  const notes: string[] = [];
  const prompter: NonNullable<InteractiveInstallDependencies["prompter"]> = {
    intro: () => undefined,
    outro: () => undefined,
    cancel: () => undefined,
    multiselectTargets: async (_options, initialValues) => initialValues,
    selectScope: async (initialValue) => initialValue,
    text: async (options) => options.initialValue ?? "",
    confirm: async () => true,
    note: (message) => notes.push(message),
    spinner: () => ({ start: () => undefined, stop: () => undefined, error: () => undefined }),
  };

  await runInteractiveInstall(args, {
    isInteractive: () => true,
    detectTargets: async () => ["codex", "cursor"],
    previewInstall: async (options) => options.targets.map((target) => ({ target, path: `/tmp/${target}` })),
    install: async (options) => {
      installed = options;
      return [];
    },
    prompter,
  });

  assert.deepEqual(installed?.targets, ["codex", "cursor"]);
  assert.equal(installed?.scope, "local");
  assert.equal(installed?.project, process.cwd());
  assert.match(notes[0] ?? "", /Conflict policy: preserve and report/);
});
