import type { TaskDocument } from "oh-my-task-cli";

export function taskLabel(task: TaskDocument): string {
  return `${task.metadata.title} · ${task.metadata.status} · ${task.metadata.progressSummary ?? "Not started"}`;
}

export function filteringHint(projectName: string): string {
  return `Showing incomplete tasks associated with ${projectName}. Other user-wide tasks are hidden by the current-project filter.`;
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
