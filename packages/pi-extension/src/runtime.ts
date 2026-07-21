import {
  getOhMyTaskPaths,
  IndexStore,
  loadConfig,
  suggestProjectName,
  TaskStore,
  validateProjectName,
  type OhMyTaskConfig,
  type TaskDocument,
} from "oh-my-task-cli";

export interface Runtime {
  config: OhMyTaskConfig;
  tasks: TaskStore;
  index: IndexStore;
}

export async function createRuntime(cwd: string, agent = "pi", sessionId?: string): Promise<Runtime> {
  const paths = getOhMyTaskPaths();
  const config = await loadConfig(paths);
  const lock = { config: config.lock, agent, ...(sessionId ? { sessionId } : {}) };
  return { config, tasks: new TaskStore({ paths, lock }), index: new IndexStore({ paths, lock }) };
}

export async function rebuild(runtime: Runtime): Promise<void> {
  await runtime.index.rebuild(await runtime.tasks.list());
}

export async function relevantTasks(runtime: Runtime, projectName: string): Promise<TaskDocument[]> {
  return (await runtime.tasks.list()).filter((task) =>
    task.metadata.project.name === projectName && ["planned", "in-progress", "blocked"].includes(task.metadata.status));
}

export async function chooseProjectName(ctx: { cwd: string; hasUI: boolean; ui: { select(title: string, options: string[]): Promise<string | undefined>; input(title: string, placeholder?: string): Promise<string | undefined> } }): Promise<string | undefined> {
  const suggested = suggestProjectName(ctx.cwd);
  if (!ctx.hasUI) return suggested;
  const choice = await ctx.ui.select("Oh My Task project", [`Use current folder name: ${suggested}`, "Enter another project name"]);
  if (!choice) return undefined;
  if (choice.startsWith("Use current")) return suggested;
  const entered = await ctx.ui.input("Project name", suggested);
  return entered ? validateProjectName(entered) : undefined;
}
