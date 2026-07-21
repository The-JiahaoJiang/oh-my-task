import {
  getOhMyTaskPaths,
  IndexStore,
  ProjectLinkStore,
  loadConfig,
  suggestProjectName,
  TaskStore,
  validateProjectName,
  workspaceKey,
  type OhMyTaskConfig,
  type TaskDocument,
} from "oh-my-task-cli";

export interface Runtime {
  config: OhMyTaskConfig;
  tasks: TaskStore;
  index: IndexStore;
  projectLinks: ProjectLinkStore;
}

export async function createRuntime(cwd: string, agent = "pi", sessionId?: string): Promise<Runtime> {
  const paths = getOhMyTaskPaths();
  const config = await loadConfig(paths);
  const lock = { config: config.lock, agent, ...(sessionId ? { sessionId } : {}) };
  return {
    config,
    tasks: new TaskStore({ paths, lock }),
    index: new IndexStore({ paths, lock }),
    projectLinks: new ProjectLinkStore(paths, lock),
  };
}

export async function rebuild(runtime: Runtime): Promise<void> {
  await runtime.index.rebuild(await runtime.tasks.list());
}

export async function relevantTasks(runtime: Runtime, projectName: string): Promise<TaskDocument[]> {
  return (await runtime.tasks.list()).filter((task) =>
    task.metadata.project.name === projectName && ["planned", "in-progress", "blocked"].includes(task.metadata.status));
}

export async function chooseProjectName(
  ctx: { cwd: string; hasUI: boolean; ui: { select(title: string, options: string[]): Promise<string | undefined>; input(title: string, placeholder?: string): Promise<string | undefined> } },
  runtime?: Runtime,
): Promise<string | undefined> {
  const linked = await runtime?.projectLinks.get(ctx.cwd);
  if (linked) return linked;

  if (runtime) {
    const currentKey = workspaceKey(ctx.cwd);
    const inferred = new Set<string>();
    for (const task of await runtime.tasks.list()) {
      if (task.metadata.latestSession && workspaceKey(task.metadata.latestSession.cwd) === currentKey) {
        inferred.add(task.metadata.project.name);
        continue;
      }
      for (const match of task.body.matchAll(/^- [^—]+ — `[^`]+` — `([^`]+)` — last used .+$/gm)) {
        if (workspaceKey(match[1]!) === currentKey) inferred.add(task.metadata.project.name);
      }
    }
    if (inferred.size === 1) {
      const projectName = [...inferred][0]!;
      await runtime.projectLinks.set(ctx.cwd, projectName);
      return projectName;
    }
  }

  const suggested = suggestProjectName(ctx.cwd);
  if (!ctx.hasUI) return suggested;
  const choice = await ctx.ui.select("Oh My Task project", [`Use current folder name: ${suggested}`, "Enter another project name"]);
  if (!choice) return undefined;
  let projectName: string | undefined;
  if (choice.startsWith("Use current")) projectName = suggested;
  else {
    const entered = await ctx.ui.input("Project name", suggested);
    projectName = entered ? validateProjectName(entered) : undefined;
  }
  if (projectName) await runtime?.projectLinks.set(ctx.cwd, projectName);
  return projectName;
}
