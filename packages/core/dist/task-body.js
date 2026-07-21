import { ValidationError } from "./errors.js";
const STATUS_MARKER = {
    "not-started": " ",
    "in-progress": ">",
    completed: "x",
    blocked: "!",
};
export function createTaskBody(title, objective, plan, constraints = []) {
    const planLines = plan.length
        ? plan.map((item) => `- [${STATUS_MARKER[item.status]}] **${item.id}** — ${item.title}`).join("\n")
        : "_Plan to be developed with the user._";
    return `# ${title}\n\n## Objective\n\n${objective || "_To be clarified with the user._"}\n\n## Constraints\n\n${listOrPlaceholder(constraints)}\n\n## Plan\n\n${planLines}\n\n## Current State\n\n### Progress\n\nTask created; implementation has not started.\n\n### Next Action\n\nDevelop or confirm the implementation plan.\n\n### Decisions\n\n_None recorded._\n\n### Blockers and Unresolved Issues\n\n_None recorded._\n\n### Relevant Files\n\n_None recorded._\n\n## Sessions\n\n_None recorded._\n\n## Checkpoint History\n\n_No checkpoints recorded._\n`;
}
export function updatePlanItems(body, changes) {
    let result = body;
    const missing = [];
    for (const [id, status] of Object.entries(changes)) {
        const escaped = escapeRegExp(id);
        const pattern = new RegExp(`(^- \\[)[ x>!](\\] \\*\\*${escaped}\\*\\*\\s+—\\s+.*$)`, "m");
        if (!pattern.test(result))
            missing.push(id);
        else
            result = result.replace(pattern, `$1${STATUS_MARKER[status]}$2`);
    }
    if (missing.length) {
        throw new ValidationError("Checkpoint references unknown plan items.", missing.map((id) => ({
            path: `plan.${id}`,
            message: "plan item was not found in the task document",
        })));
    }
    return result;
}
export function updateCurrentState(body, state) {
    const content = `### Progress\n\n${state.progress}\n\n### Next Action\n\n${state.nextAction}\n\n### Decisions\n\n${listOrPlaceholder(state.decisions)}\n\n### Blockers and Unresolved Issues\n\n${listOrPlaceholder(state.blockers)}\n\n### Relevant Files\n\n${fileListOrPlaceholder(state.files)}`;
    return replaceSection(body, "Current State", content);
}
export function appendCheckpoint(body, checkpoint) {
    const session = checkpoint.session ? `${checkpoint.session.agent} / ${checkpoint.session.sessionId}` : "Not available";
    const content = `### Checkpoint ${checkpoint.number} — ${checkpoint.createdAt}\n\n- **Plan items:** ${checkpoint.planItemIds.length ? checkpoint.planItemIds.map(code).join(", ") : "None"}\n- **Completed:** ${checkpoint.completedPlanItemIds.length ? checkpoint.completedPlanItemIds.map(code).join(", ") : "None"}\n- **Task status:** ${checkpoint.status}\n- **Progress:** ${checkpoint.progress}\n- **Next action:** ${checkpoint.nextAction}\n- **Agent/session:** ${session}\n\n#### Files\n\n${fileListOrPlaceholder(checkpoint.files)}\n\n#### Decisions\n\n${listOrPlaceholder(checkpoint.decisions)}\n\n#### Blockers\n\n${listOrPlaceholder(checkpoint.blockers)}`;
    const current = getSection(body, "Checkpoint History");
    const previous = current.trim() === "_No checkpoints recorded._" ? "" : current.trimEnd();
    return replaceSection(body, "Checkpoint History", `${previous}${previous ? "\n\n" : ""}${content}`);
}
export function addSession(body, session) {
    const current = getSection(body, "Sessions");
    const entries = current.trim() === "_None recorded._" ? [] : current.trim().split("\n");
    const prefix = `- ${session.agent} — \`${session.sessionId}\``;
    const next = entries.filter((line) => !line.startsWith(prefix));
    next.unshift(`${prefix} — \`${session.cwd}\` — last used ${session.updatedAt}`);
    return replaceSection(body, "Sessions", next.join("\n"));
}
export function countCheckpoints(body) {
    return [...body.matchAll(/^### Checkpoint \d+ —/gm)].length;
}
export function hasIncompletePlanItems(body) {
    return /^- \[[ >!]\] \*\*/m.test(getSection(body, "Plan"));
}
export function replaceSection(body, heading, content) {
    const escaped = escapeRegExp(heading);
    const pattern = new RegExp(`(^## ${escaped}\\s*\\n)([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m");
    if (!pattern.test(body)) {
        throw new ValidationError("Task document structure is invalid.", [{ path: heading, message: `missing ## ${heading} section` }]);
    }
    return body.replace(pattern, `$1\n${content.trim()}\n\n`);
}
export function getSection(body, heading) {
    const escaped = escapeRegExp(heading);
    const match = new RegExp(`^## ${escaped}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(body);
    if (!match)
        throw new ValidationError("Task document structure is invalid.", [{ path: heading, message: `missing ## ${heading} section` }]);
    return (match[1] ?? "").trim();
}
function listOrPlaceholder(items) {
    return items.length ? items.map((item) => `- ${item}`).join("\n") : "_None recorded._";
}
function fileListOrPlaceholder(files) {
    return files.length ? files.map((file) => `- \`${file.path}\`${file.note ? ` — ${file.note}` : ""}`).join("\n") : "_None recorded._";
}
function code(value) { return `\`${value}\``; }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
//# sourceMappingURL=task-body.js.map