import { SessionManager, type ExtensionAPI, type ExtensionCommandContext, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { basename, resolve } from "node:path";
import { getOhMyTaskPaths, importPlanFile, loadConfig, type ImportedPlan, type RelevantFile, type TaskDocument, type TaskStatus } from "oh-my-task-cli";
import { ASSOCIATION_ENTRY, buildCompactContext, extractRecentSessions, findAssociation, type TaskAssociation } from "./context.js";
import { chooseProjectName, createRuntime, rebuild, relevantTasks, type Runtime } from "./runtime.js";
import { buildImportedPlanProgressPrompt, filteringHint, manualSkillCommand, parseNewTaskArguments, shouldExposeExtensionCommand, taskLabel } from "./ui.js";
import { initializeFromPiSessions } from "./session-import.js";
import { AutoCheckpointController } from "./auto-checkpoint.js";

export default async function ohMyTaskExtension(pi: ExtensionAPI) {
  const startupConfig = await loadConfig(getOhMyTaskPaths());
  let active: TaskAssociation | undefined;
  let runtime: Runtime | undefined;
  let autoToolRegistered = false;
  const autoCheckpoint = new AutoCheckpointController();

  pi.on("session_start", async (_event, ctx) => {
    runtime = await createRuntime(ctx.cwd, "pi", ctx.sessionManager.getSessionId());
    if (runtime.config.checkpointMode === "auto" && !autoToolRegistered) {
      registerAutoCheckpointTool(pi, () => runtime, () => active, (value) => { active = value; }, autoCheckpoint);
      autoToolRegistered = true;
    }
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
    if (!runtime.config.startupPrompt || !ctx.hasUI) return;
    const projectName = await chooseProjectName(ctx, runtime);
    if (!projectName) return;
    const candidates = await relevantTasks(runtime, projectName);
    ctx.ui.notify(filteringHint(projectName), "info");
    const loadPlanOption = "Load a task plan with @file";
    const options = ["Create a new task", loadPlanOption, ...candidates.map(taskLabel), "Continue without a task"];
    const choice = await ctx.ui.select("Oh My Task", options);
    if (!choice || choice === "Continue without a task") return;
    if (choice === loadPlanOption) {
      ctx.ui.setEditorText(runtime.config.checkpointMode === "manual" ? manualSkillCommand("import-plan") : "/oh-my-task new --plan @");
      ctx.ui.notify("Use @ file completion in the editor, select the plan, then submit the command.", "info");
      return;
    }
    if (choice === "Create a new task") {
      if (runtime.config.checkpointMode === "manual") {
        ctx.ui.setEditorText(manualSkillCommand("create"));
        ctx.ui.notify("Submit the skill command to create the task through the shared cross-agent workflow.", "info");
        return;
      }
      const task = await createTaskInteractively(runtime, ctx, projectName);
      if (task) await activateTask(pi, runtime, ctx, task, (value) => { active = value; });
      return;
    }
    const task = candidates[options.indexOf(choice) - 2];
    if (task) await activateTask(pi, runtime, ctx, task, (value) => { active = value; });
  });

  if (shouldExposeExtensionCommand(startupConfig.checkpointMode)) pi.registerCommand("oh-my-task", {
    description: "List, create, resume, switch, checkpoint, complete, or validate durable tasks",
    handler: async (args, ctx) => {
      runtime ??= await createRuntime(ctx.cwd, "pi", ctx.sessionManager.getSessionId());
      const [subcommand = "list", ...rest] = args.trim().split(/\s+/).filter(Boolean);
      if (subcommand === "list") return showTasks(runtime, ctx);
      if (subcommand === "new") {
        const request = parseNewTaskArguments(rest.join(" "));
        const project = await chooseProjectName(ctx, runtime); if (!project) return;
        let imported: ImportedPlan | undefined;
        let reviewImportedProgress = false;
        if (request.planPath) {
          const path = resolve(ctx.cwd, request.planPath);
          imported = await importPlanFile(path);
          const preview = [
            `Source: ${path}`,
            `Title: ${request.title || imported.suggestedTitle || basename(path)}`,
            `Objective: ${imported.objective ?? "Not provided"}`,
            `Plan items: ${imported.plan.length}`,
            ...imported.plan.slice(0, 8).map((item) => `- [${item.status}] ${item.title}`),
          ].join("\n");
          if (!await ctx.ui.confirm("Import this task plan?", preview)) return;
          reviewImportedProgress = await ctx.ui.confirm(
            "Review and update implementation progress?",
            "If approved, Pi will read the imported plan, identify directly related project files, inspect those files, and update task progress from verified evidence. Unrelated files and sensitive content must not be scanned or copied.",
          );
        }
        const task = await createTaskInteractively(runtime, ctx, project, request.title, imported);
        if (task) {
          const activated = await activateTask(pi, runtime, ctx, task, (value) => { active = value; });
          if (reviewImportedProgress) pi.sendUserMessage(buildImportedPlanProgressPrompt(activated));
        }
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
      if (subcommand === "init") {
        const created = await initializeFromPiSessions(runtime, await SessionManager.listAll(), ctx);
        ctx.ui.notify(`Initialized ${created.length} task(s) from Pi sessions.`, "info");
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
      ctx.ui.notify("Usage: /oh-my-task [list|new|resume|switch|checkpoint|complete|init|validate|rebuild-index]", "warning");
    },
  });

  pi.on("tool_execution_end", async (event) => {
    if (runtime?.config.checkpointMode === "auto") autoCheckpoint.observeTool(event.toolName, event.isError);
  });

  pi.on("agent_settled", async () => {
    if (runtime?.config.checkpointMode !== "auto" || !autoCheckpoint.shouldRequestCheckpoint(Boolean(active))) return;
    pi.sendUserMessage(
      "Oh My Task detected meaningful uncheckpointed work. Review the active task and call oh_my_task_checkpoint with a concise durable progress update. Do not copy secrets or raw tool output.",
      { deliverAs: "followUp" },
    );
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    // Never start a model call here. Durable writes are completed by the tool before shutdown.
    ctx.ui.setStatus("oh-my-task", undefined);
  });
}

async function showTasks(runtime: Runtime, ctx: ExtensionCommandContext): Promise<void> {
  const project = await chooseProjectName(ctx, runtime); if (!project) return;
  const tasks = await relevantTasks(runtime, project);
  ctx.ui.notify(filteringHint(project), "info");
  if (!tasks.length) ctx.ui.notify("No incomplete tasks for this project.", "info");
  else await ctx.ui.select("Incomplete tasks", tasks.map(taskLabel));
}

async function createTaskInteractively(
  runtime: Runtime,
  ctx: ExtensionContext,
  projectName: string,
  suppliedTitle = "",
  imported?: ImportedPlan,
): Promise<TaskDocument | undefined> {
  const title = suppliedTitle || imported?.suggestedTitle || await ctx.ui.input("Task title", imported?.sourcePlan.path ? basename(imported.sourcePlan.path) : undefined);
  if (!title) return undefined;
  const objective = imported?.objective ?? await ctx.ui.input("Initial objective (optional)");
  if (!imported) {
    const method = await ctx.ui.select("Implementation plan", ["Develop the plan with the agent", "Import an existing plan with @file or oh-my-task-cli"]);
    if (!method) return undefined;
  }
  const task = await runtime.tasks.create({
    title,
    projectName,
    ...(objective ? { objective } : {}),
    ...(imported ? { plan: imported.plan, sourcePlan: imported.sourcePlan } : {}),
  });
  await rebuild(runtime);
  return task;
}

async function activateTask(
  pi: ExtensionAPI, runtime: Runtime, ctx: ExtensionContext, task: TaskDocument,
  setActive: (association: TaskAssociation) => void,
): Promise<TaskDocument> {
  const session = { agent: "pi", sessionId: ctx.sessionManager.getSessionId(), cwd: ctx.cwd, updatedAt: new Date().toISOString() };
  const associated = await runtime.tasks.associate(task.metadata.id, task.metadata.revision, session);
  const association = { taskId: associated.metadata.id, revision: associated.metadata.revision, projectName: associated.metadata.project.name };
  setActive(association); pi.appendEntry(ASSOCIATION_ENTRY, association);
  await rebuild(runtime); injectContext(pi, associated);
  ctx.ui.setStatus("oh-my-task", `task: ${associated.metadata.title}`);
  ctx.ui.notify(`Loaded task context for ${associated.metadata.title}`, "info");
  return associated;
}

async function resumeTask(
  pi: ExtensionAPI, runtime: Runtime, ctx: ExtensionCommandContext,
  setActive: (association: TaskAssociation) => void,
): Promise<void> {
  const project = await chooseProjectName(ctx, runtime); if (!project) return;
  const tasks = await relevantTasks(runtime, project);
  ctx.ui.notify(filteringHint(project), "info");
  const label = await ctx.ui.select("Select task", tasks.map(taskLabel)); if (!label) return;
  const task = tasks.find((candidate) => taskLabel(candidate) === label); if (!task) return;
  const sessions = extractRecentSessions(task, "pi", runtime.config.sessionDisplayLimit);
  const contextOption = "Continue in current session from task context";
  const options = [contextOption, ...sessions.map((session) => `Resume Pi session ${session.sessionId}`)];
  const selected = await ctx.ui.select("Resume method", options); if (!selected) return;
  if (selected === contextOption) { await activateTask(pi, runtime, ctx, task, setActive); return; }
  const sessionId = selected.replace("Resume Pi session ", "");
  const available = await SessionManager.listAll();
  const target = available.find((item) => item.id === sessionId || item.path.includes(sessionId));
  if (!target) return ctx.ui.notify(`Pi session ${sessionId} was not found; use context resume instead.`, "warning");
  await ctx.switchSession(target.path, { withSession: async (replacementCtx) => replacementCtx.ui.notify(`Resumed Pi session ${sessionId}`, "info") });
}

function registerAutoCheckpointTool(
  pi: ExtensionAPI,
  getRuntime: () => Runtime | undefined,
  getActive: () => TaskAssociation | undefined,
  setActive: (association: TaskAssociation) => void,
  controller: AutoCheckpointController,
): void {
  pi.registerTool({
    name: "oh_my_task_checkpoint",
    label: "Oh My Task Checkpoint",
    description: "Record a durable checkpoint for the active Oh My Task task after meaningful work. Include plan status, concise progress, files, decisions, blockers, and next action; never include secrets or raw tool output.",
    promptSnippet: "Record durable implementation progress for the active Oh My Task task",
    promptGuidelines: ["Use oh_my_task_checkpoint after meaningful work when Oh My Task auto mode requests a checkpoint."],
    parameters: Type.Object({
      baseRevision: Type.Integer({ minimum: 0 }),
      planItemStatuses: Type.Optional(Type.Record(Type.String(), StringEnum(["not-started", "in-progress", "completed", "blocked"] as const))),
      progress: Type.String(),
      files: Type.Optional(Type.Array(Type.Object({ path: Type.String(), note: Type.Optional(Type.String()) }))),
      decisions: Type.Optional(Type.Array(Type.String())),
      blockers: Type.Optional(Type.Array(Type.String())),
      nextAction: Type.String(),
      status: Type.Optional(StringEnum(["planned", "in-progress", "blocked", "completed", "archived"] as const)),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const runtime = getRuntime(); const active = getActive();
      if (!runtime || !active) throw new Error("No active Oh My Task task is associated with this session.");
      const session = { agent: "pi", sessionId: ctx.sessionManager.getSessionId(), cwd: ctx.cwd, updatedAt: new Date().toISOString() };
      const task = await runtime.tasks.checkpoint(active.taskId, {
        baseRevision: params.baseRevision,
        ...(params.planItemStatuses ? { planItemStatuses: params.planItemStatuses } : {}),
        progress: params.progress,
        files: (params.files ?? []) as RelevantFile[],
        decisions: params.decisions ?? [], blockers: params.blockers ?? [],
        nextAction: params.nextAction,
        ...(params.status ? { status: params.status as TaskStatus } : {}),
        session,
      });
      const association = { taskId: task.metadata.id, revision: task.metadata.revision, projectName: task.metadata.project.name };
      setActive(association); pi.appendEntry(ASSOCIATION_ENTRY, association);
      await rebuild(runtime); controller.checkpointSucceeded();
      ctx.ui.setStatus("oh-my-task", `task: ${task.metadata.title} · checkpointed`);
      return {
        content: [{ type: "text", text: `Checkpoint saved for ${task.metadata.id} at revision ${task.metadata.revision}.` }],
        details: { taskId: task.metadata.id, revision: task.metadata.revision, status: task.metadata.status },
      };
    },
  });
}

function injectContext(pi: ExtensionAPI, task: TaskDocument): void {
  pi.sendMessage({ customType: "oh-my-task-context", content: buildCompactContext(task), display: true }, { deliverAs: "nextTurn" });
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
