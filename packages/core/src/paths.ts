import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export interface OhMyTaskPaths {
  root: string;
  index: string;
  config: string;
  projectLinks: string;
  tasks: string;
  locks: string;
  recovery: string;
}

export interface PathOptions {
  env?: NodeJS.ProcessEnv;
  home?: string;
  cwd?: string;
}

export function getOhMyTaskPaths(options: PathOptions = {}): OhMyTaskPaths {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();
  const cwd = options.cwd ?? process.cwd();
  const configured = env.OH_MY_TASK_HOME?.trim();
  const expanded = configured?.startsWith("~/") || configured?.startsWith("~\\")
    ? join(home, configured.slice(2))
    : configured;
  const root = expanded
    ? (isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded))
    : join(home, ".oh-my-task");

  return {
    root,
    index: join(root, "oh-my-task.md"),
    config: join(root, "config.json"),
    projectLinks: join(root, "project-links.json"),
    tasks: join(root, "tasks"),
    locks: join(root, "locks"),
    recovery: join(root, "recovery"),
  };
}
