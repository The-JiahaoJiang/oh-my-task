import type { TaskDocument } from "oh-my-task-cli";

export function taskLabel(task: TaskDocument): string {
  return `${task.metadata.title} · ${task.metadata.status} · ${task.metadata.progressSummary ?? "Not started"}`;
}

export function filteringHint(projectName: string): string {
  return `Showing incomplete tasks associated with ${projectName}. Other user-wide tasks are hidden by the current-project filter.`;
}
