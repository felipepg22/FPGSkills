import process from "node:process";
import { spawnSync } from "node:child_process";

export function spawnSkillsRunner({
  runner,
  args,
  options,
  platform = process.platform,
  env = process.env,
  spawn = spawnSync,
}) {
  if (platform === "win32") {
    const commandInterpreter = env.ComSpec ?? env.COMSPEC ?? "cmd.exe";
    return spawn(
      commandInterpreter,
      ["/d", "/s", "/c", `${runner}.cmd`, ...args],
      options,
    );
  }

  return spawn(runner, args, options);
}
