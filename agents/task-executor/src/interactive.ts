import {
  cancel,
  confirm,
  intro,
  isCancel,
  multiselect,
  note,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { homedir } from "node:os";
import path from "node:path";
import { isTarget, parseProfile, type CliArguments } from "./arguments.js";
import { detectTargets } from "./paths.js";
import { install, previewInstall, type InstallOptions, type InstallationPreview, type OperationResult } from "./installer.js";
import { TARGET_IDS, type InstallScope, type TargetId } from "./types.js";

export const INTERACTIVE_CANCELLED = Symbol("interactive-cancelled");
export type PromptResult<T> = T | typeof INTERACTIVE_CANCELLED;

export interface TargetOption {
  value: TargetId;
  label: string;
  hint: string;
}

export interface TextPromptOptions {
  message: string;
  initialValue?: string;
  placeholder?: string;
  validate?: (value: string) => string | undefined;
}

export interface PromptSpinner {
  start(message: string): void;
  stop(message: string): void;
  error(message: string): void;
}

export interface InteractivePrompter {
  intro(title: string): void;
  outro(message: string): void;
  cancel(message: string): void;
  multiselectTargets(options: TargetOption[], initialValues: TargetId[]): Promise<PromptResult<TargetId[]>>;
  selectScope(initialValue: InstallScope): Promise<PromptResult<InstallScope>>;
  text(options: TextPromptOptions): Promise<PromptResult<string>>;
  confirm(message: string, initialValue: boolean): Promise<PromptResult<boolean>>;
  note(message: string, title: string): void;
  spinner(): PromptSpinner;
}

export interface InteractiveInstallDependencies {
  isInteractive?: () => boolean;
  detectTargets?: () => Promise<Exclude<TargetId, "generic">[]>;
  previewInstall?: (options: InstallOptions) => Promise<InstallationPreview[]>;
  install?: (options: InstallOptions) => Promise<OperationResult[]>;
  prompter?: InteractivePrompter;
}

const TARGET_LABELS: Record<TargetId, string> = {
  codex: "Codex",
  opencode: "OpenCode",
  cursor: "Cursor",
  "claude-code": "Claude Code",
  antigravity: "Antigravity",
  generic: "Generic Markdown",
};

const TARGET_HINTS: Record<TargetId, string> = {
  codex: ".codex/agents/task-executor.toml",
  opencode: ".opencode/agents/task-executor.md",
  cursor: ".cursor/agents/task-executor.md",
  "claude-code": ".claude/agents/task-executor.md",
  antigravity: ".agents/agents/task-executor.md",
  generic: "write a Markdown adapter to a chosen path",
};

const TARGET_OPTIONS: TargetOption[] = TARGET_IDS.map((value) => ({
  value,
  label: TARGET_LABELS[value],
  hint: TARGET_HINTS[value],
}));

export async function runInteractiveInstall(
  args: CliArguments,
  dependencies: InteractiveInstallDependencies = {},
): Promise<OperationResult[] | undefined> {
  const installOperation = dependencies.install ?? install;
  const interactive = dependencies.isInteractive ?? (() => Boolean(stdin.isTTY && stdout.isTTY));

  if (!interactive() || !needsInstallWizard(args)) return installOperation(toInstallOptions(args));

  const prompter = dependencies.prompter ?? createClackPrompter();
  const detect = dependencies.detectTargets ?? detectTargets;
  const preview = dependencies.previewInstall ?? previewInstall;

  prompter.intro("Task Executor installer");

  const detected = await detect();
  const selectedTargets = args.targets.length > 0
    ? args.targets
    : await requiredResult<TargetId[]>(prompter.multiselectTargets(TARGET_OPTIONS, detected), prompter);
  if (selectedTargets.length === 0) throw new Error("At least one target is required.");
  args.targets = [...new Set(selectedTargets)];

  if (!args.scope) {
    args.scope = await requiredResult<InstallScope>(prompter.selectScope("local"), prompter);
  }

  if (args.scope === "local" && !args.project) {
    args.project = await requiredResult<string>(
      prompter.text({
        message: "Project root",
        initialValue: process.cwd(),
        validate: requiredText("Project root"),
      }),
      prompter,
    );
  }

  if (args.targets.includes("generic") && !args.output) {
    args.output = await requiredResult<string>(
      prompter.text({
        message: "Generic Markdown output path",
        placeholder: "task-executor.md",
        validate: requiredText("Output path"),
      }),
      prompter,
    );
  }

  if (args.profiles.length === 0 && args.targets.some((target) => target !== "generic")) {
    const addProfiles = await requiredResult<boolean>(prompter.confirm("Add named model profiles?", false), prompter);
    if (addProfiles) await collectProfiles(args, prompter);
  }

  const options = toInstallOptions(args);
  const previews = await preview(options);
  prompter.note(formatSummary(options, previews), "Installation summary");
  const proceed = await requiredResult<boolean>(prompter.confirm("Proceed with installation?", true), prompter);
  if (!proceed) {
    prompter.cancel("Installation cancelled.");
    return undefined;
  }

  const progress = prompter.spinner();
  progress.start("Installing Task Executor");
  try {
    const results = await installOperation(options);
    progress.stop("Installation complete");
    prompter.outro("Task Executor is ready to use.");
    return results;
  } catch (error) {
    progress.error("Installation failed");
    throw error;
  }
}

/**
 * Retains the original line-based prompts for uninstall and status. Installation
 * uses the guided wizard above, while these commands remain intentionally simple.
 */
export async function completeInteractively(args: CliArguments): Promise<CliArguments> {
  if (!stdin.isTTY || !stdout.isTTY) return args;
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    if (args.command === "uninstall" && args.targets.length === 0) {
      const detected = await detectTargets();
      stdout.write(`Targets: codex, opencode, cursor, claude-code, antigravity, generic\n`);
      if (detected.length > 0) stdout.write(`Detected: ${detected.join(", ")}\n`);
      const answer = await prompt.question(`Select comma-separated targets${detected.length ? ` [${detected.join(",")}]` : ""}: `);
      args.targets = parseTargets(answer || detected.join(","));
    }
    if (!args.scope) {
      const answer = (await prompt.question("Scope local/global [local]: ")).trim();
      args.scope = parseScope(answer || "local");
    }
    if (args.scope === "local" && !args.project) {
      const answer = (await prompt.question(`Project root [${process.cwd()}]: `)).trim();
      args.project = answer || process.cwd();
    }
    return args;
  } finally {
    prompt.close();
  }
}

function createClackPrompter(): InteractivePrompter {
  return {
    intro,
    outro,
    cancel,
    multiselectTargets: async (options, initialValues) => toPromptResult(await multiselect({
      message: "Which coding agents should receive Task Executor?",
      options,
      initialValues,
      required: true,
    })),
    selectScope: async (initialValue) => toPromptResult(await select({
      message: "Installation scope",
      options: [
        { value: "local", label: "Project", hint: "install into this repository" },
        { value: "global", label: "Global", hint: `install into ${homedir()}` },
      ],
      initialValue,
    }) as InstallScope | symbol),
    text: async (options) => toPromptResult(await text({
      ...options,
      validate: options.validate ? (value) => options.validate?.(value ?? "") : undefined,
    })),
    confirm: async (message, initialValue) => toPromptResult(await confirm({ message, initialValue })),
    note,
    spinner: () => spinner(),
  };
}

async function collectProfiles(args: CliArguments, prompter: InteractivePrompter): Promise<void> {
  let addAnother = true;
  while (addAnother) {
    const name = await requiredResult<string>(
      prompter.text({
        message: "Profile name",
        placeholder: "luna",
        validate: (value) => {
          if (args.profiles.some((profile) => profile.name === value)) return `Duplicate profile: ${value}`;
          try {
            parseProfile(`${value}=placeholder`);
            return undefined;
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          }
        },
      }),
      prompter,
    );
    const model = await requiredResult<string>(
      prompter.text({
        message: `Model identifier for ${name}`,
        placeholder: "vendor/model-id",
        validate: requiredText("Model identifier"),
      }),
      prompter,
    );
    args.profiles.push(parseProfile(`${name}=${model}`));
    addAnother = await requiredResult<boolean>(prompter.confirm("Add another profile?", false), prompter);
  }
}

function formatSummary(options: InstallOptions, previews: InstallationPreview[]): string {
  const scope = options.scope === "local" ? "Project" : "Global";
  const root = options.scope === "local" ? path.resolve(options.project ?? process.cwd()) : homedir();
  const profiles = options.profiles.length > 0 ? options.profiles.map((profile) => profile.name).join(", ") : "inherit only";
  const files = previews.map((entry) => `  ${TARGET_LABELS[entry.target]} (${entry.profile})\n  ${entry.path}`).join("\n");
  return [
    `Scope: ${scope}`,
    `Root: ${root}`,
    `Targets: ${options.targets.map((target) => TARGET_LABELS[target]).join(", ")}`,
    `Profiles: ${profiles}`,
    "",
    "Files:",
    files,
  ].join("\n");
}

function needsInstallWizard(args: CliArguments): boolean {
  return args.targets.length === 0
    || !args.scope
    || (args.scope === "local" && !args.project)
    || (args.targets.includes("generic") && !args.output);
}

function toInstallOptions(args: CliArguments): InstallOptions {
  if (!args.scope) throw new Error("--scope is required when no interactive terminal is available.");
  return {
    targets: args.targets,
    scope: args.scope,
    project: args.project,
    profiles: args.profiles,
    output: args.output,
    force: args.force,
  };
}

async function requiredResult<T>(
  result: T | typeof INTERACTIVE_CANCELLED | Promise<T | typeof INTERACTIVE_CANCELLED>,
  prompter: InteractivePrompter,
): Promise<T> {
  const resolved = await result;
  if (resolved === INTERACTIVE_CANCELLED) {
    prompter.cancel("Installation cancelled.");
    throw new InteractiveCancellation();
  }
  return resolved as T;
}

function requiredText(label: string): (value: string | undefined) => string | undefined {
  return (value) => value?.trim().length ? undefined : `${label} is required.`;
}

function toPromptResult<T>(value: T | symbol): PromptResult<T> {
  return isCancel(value) ? INTERACTIVE_CANCELLED : value as T;
}

export class InteractiveCancellation extends Error {
  constructor() {
    super("Installation cancelled.");
    this.name = "InteractiveCancellation";
  }
}

function parseTargets(value: string): TargetId[] {
  const targets = value.split(",").map((target) => target.trim()).filter(Boolean);
  for (const target of targets) {
    if (!isTarget(target)) throw new Error(`Unsupported target: ${target}`);
  }
  return [...new Set(targets)] as TargetId[];
}

function parseScope(value: string): InstallScope {
  if (value !== "local" && value !== "global") throw new Error(`Invalid scope: ${value}`);
  return value;
}
