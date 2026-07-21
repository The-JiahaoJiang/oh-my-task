import type { SessionReference, TaskDocument } from "oh-my-task-cli";

export const ASSOCIATION_ENTRY = "oh-my-task-association";

export interface TaskAssociation {
  taskId: string;
  revision: number;
  projectName: string;
}

export function buildCompactContext(task: TaskDocument): string {
  const sections = ["Objective", "Constraints", "Plan", "Current State"]
    .map((name) => extractSection(task.body, name))
    .filter(Boolean)
    .join("\n\n");
  return `# Oh My Task Context\n\nTask: ${task.metadata.title}\nTask ID: ${task.metadata.id}\nRevision: ${task.metadata.revision}\nStatus: ${task.metadata.status}\nProject: ${task.metadata.project.name}\n\n${sections}\n\nUse this task file as the source of truth. Continue with: ${task.metadata.nextAction ?? "develop or confirm the plan"}`;
}

export function extractRecentSessions(task: TaskDocument, agent = "pi", limit = 3): SessionReference[] {
  const section = extractSection(task.body, "Sessions");
  const sessions: SessionReference[] = [];
  for (const line of section.matchAll(/^- ([^—]+) — `([^`]+)` — `([^`]+)` — last used (.+)$/gm)) {
    const value = { agent: line[1]!.trim(), sessionId: line[2]!, cwd: line[3]!, updatedAt: line[4]!.trim() };
    if (value.agent.toLowerCase() === agent.toLowerCase()) sessions.push(value);
  }
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

export function findAssociation(entries: readonly unknown[]): TaskAssociation | undefined {
  let association: TaskAssociation | undefined;
  for (const value of entries) {
    const entry = value as { type?: string; customType?: string; data?: unknown };
    if (entry.type === "custom" && entry.customType === ASSOCIATION_ENTRY && isAssociation(entry.data)) association = entry.data;
  }
  return association;
}

function extractSection(body: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^## ${escaped}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(body);
  return match ? `## ${heading}\n\n${match[1]!.trim()}` : "";
}

function isAssociation(value: unknown): value is TaskAssociation {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TaskAssociation>;
  return typeof item.taskId === "string" && Number.isInteger(item.revision) && typeof item.projectName === "string";
}
