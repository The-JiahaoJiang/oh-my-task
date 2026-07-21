import { type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import type { RelevantFile, TaskDocument, TaskStatus } from "oh-my-task-cli";
import { ASSOCIATION_ENTRY, buildCompactContext, findAssociation, type TaskAssociation } from "./context.js";
import { chooseProjectName, createRuntime, rebuild, relevantTasks, type Runtime } from "./runtime.js";
import { filteringHint, manualSkillCommand, taskLabel } from "./ui.js";
import { AutoCheckpointController } from "./auto-checkpoint.js";

export default function ohMyTaskExtension(pi: ExtensionAPI) {
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
      ctx.ui.setEditorText(manualSkillCommand("import-plan"));
      ctx.ui.notify("Use @ file completion in the editor, select the plan, then submit the command.", "info");
      return;
    }
    if (choice === "Create a new task") {
      ctx.ui.setEditorText(manualSkillCommand("create"));
      ctx.ui.notify("Submit the skill command to create the task through the shared cross-agent workflow.", "info");
      return;
    }
    const task = candidates[options.indexOf(choice) - 2];
    if (task) await activateTask(pi, runtime, ctx, task, (value) => { active = value; });
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
