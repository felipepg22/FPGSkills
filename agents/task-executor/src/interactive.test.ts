import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import {
  INTERACTIVE_CANCELLED,
  runInteractiveInstall,
  type InteractivePrompter,
  type PromptSpinner,
  type TargetOption,
  type TextPromptOptions,
} from "./interactive.js";
import type { CliArguments } from "./arguments.js";
import type { InstallScope, TargetId } from "./types.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("guided install selects targets, confirms, and writes the selected adapters", async () => {
  const project = await temporaryProject();
  const prompts = scriptedPrompter({
    targets: ["codex", "cursor"],
    scope: "local",
    text: [project],
    confirms: [false, true],
  });

  const results = await runInteractiveInstall(baseArguments(), {
    isInteractive: () => true,
    detectTargets: async () => ["codex"],
    prompter: prompts,
  });

  assert.equal(results?.length, 2);
  assert.match(await readFile(path.join(project, ".codex/agents/task-executor.toml"), "utf8"), /developer_instructions/);
  assert.match(await readFile(path.join(project, ".cursor/agents/task-executor.md"), "utf8"), /Task Executor/);
  assert.deepEqual(prompts.initialTargets, ["codex"]);
  assert.equal(prompts.summaryCount, 1);
});

test("declining the final confirmation does not invoke the installer", async () => {
  const project = await temporaryProject();
  const prompts = scriptedPrompter({
    targets: ["codex"],
    scope: "local",
    text: [project],
    confirms: [false, false],
  });
  let installCalls = 0;

  const results = await runInteractiveInstall(baseArguments(), {
    isInteractive: () => true,
    prompter: prompts,
    install: async () => {
      installCalls += 1;
      return [];
    },
  });

  assert.equal(results, undefined);
  assert.equal(installCalls, 0);
});

test("generic installation asks for an explicit output path and skips profiles", async () => {
  const project = await temporaryProject();
  const output = path.join(project, "adapters");
  const prompts = scriptedPrompter({
    targets: ["generic"],
    scope: "local",
    text: [project, output],
    confirms: [true],
  });
  const results = await runInteractiveInstall(baseArguments(), {
    isInteractive: () => true,
    prompter: prompts,
  });

  assert.equal(results?.length, 1);
  assert.match(await readFile(path.join(output, "task-executor.md"), "utf8"), /Task Executor/);
  assert.deepEqual(prompts.confirmMessages, ["Proceed with installation?"]);
});

test("fully specified installs bypass the interactive prompts", async () => {
  const project = await temporaryProject();
  let installCalls = 0;
  const results = await runInteractiveInstall(
    {
      ...baseArguments(),
      targets: ["codex"],
      scope: "local",
      project,
    },
    {
      isInteractive: () => true,
      prompter: scriptedPrompter({ targets: [], scope: "local", text: [], confirms: [] }),
      install: async (options) => {
        installCalls += 1;
        assert.deepEqual(options.targets, ["codex"]);
        return [];
      },
    },
  );

  assert.deepEqual(results, []);
  assert.equal(installCalls, 1);
});

test("profile prompts collect validated named models", async () => {
  const prompts = scriptedPrompter({
    targets: ["codex"],
    scope: "global",
    text: ["luna", "vendor/luna"],
    confirms: [true, false, true],
  });
  let profileNames: string[] = [];

  await runInteractiveInstall(baseArguments(), {
    isInteractive: () => true,
    prompter: prompts,
    install: async (options) => {
      profileNames = options.profiles.map((profile) => profile.name);
      return [];
    },
  });

  assert.deepEqual(profileNames, ["luna"]);
  assert.match(prompts.notes[0] ?? "", /Scope: Global/);
});

test("prompt cancellation is surfaced without invoking the installer", async () => {
  const prompts = scriptedPrompter({
    targets: [],
    scope: "local",
    text: [],
    confirms: [],
    cancelledTargets: true,
  });
  let installCalls = 0;

  await assert.rejects(
    runInteractiveInstall(baseArguments(), {
      isInteractive: () => true,
      prompter: prompts,
      install: async () => {
        installCalls += 1;
        return [];
      },
    }),
    /Installation cancelled/,
  );
  assert.equal(installCalls, 0);
});

function baseArguments(): CliArguments {
  return {
    command: "install",
    targets: [],
    profiles: [],
    force: false,
    json: false,
    help: false,
  };
}

async function temporaryProject(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "fpgskills-interactive-"));
  temporaryDirectories.push(directory);
  return directory;
}

interface ScriptedOptions {
  targets: TargetId[];
  scope: InstallScope;
  text: string[];
  confirms: boolean[];
  cancelledTargets?: boolean;
}

function scriptedPrompter(options: ScriptedOptions): InteractivePrompter & {
  initialTargets?: TargetId[];
  summaryCount: number;
  confirmMessages: string[];
  notes: string[];
} {
  let textIndex = 0;
  let confirmIndex = 0;
  const state = {
    initialTargets: undefined as TargetId[] | undefined,
    summaryCount: 0,
    confirmMessages: [] as string[],
    notes: [] as string[],
  };
  const promptSpinner: PromptSpinner = {
    start: () => undefined,
    stop: () => undefined,
    error: () => undefined,
  };
  const prompter = {
    ...state,
    intro: () => undefined,
    outro: () => undefined,
    cancel: () => undefined,
    multiselectTargets: async (_targetOptions: TargetOption[], initialValues: TargetId[]) => {
      prompter.initialTargets = initialValues;
      return options.cancelledTargets ? INTERACTIVE_CANCELLED : options.targets;
    },
    selectScope: async () => options.scope,
    text: async (_promptOptions: TextPromptOptions) => options.text[textIndex++] ?? "",
    confirm: async (message: string) => {
      prompter.confirmMessages.push(message);
      return options.confirms[confirmIndex++] ?? false;
    },
    note: (message: string) => {
      prompter.summaryCount += 1;
      prompter.notes.push(message);
    },
    spinner: () => promptSpinner,
  };
  return prompter;
}
