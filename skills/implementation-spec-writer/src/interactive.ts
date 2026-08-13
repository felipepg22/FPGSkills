import { cancel, confirm, intro, isCancel, multiselect, note, outro, select, spinner, text } from "@clack/prompts";
import { homedir } from "node:os";
import path from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { isTarget, type CliArguments } from "./arguments.js";
import { install, previewInstall, type InstallationPreview, type InstallOptions, type OperationResult } from "./installer.js";
import { detectTargets } from "./paths.js";
import { TARGET_IDS, type InstallScope, type TargetId } from "./types.js";

export const INTERACTIVE_CANCELLED = Symbol("interactive-cancelled");
type PromptResult<T> = T | typeof INTERACTIVE_CANCELLED;

interface TargetOption {
  value: TargetId;
  label: string;
  hint: string;
}

interface InteractivePrompter {
  intro(title: string): void;
  outro(message: string): void;
  cancel(message: string): void;
  multiselectTargets(options: TargetOption[], initialValues: TargetId[]): Promise<PromptResult<TargetId[]>>;
  selectScope(initialValue: InstallScope): Promise<PromptResult<InstallScope>>;
  text(options: { message: string; initialValue?: string; placeholder?: string; validate?: (value: string) => string | undefined }): Promise<PromptResult<string>>;
  confirm(message: string, initialValue: boolean): Promise<PromptResult<boolean>>;
  note(message: string, title: string): void;
  spinner(): { start(message: string): void; stop(message: string): void; error(message: string): void };
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

const TARGET_OPTIONS: TargetOption[] = [
  { value: "codex", label: "Codex", hint: ".codex/skills/implementation-spec-writer" },
  { value: "opencode", label: "OpenCode", hint: ".opencode/skills/implementation-spec-writer" },
  { value: "cursor", label: "Cursor", hint: ".cursor/skills/implementation-spec-writer" },
  { value: "claude-code", label: "Claude Code", hint: ".claude/skills/implementation-spec-writer" },
  { value: "antigravity", label: "Antigravity", hint: ".agents/skills/implementation-spec-writer" },
  { value: "generic", label: "Generic Markdown", hint: "write the skill to an explicit directory" },
];

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
  prompter.intro("Implementation Spec Writer installer");

  const detected = await detect();
  args.targets = args.targets.length > 0
    ? args.targets
    : await requiredResult(prompter.multiselectTargets(TARGET_OPTIONS, detected), prompter);
  args.targets = [...new Set(args.targets)];
  if (args.targets.length === 0) throw new Error("At least one target is required.");

  if (!args.scope) args.scope = await requiredResult(prompter.selectScope("local"), prompter);
  if (args.scope === "local" && !args.project) {
    args.project = await requiredResult(prompter.text({
      message: "Project root",
      initialValue: process.cwd(),
      validate: requiredText("Project root"),
    }), prompter);
  }
  if (args.targets.includes("generic") && !args.output) {
    args.output = await requiredResult(prompter.text({
      message: "Generic Markdown parent directory",
      placeholder: ".agents/skills",
      validate: requiredText("Output directory"),
    }), prompter);
  }

  const options = toInstallOptions(args);
  prompter.note(formatSummary(options, await preview(options)), "Installation summary");
  const proceed = await requiredResult(prompter.confirm("Proceed with installation?", true), prompter);
  if (!proceed) {
    prompter.cancel("Installation cancelled.");
    return undefined;
  }

  const progress = prompter.spinner();
  progress.start("Installing Implementation Spec Writer");
  try {
    const results = await installOperation(options);
    const failures = results.filter((result) => result.action === "failed").length;
    progress.stop(failures ? `Installation completed with ${failures} failure(s)` : "Installation complete");
    prompter.outro(failures ? "Review the failed targets above." : "Implementation Spec Writer is ready to use.");
    return results;
  } catch (error) {
    progress.error("Installation failed");
    throw error;
  }
}

export async function completeInteractively(args: CliArguments): Promise<CliArguments> {
  if (!stdin.isTTY || !stdout.isTTY) return args;
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    if (args.command === "uninstall" && args.targets.length === 0) {
      const detected = await detectTargets();
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
    if (args.command === "uninstall") {
      const answer = (await prompt.question("Remove the selected managed skill files? [y/N]: ")).trim().toLowerCase();
      if (answer !== "y" && answer !== "yes") throw new InteractiveCancellation();
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
      message: "Which coding agents should receive the skill?",
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

function formatSummary(options: InstallOptions, previews: InstallationPreview[]): string {
  const scope = options.scope === "local" ? "Project" : "Global";
  const root = options.scope === "local" ? path.resolve(options.project ?? process.cwd()) : homedir();
  return [
    `Scope: ${scope}`,
    `Root: ${root}`,
    `Targets: ${options.targets.map((target) => TARGET_LABELS[target]).join(", ")}`,
    `Conflict policy: ${options.force ? "replace after confirmation" : "preserve and report"}`,
    "",
    "Destinations:",
    ...previews.map((entry) => `  ${TARGET_LABELS[entry.target]}\n  ${entry.path}`),
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
  return { targets: args.targets, scope: args.scope, project: args.project, output: args.output, force: args.force };
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

function requiredText(label: string): (value: string) => string | undefined {
  return (value) => value.trim().length ? undefined : `${label} is required.`;
}

function toPromptResult<T>(value: T | symbol): PromptResult<T> {
  return isCancel(value) ? INTERACTIVE_CANCELLED : value as T;
}

function parseTargets(value: string): TargetId[] {
  const targets = value.split(",").map((target) => target.trim()).filter(Boolean);
  for (const target of targets) if (!isTarget(target)) throw new Error(`Unsupported target: ${target}`);
  return [...new Set(targets)] as TargetId[];
}

function parseScope(value: string): InstallScope {
  if (value !== "local" && value !== "global") throw new Error(`Invalid scope: ${value}`);
  return value;
}

export class InteractiveCancellation extends Error {
  constructor() {
    super("Operation cancelled.");
    this.name = "InteractiveCancellation";
  }
}
