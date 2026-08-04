import { TARGET_IDS, type InstallScope, type ModelProfile, type TargetId } from "./types.js";

export type Command = "install" | "uninstall" | "status";

export interface CliArguments {
  command?: Command;
  targets: TargetId[];
  scope?: InstallScope;
  project?: string;
  profiles: ModelProfile[];
  output?: string;
  force: boolean;
  json: boolean;
  help: boolean;
}

export function parseArguments(argv: string[]): CliArguments {
  const result: CliArguments = {
    targets: [],
    profiles: [],
    force: false,
    json: false,
    help: false,
  };

  const tokens = [...argv];
  const first = tokens.shift();
  if (first && !first.startsWith("-")) {
    if (!isCommand(first)) throw new Error(`Unknown command: ${first}`);
    result.command = first;
  } else if (first) {
    tokens.unshift(first);
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const [flag, inlineValue] = splitFlag(token);
    switch (flag) {
      case "--target": {
        const value = inlineValue ?? requireNext(tokens, ++index, flag);
        for (const target of value.split(",").filter(Boolean)) {
          if (!isTarget(target)) throw new Error(`Unsupported target: ${target}`);
          if (!result.targets.includes(target)) result.targets.push(target);
        }
        break;
      }
      case "--scope": {
        const value = inlineValue ?? requireNext(tokens, ++index, flag);
        if (value !== "local" && value !== "global") throw new Error(`Invalid scope: ${value}`);
        result.scope = value;
        break;
      }
      case "--project":
        result.project = inlineValue ?? requireNext(tokens, ++index, flag);
        break;
      case "--profile": {
        const value = inlineValue ?? requireNext(tokens, ++index, flag);
        result.profiles.push(parseProfile(value));
        break;
      }
      case "--output":
        result.output = inlineValue ?? requireNext(tokens, ++index, flag);
        break;
      case "--force":
        result.force = true;
        break;
      case "--json":
        result.json = true;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }

  ensureUniqueProfiles(result.profiles);
  return result;
}

export function parseProfile(value: string): ModelProfile {
  const separator = value.indexOf("=");
  if (separator < 1 || separator === value.length - 1) {
    throw new Error(`Invalid profile ${JSON.stringify(value)}. Use name=model-id.`);
  }
  const name = value.slice(0, separator);
  const model = value.slice(separator + 1);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name === "inherit") {
    throw new Error(`Invalid profile name: ${name}`);
  }
  return { name, model };
}

function splitFlag(token: string): [string, string | undefined] {
  const equals = token.indexOf("=");
  return equals < 0 ? [token, undefined] : [token.slice(0, equals), token.slice(equals + 1)];
}

function requireNext(tokens: string[], index: number, flag: string): string {
  const value = tokens[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function isCommand(value: string): value is Command {
  return value === "install" || value === "uninstall" || value === "status";
}

export function isTarget(value: string): value is TargetId {
  return TARGET_IDS.includes(value as TargetId);
}

function ensureUniqueProfiles(profiles: ModelProfile[]): void {
  const seen = new Set<string>();
  for (const profile of profiles) {
    if (seen.has(profile.name)) throw new Error(`Duplicate profile: ${profile.name}`);
    seen.add(profile.name);
  }
}
