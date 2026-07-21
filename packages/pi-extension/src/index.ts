import { SessionManager, type ExtensionAPI, type ExtensionCommandContext, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TaskDocument } from "oh-my-task-cli";
import { ASSOCIATION_ENTRY, buildCompactContext, extractRecentSessions, findAssociation, type TaskAssociation } from "./context.js";
import { chooseProjectName, createRuntime, rebuild, relevantTasks, type Runtime } from "./runtime.js";
import { filteringHint, taskLabel } from "./ui.js";

export default function ohMyTaskExtension(pi: ExtensionAPI) {
  let active: TaskAssociation | undefined;
  let runtime: Runtime | undefined;

  pi.on("session_start", async (_event, ctx) => {
    runtime = await createRuntime(ctx.cwd, "pi", ctx.sessionManager.getSessionId());
    active = findAssociation(ctx.sessionManager.getBranch());
    if (active) {
      try {
        const task = await runtime.tasks.read(active.taskId);
        active.revision = task.metadata.revision;
        injectContext(pi, task);
        ctx.ui.setStatus("oh-my-task", `task: ${task.metadata.title}`);
        return;
      } catch (error) {
        ctx.ui.notify(`Oh My Task association could not be restored: ${message(error)}`, "warning");
        active = undefined;
      }
    }
    if (!runtime.config.startupPrompt || !ctx.hasUI || ctx.mode !== "tui") return;
    const projectName = await chooseProjectName(ctx);
    if (!projectName) return;
    const candidates = await relevantTasks(runtime, projectName);
    ctx.ui.notify(filteringHint(projectName), "info");
    const options = ["Create a new task", ...candidates.map(taskLabel), "Continue without a task"];
    const choice = await ctx.ui.select("Oh My Task", options);
    if (!choice || choice === "Continue without a task") return;
    if (choice === "Create a new task") {
      const task = await createTaskInteractively(runtime, ctx, projectName);
      if (task) await activateTask(pi, runtime, ctx, task, (value) => { active = value; });
      return;
    }
    const task = candidates[options.indexOf(choice) - 1];
    if (task) await activateTask(pi, runtime, ctx, task, (value) => { active = value; });
  });

  pi.registerCommand("oh-my-task", {
    description: "List, create, resume, switch, checkpoint, complete, or validate durable tasks",
    handler: async (args, ctx) => {
      runtime ??= await createRuntime(ctx.cwd, "pi", ctx.sessionManager.getSessionId());
      const [subcommand = "list", ...rest] = args.trim().split(/\s+/).filter(Boolean);
      if (subcommand === "list") return showTasks(runtime, ctx);
      if (subcommand === "new") {
        const project = await chooseProjectName(ctx); if (!project) return;
        const task = await createTaskInteractively(runtime, ctx, project, rest.join(" "));
        if (task) await activateTask(pi, runtime, ctx, task, (value) => { active = value; });
        return;
      }
      if (subcommand === "resume" || subcommand === "switch") {
        return resumeTask(pi, runtime, ctx, (value) => { active = value; });
      }
      if (subcommand === "checkpoint") {
        pi.sendUserMessage("Use /skill:oh-my-task to review the active task and record a manual checkpoint with oh-my-task-cli.");
        return;
      }
      if (subcommand === "complete") {
        if (!active) return ctx.ui.notify("No active Oh My Task task.", "warning");
        const task = await runtime.tasks.read(active.taskId);
        const force = rest.includes("--force");
        const reason = force ? await ctx.ui.input("Force-completion reason") : undefined;
        const completed = await runtime.tasks.complete(task.metadata.id, {
          baseRevision: task.metadata.revision, force, ...(reason ? { reason } : {}),
        });
        active.revision = completed.metadata.revision;
        pi.appendEntry(ASSOCIATION_ENTRY, active);
        await rebuild(runtime);
        ctx.ui.notify(`Completed ${completed.metadata.title}`, "info");
        return;
      }
      if (subcommand === "validate") {
        const result = await runtime.index.validate(await runtime.tasks.list());
        ctx.ui.notify(result.valid ? "Oh My Task files are valid." : `Index needs rebuild: ${result.staleTaskIds.join(", ")}`, result.valid ? "info" : "warning");
        return;
      }
      if (subcommand === "rebuild-index") {
        await rebuild(runtime); ctx.ui.notify("Oh My Task index rebuilt.", "info"); return;
      }
      ctx.ui.notify("Usage: /oh-my-task [list|new|resume|switch|checkpoint|complete|validate|rebuild-index]", "warning");
    },
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setStatus("oh-my-task", undefined);
  });
}

async function showTasks(runtime: Runtime, ctx: ExtensionCommandContext): Promise<void> {
  const project = await chooseProjectName(ctx); if (!project) return;
  const tasks = await relevantTasks(runtime, project);
  ctx.ui.notify(filteringHint(project), "info");
  if (!tasks.length) ctx.ui.notify("No incomplete tasks for this project.", "info");
  else await ctx.ui.select("Incomplete tasks", tasks.map(taskLabel));
}

async function createTaskInteractively(runtime: Runtime, ctx: ExtensionContext, projectName: string, suppliedTitle = ""): Promise<TaskDocument | undefined> {
  const title = suppliedTitle || await ctx.ui.input("Task title"); if (!title) return undefined;
  const objective = await ctx.ui.input("Initial objective (optional)");
  const method = await ctx.ui.select("Implementation plan", ["Develop the plan with the agent", "Import an existing plan later with oh-my-task-cli"]);
  if (!method) return undefined;
  const task = await runtime.tasks.create({ title, projectName, ...(objective ? { objective } : {}) });
  await rebuild(runtime);
  return task;
}

async function activateTask(
  pi: ExtensionAPI, runtime: Runtime, ctx: ExtensionContext, task: TaskDocument,
  setActive: (association: TaskAssociation) => void,
): Promise<void> {
  const session = { agent: "pi", sessionId: ctx.sessionManager.getSessionId(), cwd: ctx.cwd, updatedAt: new Date().toISOString() };
  const associated = await runtime.tasks.associate(task.metadata.id, task.metadata.revision, session);
  const association = { taskId: associated.metadata.id, revision: associated.metadata.revision, projectName: associated.metadata.project.name };
  setActive(association); pi.appendEntry(ASSOCIATION_ENTRY, association);
  await rebuild(runtime); injectContext(pi, associated);
  ctx.ui.setStatus("oh-my-task", `task: ${associated.metadata.title}`);
  ctx.ui.notify(`Loaded task context for ${associated.metadata.title}`, "info");
}

async function resumeTask(
  pi: ExtensionAPI, runtime: Runtime, ctx: ExtensionCommandContext,
  setActive: (association: TaskAssociation) => void,
): Promise<void> {
  const project = await chooseProjectName(ctx); if (!project) return;
  const tasks = await relevantTasks(runtime, project);
  ctx.ui.notify(filteringHint(project), "info");
  const label = await ctx.ui.select("Select task", tasks.map(taskLabel)); if (!label) return;
  const task = tasks.find((candidate) => taskLabel(candidate) === label); if (!task) return;
  const sessions = extractRecentSessions(task, "pi", runtime.config.sessionDisplayLimit);
  const contextOption = "Continue in current session from task context";
  const options = [contextOption, ...sessions.map((session) => `Resume Pi session ${session.sessionId}`)];
  const selected = await ctx.ui.select("Resume method", options); if (!selected) return;
  if (selected === contextOption) return activateTask(pi, runtime, ctx, task, setActive);
  const sessionId = selected.replace("Resume Pi session ", "");
  const available = await SessionManager.listAll();
  const target = available.find((item) => item.id === sessionId || item.file.includes(sessionId));
  if (!target) return ctx.ui.notify(`Pi session ${sessionId} was not found; use context resume instead.`, "warning");
  await ctx.switchSession(target.file, { withSession: async (replacementCtx) => replacementCtx.ui.notify(`Resumed Pi session ${sessionId}`, "info") });
}

function injectContext(pi: ExtensionAPI, task: TaskDocument): void {
  pi.sendMessage({ customType: "oh-my-task-context", content: buildCompactContext(task), display: true }, { deliverAs: "nextTurn" });
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
