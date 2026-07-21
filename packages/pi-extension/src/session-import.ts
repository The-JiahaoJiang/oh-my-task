import type { SessionInfo } from "@earendil-works/pi-coding-agent";
import type { OhMyTaskConfig, PlanItem, TaskDocument } from "oh-my-task-cli";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { chooseProjectName, rebuild, type Runtime } from "./runtime.js";

export interface SessionSearchFilters {
  keywords?: string[];
  days?: number;
  repoPath?: string;
  now?: Date;
}

export interface SessionCandidate {
  id: string;
  path: string;
  cwd: string;
  name?: string;
  createdAt: string;
  modifiedAt: string;
  messageCount: number;
  preview: string;
}

export function filterPiSessions(sessions: SessionInfo[], filters: SessionSearchFilters, config: OhMyTaskConfig): SessionCandidate[] {
  const now = filters.now ?? new Date();
  const cutoff = filters.days ? now.getTime() - filters.days * 86_400_000 : undefined;
  const keywords = (filters.keywords ?? []).map((item) => item.toLowerCase()).filter(Boolean);
  const repo = filters.repoPath?.toLowerCase();
  return sessions.filter((session) => {
    if (cutoff && session.modified.getTime() < cutoff) return false;
    if (repo && !session.cwd.toLowerCase().includes(repo)) return false;
    const haystack = `${session.name ?? ""}\n${session.firstMessage}\n${session.allMessagesText}`.toLowerCase();
    return keywords.every((keyword) => haystack.includes(keyword));
  }).map((session) => ({
    id: session.id,
    path: session.path,
    cwd: session.cwd,
    ...(session.name ? { name: session.name } : {}),
    createdAt: session.created.toISOString(),
    modifiedAt: session.modified.toISOString(),
    messageCount: session.messageCount,
    preview: sanitizeSummary(session.firstMessage || session.name || "Untitled Pi session", config.ignoredPaths).slice(0, 240),
  })).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export function sanitizeSummary(value: string, ignoredPaths: string[]): string {
  let result = value
    .replace(/\b(?:sk|pk|api)[-_][a-z0-9_-]{12,}\b/gi, "[REDACTED]")
    .replace(/\b(password|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]");
  const fragments = ignoredPaths.map((pattern) => pattern.replace(/[*!]/g, "").replaceAll("/", "").toLowerCase()).filter((item) => item.length > 3);
  result = result.split(/\r?\n/).filter((line) => !fragments.some((fragment) => line.toLowerCase().replaceAll("/", "").includes(fragment))).join("\n");
  return result.replace(/\s+/g, " ").trim();
}

export async function initializeFromPiSessions(runtime: Runtime, sessions: SessionInfo[], ctx: ExtensionCommandContext): Promise<TaskDocument[]> {
  const keywordsText = await ctx.ui.input("Session keywords (optional, comma separated)");
  const daysText = await ctx.ui.input("Search recent days", String(runtime.config.defaultSessionSearchDays));
  const repoPath = await ctx.ui.input("Repository/directory path filter (optional)");
  const candidates = filterPiSessions(sessions, {
    ...(keywordsText ? { keywords: keywordsText.split(",").map((item) => item.trim()) } : {}),
    days: daysText ? Number(daysText) : runtime.config.defaultSessionSearchDays,
    ...(repoPath ? { repoPath } : {}),
  }, runtime.config);
  if (!candidates.length) { ctx.ui.notify("No matching Pi sessions.", "info"); return []; }
  const listing = candidates.slice(0, 20).map((item) => `${item.id} · ${item.modifiedAt.slice(0, 10)} · ${item.cwd} · ${item.preview}`);
  await ctx.ui.select("Matching Pi sessions (review metadata/previews)", listing);
  const idsText = await ctx.ui.input("Session IDs to import (comma separated)", candidates[0]!.id);
  if (!idsText) return [];
  const ids = new Set(idsText.split(",").map((item) => item.trim()));
  const selected = candidates.filter((item) => ids.has(item.id));
  if (!selected.length) { ctx.ui.notify("No listed session IDs were selected.", "warning"); return []; }
  const grouping = await ctx.ui.select("Task grouping", ["Combine selected sessions into one task", "Create one task per session"]);
  if (!grouping) return [];
  const projectName = await chooseProjectName(ctx); if (!projectName) return [];
  const proposals = grouping.startsWith("Combine") ? [proposalFor(selected)] : selected.map((item) => proposalFor([item]));
  const preview = proposals.map((item) => `${item.title}\nObjective: ${item.objective}\nSessions: ${item.sessionIds.join(", ")}`).join("\n\n");
  const approved = await ctx.ui.confirm("Create proposed task(s)?", preview);
  if (!approved) return [];
  const created: TaskDocument[] = [];
  for (const proposal of proposals) {
    const task = await runtime.tasks.create({ title: proposal.title, projectName, objective: proposal.objective, plan: proposal.plan });
    let current = task;
    for (const candidate of selected.filter((item) => proposal.sessionIds.includes(item.id))) {
      current = await runtime.tasks.associate(current.metadata.id, current.metadata.revision, {
        agent: "pi", sessionId: candidate.id, cwd: candidate.cwd, updatedAt: candidate.modifiedAt,
      });
    }
    created.push(current);
  }
  await rebuild(runtime);
  return created;
}

function proposalFor(sessions: SessionCandidate[]) {
  const title = sessions.length === 1 ? (sessions[0]!.name || sessions[0]!.preview || `Imported Pi task ${sessions[0]!.id.slice(0, 8)}`) : `Imported work from ${sessions.length} Pi sessions`;
  const objective = `Continue work summarized by selected Pi session previews: ${sessions.map((item) => item.preview).join("; ")}`;
  const plan: PlanItem[] = [{ id: "review-imported-context", title: "Review imported context and develop the implementation plan with the user", status: "not-started" }];
  return { title, objective, plan, sessionIds: sessions.map((item) => item.id) };
}
