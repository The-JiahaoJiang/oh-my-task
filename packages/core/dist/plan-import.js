import { readFile } from "node:fs/promises";
export async function importPlanFile(path, now = new Date()) {
    return normalizePlanMarkdown(await readFile(path, "utf8"), path, now);
}
export function normalizePlanMarkdown(source, path, now = new Date()) {
    const suggestedTitle = /^#\s+(.+)$/m.exec(source)?.[1]?.trim();
    const objective = /^##? Objective\s*\n+([^#\n].*)/mi.exec(source)?.[1]?.trim();
    const lines = [...source.matchAll(/^- \[([ xX>!])\]\s+(?:\*\*([^*]+)\*\*\s+[—-]\s+)?(.+)$/gm)];
    const usedIds = new Set();
    const plan = lines.map((match, index) => {
        const explicitId = match[2]?.trim();
        const title = (match[3] ?? `Item ${index + 1}`).replace(/\*\*/g, "").trim();
        const baseId = slug(explicitId || title || `item-${index + 1}`);
        let id = baseId;
        let suffix = 2;
        while (usedIds.has(id))
            id = `${baseId}-${suffix++}`;
        usedIds.add(id);
        const marker = match[1];
        const status = marker === "x" || marker === "X" ? "completed"
            : marker === ">" ? "in-progress"
                : marker === "!" ? "blocked"
                    : "not-started";
        return { id, title, status };
    });
    return {
        ...(suggestedTitle ? { suggestedTitle } : {}),
        ...(objective ? { objective } : {}),
        plan,
        sourcePlan: { path, importedAt: now.toISOString() },
    };
}
function slug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
//# sourceMappingURL=plan-import.js.map