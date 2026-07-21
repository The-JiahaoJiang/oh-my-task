import { readFile } from "node:fs/promises";
import type { PlanItem, SourcePlanReference } from "./types.js";

export interface ImportedPlan {
  suggestedTitle?: string;
  objective?: string;
  plan: PlanItem[];
  sourcePlan: SourcePlanReference;
}

export async function importPlanFile(path: string, now: Date = new Date()): Promise<ImportedPlan> {
  return normalizePlanMarkdown(await readFile(path, "utf8"), path, now);
}

export function normalizePlanMarkdown(source: string, path: string, now: Date = new Date()): ImportedPlan {
  const suggestedTitle = /^#\s+(.+)$/m.exec(source)?.[1]?.trim();
  const objective = /^##? Objective\s*\n+([^#\n].*)/mi.exec(source)?.[1]?.trim();
  const lines = [...source.matchAll(/^- \[([ xX>!])\]\s+(?:\*\*([^*]+)\*\*\s+[—-]\s+)?(.+)$/gm)];
  const usedIds = new Set<string>();
  const plan = lines.map((match, index) => {
    const explicitId = match[2]?.trim();
    const title = (match[3] ?? `Item ${index + 1}`).replace(/\*\*/g, "").trim();
    const baseId = slug(explicitId || title || `item-${index + 1}`);
    let id = baseId; let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    const marker = match[1];
    const status = marker === "x" || marker === "X" ? "completed" as const
      : marker === ">" ? "in-progress" as const
      : marker === "!" ? "blocked" as const
      : "not-started" as const;
    return { id, title, status };
  });
  return {
    ...(suggestedTitle ? { suggestedTitle } : {}),
    ...(objective ? { objective } : {}),
    plan,
    sourcePlan: { path, importedAt: now.toISOString() },
  };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
