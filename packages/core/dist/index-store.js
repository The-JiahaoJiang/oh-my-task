import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { atomicWriteFile } from "./atomic.js";
import { ValidationError } from "./errors.js";
import { withFileLock } from "./lock.js";
export const GENERATED_START = "<!-- OH-MY-TASK:GENERATED:START -->";
export const GENERATED_END = "<!-- OH-MY-TASK:GENERATED:END -->";
export class IndexReconciliationRequiredError extends Error {
    preview;
    code = "INDEX_RECONCILIATION_REQUIRED";
    constructor(preview) {
        super("Index generation markers are missing or invalid. Review the reconciliation preview before modifying the index.");
        this.preview = preview;
        this.name = "IndexReconciliationRequiredError";
    }
}
export class IndexStore {
    options;
    constructor(options) {
        this.options = options;
    }
    async read() {
        try {
            return await readFile(this.options.paths.index, "utf8");
        }
        catch (error) {
            if (error.code === "ENOENT")
                return undefined;
            throw error;
        }
    }
    async rebuild(tasks) {
        const snapshot = [...tasks].sort(compareTasks);
        const generated = renderGeneratedIndex(snapshot);
        return withFileLock(join(this.options.paths.locks, "index.lock"), this.options.lock, async () => {
            const existing = await this.read();
            let next;
            if (existing === undefined)
                next = createIndexDocument(generated);
            else if (hasValidMarkers(existing))
                next = replaceGeneratedRegion(existing, generated);
            else
                throw new IndexReconciliationRequiredError(createReconciliationPreview(existing, generated));
            await atomicWriteFile(this.options.paths.index, next, { recoveryDir: this.options.paths.recovery });
            return next;
        });
    }
    async validate(tasks) {
        const source = await this.read();
        if (source === undefined)
            return { valid: false, staleTaskIds: tasks.map((task) => task.metadata.id), errors: ["Index does not exist."] };
        if (!hasValidMarkers(source))
            return { valid: false, staleTaskIds: [], errors: ["Generated-region markers are missing or invalid."] };
        const revisions = parseIndexRevisions(source);
        const staleTaskIds = tasks
            .filter((task) => revisions.get(task.metadata.id) !== task.metadata.revision)
            .map((task) => task.metadata.id);
        const known = new Set(tasks.map((task) => task.metadata.id));
        for (const id of revisions.keys())
            if (!known.has(id))
                staleTaskIds.push(id);
        return { valid: staleTaskIds.length === 0, staleTaskIds: [...new Set(staleTaskIds)], errors: [] };
    }
    async readInbox() {
        const source = await this.read();
        return source ? parseManualInbox(source) : [];
    }
}
export function createIndexDocument(generated) {
    return `# Oh My Task\n\n## Manual Inbox\n\nAdd task ideas here using a level-three heading. Optional fields: Project and Objective.\n\n${GENERATED_START}\n${generated.trim()}\n${GENERATED_END}\n`;
}
export function replaceGeneratedRegion(source, generated) {
    const start = source.indexOf(GENERATED_START);
    const end = source.indexOf(GENERATED_END);
    if (start < 0 || end < start || source.indexOf(GENERATED_START, start + 1) >= 0 || source.indexOf(GENERATED_END, end + 1) >= 0) {
        throw new IndexReconciliationRequiredError(createReconciliationPreview(source, generated));
    }
    const contentStart = start + GENERATED_START.length;
    return `${source.slice(0, contentStart)}\n${generated.trim()}\n${source.slice(end)}`;
}
export function renderGeneratedIndex(tasks) {
    const active = tasks.filter((task) => ["planned", "in-progress", "blocked"].includes(task.metadata.status));
    const closed = tasks.filter((task) => ["completed", "archived"].includes(task.metadata.status));
    return [renderGroup("Active Tasks", active), renderGroup("Completed and Archived Tasks", closed)].join("\n\n");
}
export function parseManualInbox(source) {
    const inbox = /^## Manual Inbox\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(source)?.[1] ?? "";
    const matches = [...inbox.matchAll(/^### (.+)\s*\n([\s\S]*?)(?=^### |(?![\s\S]))/gm)];
    return matches.map((match) => {
        const title = (match[1] ?? "").trim();
        const sourceBlock = (match[2] ?? "").trim();
        if (!title)
            throw new ValidationError("Manual inbox entry is invalid.", [{ path: "title", message: "must not be empty" }]);
        const projectName = /^- Project:\s*(.+)$/mi.exec(sourceBlock)?.[1]?.trim();
        const objective = /^- Objective:\s*(.+)$/mi.exec(sourceBlock)?.[1]?.trim();
        const planLines = [...sourceBlock.matchAll(/^- \[[ x>!]\]\s+(.+)$/gm)].map((item) => item[1].trim());
        return {
            title,
            planLines,
            source: match[0],
            ...(projectName ? { projectName } : {}),
            ...(objective ? { objective } : {}),
        };
    });
}
function renderGroup(title, tasks) {
    const content = tasks.length ? tasks.map(renderTask).join("\n\n") : "_None._";
    return `## ${title}\n\n${content}`;
}
function renderTask(task) {
    const meta = task.metadata;
    const session = meta.latestSession ? `${meta.latestSession.agent}/${meta.latestSession.sessionId}` : "None";
    return `<!-- omt-task id=${meta.id} revision=${meta.revision} -->\n### ${oneLine(meta.title)}\n\n- Status: ${meta.status}\n- Project: ${oneLine(meta.project.name)}\n- Progress: ${oneLine(meta.progressSummary ?? "Not started")}\n- Current item: ${oneLine(meta.activePlanItem ?? "None")}\n- Next: ${oneLine(meta.nextAction ?? "Develop or confirm the implementation plan.")}\n- Updated: ${meta.updatedAt}\n- Latest session: ${oneLine(session)}\n- Task file: \`tasks/${basename(meta.id)}.md\``;
}
function parseIndexRevisions(source) {
    const result = new Map();
    for (const match of source.matchAll(/<!-- omt-task id=([^\s]+) revision=(\d+) -->/g))
        result.set(match[1], Number(match[2]));
    return result;
}
function hasValidMarkers(source) {
    const start = source.indexOf(GENERATED_START);
    const end = source.indexOf(GENERATED_END);
    return start >= 0 && end > start && source.indexOf(GENERATED_START, start + 1) < 0 && source.indexOf(GENERATED_END, end + 1) < 0;
}
function createReconciliationPreview(existing, generated) {
    return `# Reconciliation Preview\n\nThe current file has no valid generated region and was not modified.\n\n## Existing Content\n\n${existing}\n\n## Proposed Generated Content\n\n${GENERATED_START}\n${generated}\n${GENERATED_END}\n`;
}
function compareTasks(left, right) {
    return right.metadata.updatedAt.localeCompare(left.metadata.updatedAt) || left.metadata.id.localeCompare(right.metadata.id);
}
function oneLine(value) { return value.replace(/[\r\n]+/g, " ").trim(); }
//# sourceMappingURL=index-store.js.map