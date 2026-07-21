import type { TaskDocument } from "oh-my-task-cli";

export function taskLabel(task: TaskDocument): string {
  return `Task: ${task.metadata.title} · Status: ${task.metadata.status} · Progress: ${task.metadata.progressSummary ?? "Not started"}`;
}

export function filteringHint(projectName: string): string {
  return `Showing incomplete tasks associated with ${projectName}. Other user-wide tasks are hidden by the current-project filter.`;
}

export function buildImportedPlanProgressPrompt(task: TaskDocument): string {
  const planPath = task.metadata.sourcePlan?.path;
  return [
    "The user approved an Oh My Task progress review for the newly imported plan.",
    planPath ? `Read the source plan at: ${planPath}` : "Read the imported plan from the active task context.",
    "Identify directly related project files from the plan, then read those files to verify the actual implementation state.",
    "Do not scan unrelated files, and do not copy secrets, environment values, raw tool output, or full source content into the task.",
    "Compare the implementation with every plan item, summarize verified evidence concisely, and update plan-item statuses and progress using the Oh My Task checkpoint workflow.",
    "If evidence is ambiguous, record it as an unresolved issue instead of guessing.",
    `Active task: ${task.metadata.id} at revision ${task.metadata.revision}.`,
  ].join("\n");
}

export function parseNewTaskArguments(value: string): { title: string; planPath?: string } {
  const marker = value.match(/(?:^|\s)--plan(?:=|\s+)([\s\S]+)$/);
  if (!marker) return { title: value.trim() };
  let planPath = (marker[1] ?? "").trim();
  if ((planPath.startsWith('"') && planPath.endsWith('"')) || (planPath.startsWith("'") && planPath.endsWith("'"))) {
    planPath = planPath.slice(1, -1);
  }
  if (planPath.startsWith("@")) planPath = planPath.slice(1);
  return { title: value.slice(0, marker.index).trim(), ...(planPath ? { planPath } : {}) };
}
