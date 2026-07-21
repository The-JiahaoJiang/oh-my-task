#!/usr/bin/env node
import { readFile, rm } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createDefaultConfig, getOhMyTaskPaths, IndexReconciliationRequiredError, IndexStore, loadConfig, saveConfig, suggestProjectName, TaskStore, ValidationError, } from "./index.js";
export async function runCli(argv, io = defaultIo()) {
    const [command = "help", ...rest] = argv;
    const { positional, flags } = parseArguments(rest);
    const jsonOutput = flagBoolean(flags, "json");
    const paths = getOhMyTaskPaths({ env: io.env, cwd: io.cwd });
    try {
        const config = await loadConfig(paths);
        const lock = { config: config.lock, agent: "oh-my-task-cli", sessionId: String(process.pid) };
        const tasks = new TaskStore({ paths, lock });
        const index = new IndexStore({ paths, lock });
        const emit = (value, text) => io.out(jsonOutput ? JSON.stringify(value, null, 2) : text);
        const rebuild = async () => index.rebuild(await tasks.list());
        switch (command) {
            case "help":
            case "--help":
            case "-h":
                io.out(helpText());
                return 0;
            case "config-init": {
                await tasks.initialize();
                await saveConfig(paths, createDefaultConfig());
                emit({ path: paths.config }, `Created configuration: ${paths.config}`);
                return 0;
            }
            case "list": {
                const project = flagString(flags, "project");
                const status = flagString(flags, "status");
                const all = (await tasks.list()).filter((task) => (!project || task.metadata.project.name === project) && (!status || task.metadata.status === status));
                emit(all.map((task) => task.metadata), all.length ? all.map(summaryLine).join("\n") : "No matching tasks.");
                return 0;
            }
            case "show": {
                const task = await tasks.read(requiredPosition(positional, 0, "task ID"));
                const compact = flagBoolean(flags, "compact");
                emit(compact ? task.metadata : task, compact ? summaryLine(task) : `${renderMetadata(task.metadata)}\n\n${task.body}`);
                return 0;
            }
            case "new": {
                const title = flagString(flags, "title") ?? positional.join(" ");
                if (!title)
                    throw usage("new requires --title TITLE or a positional title");
                const projectName = flagString(flags, "project") ?? suggestProjectName(io.cwd);
                const planPath = flagString(flags, "plan");
                const imported = planPath ? await importPlan(resolve(io.cwd, planPath)) : undefined;
                const objective = flagString(flags, "objective") ?? imported?.objective;
                const task = await tasks.create({
                    title, projectName,
                    ...(objective ? { objective } : {}),
                    ...(imported ? { plan: imported.plan, sourcePlan: imported.sourcePlan } : {}),
                });
                await rebuild();
                emit(task, `Created ${task.metadata.id} (revision ${task.metadata.revision}).`);
                return 0;
            }
            case "associate":
            case "switch": {
                const id = requiredPosition(positional, 0, "task ID");
                const session = sessionFromFlags(flags, io.cwd);
                const task = await tasks.associate(id, requiredIntegerFlag(flags, "base-revision"), session);
                await rebuild();
                emit(task, `Associated ${session.agent}/${session.sessionId} with ${id}.`);
                return 0;
            }
            case "checkpoint": {
                const id = requiredPosition(positional, 0, "task ID");
                const inputPath = flagString(flags, "input");
                const data = flagString(flags, "data");
                if (!inputPath && !data)
                    throw usage("checkpoint requires --input FILE or --data JSON");
                const value = JSON.parse(inputPath ? await readFile(resolve(io.cwd, inputPath), "utf8") : data);
                const task = await tasks.checkpoint(id, value);
                await rebuild();
                emit(task, `Checkpoint saved for ${id}; revision ${task.metadata.revision}.`);
                return 0;
            }
            case "complete": {
                const id = requiredPosition(positional, 0, "task ID");
                const task = await tasks.complete(id, {
                    baseRevision: requiredIntegerFlag(flags, "base-revision"),
                    force: flagBoolean(flags, "force"),
                    ...(flagString(flags, "reason") ? { reason: flagString(flags, "reason") } : {}),
                });
                await rebuild();
                emit(task, `Completed ${id}; revision ${task.metadata.revision}.`);
                return 0;
            }
            case "archive": {
                const id = requiredPosition(positional, 0, "task ID");
                const task = await tasks.archive(id, requiredIntegerFlag(flags, "base-revision"));
                await rebuild();
                emit(task, `Archived ${id}; revision ${task.metadata.revision}.`);
                return 0;
            }
            case "validate": {
                const id = positional[0];
                const all = id ? [await tasks.read(id)] : await tasks.list();
                const result = await index.validate(all);
                emit(result, result.valid ? "Task files and index are valid." : `Validation failed: ${[...result.errors, ...result.staleTaskIds.map((item) => `stale: ${item}`)].join("; ")}`);
                return result.valid ? 0 : 2;
            }
            case "rebuild-index": {
                const result = await rebuild();
                emit({ path: paths.index }, `Rebuilt ${paths.index} (${result.length} bytes).`);
                return 0;
            }
            case "import-inbox": {
                const entries = await index.readInbox();
                if (!flagBoolean(flags, "apply")) {
                    emit(entries, entries.length ? entries.map((entry, i) => `${i + 1}. ${entry.title} [${entry.projectName ?? "project required"}]`).join("\n") : "Manual inbox is empty.");
                    return 0;
                }
                const created = [];
                for (const entry of entries)
                    created.push(await createInboxTask(tasks, entry, flagString(flags, "project") ?? suggestProjectName(io.cwd)));
                await rebuild();
                emit(created, `Imported ${created.length} inbox task(s). Remove or edit imported inbox entries manually after review.`);
                return 0;
            }
            case "unlock": {
                if (!flagBoolean(flags, "force"))
                    throw usage("unlock requires explicit --force confirmation");
                const target = requiredPosition(positional, 0, "task ID or index");
                const lockPath = target === "index" ? `${paths.locks}/index.lock` : `${paths.locks}/${target}.lock`;
                await rm(lockPath, { recursive: true, force: true });
                emit({ lockPath }, `Removed lock: ${lockPath}`);
                return 0;
            }
            case "init":
                throw usage("Pi session initialization is provided by the Pi extension; use /oh-my-task init inside Pi.");
            default: throw usage(`unknown command: ${command}`);
        }
    }
    catch (error) {
        if (error instanceof IndexReconciliationRequiredError)
            io.error(`${error.message}\n\n${error.preview}`);
        else
            io.error(error instanceof Error ? error.message : String(error));
        return errorCode(error);
    }
}
async function importPlan(path) {
    const source = await readFile(path, "utf8");
    const objective = /^##? Objective\s*\n+([^#\n].*)/mi.exec(source)?.[1]?.trim();
    const lines = [...source.matchAll(/^- \[[ xX>!]\]\s+(?:\*\*[^*]+\*\*\s+[—-]\s+)?(.+)$/gm)];
    const plan = lines.map((match, index) => ({
        id: slug((match[1] ?? `item-${index + 1}`).replace(/\*\*/g, "")),
        title: (match[1] ?? `Item ${index + 1}`).replace(/\*\*/g, "").trim(),
        status: match[0].includes("[x]") || match[0].includes("[X]") ? "completed" : "not-started",
    }));
    return { ...(objective ? { objective } : {}), plan, sourcePlan: { path, importedAt: new Date().toISOString() } };
}
async function createInboxTask(tasks, entry, fallbackProject) {
    const plan = entry.planLines.map((title, index) => ({ id: `${slug(title)}-${index + 1}`, title, status: "not-started" }));
    return tasks.create({
        title: entry.title,
        projectName: entry.projectName ?? fallbackProject,
        ...(entry.objective ? { objective: entry.objective } : {}),
        plan,
    });
}
function parseArguments(args) {
    const positional = [];
    const flags = {};
    for (let i = 0; i < args.length; i++) {
        const value = args[i];
        if (!value.startsWith("--")) {
            positional.push(value);
            continue;
        }
        const [rawKey, inline] = value.slice(2).split("=", 2);
        const key = rawKey;
        let next = true;
        if (inline !== undefined)
            next = inline;
        else {
            const candidate = args[i + 1];
            if (candidate && !candidate.startsWith("--")) {
                next = candidate;
                i += 1;
            }
        }
        flags[key] = next;
    }
    return { positional, flags };
}
function flagString(flags, name) { const value = flags[name]; return typeof value === "string" ? value : undefined; }
function flagBoolean(flags, name) { return flags[name] === true || flags[name] === "true"; }
function requiredIntegerFlag(flags, name) { const value = Number(flagString(flags, name)); if (!Number.isInteger(value) || value < 0)
    throw usage(`--${name} must be a non-negative integer`); return value; }
function requiredPosition(values, index, label) { const value = values[index]; if (!value)
    throw usage(`missing ${label}`); return value; }
function sessionFromFlags(flags, cwd) {
    const agent = flagString(flags, "agent");
    const sessionId = flagString(flags, "session");
    if (!agent || !sessionId)
        throw usage("--agent and --session are required");
    return { agent, sessionId, cwd: flagString(flags, "cwd") ?? cwd, updatedAt: new Date().toISOString() };
}
function summaryLine(task) { return `${task.metadata.id} [${task.metadata.status}] ${task.metadata.title} (${task.metadata.project.name})`; }
function renderMetadata(value) { return JSON.stringify(value, null, 2); }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item"; }
function usage(message) { const error = new Error(`${message}\nRun oh-my-task-cli help for usage.`); error.code = "USAGE_ERROR"; return error; }
function errorCode(error) { const code = error.code; return code === "USAGE_ERROR" ? 64 : code === "VALIDATION_ERROR" ? 65 : code === "TASK_NOT_FOUND" ? 66 : code === "LOCK_BUSY" ? 75 : code === "STALE_REVISION" ? 76 : 1; }
function defaultIo() { return { out: console.log, error: console.error, cwd: process.cwd(), env: process.env }; }
function helpText() { return `oh-my-task-cli commands:\n  config-init\n  list [--project NAME] [--status STATUS] [--json]\n  show TASK [--compact] [--json]\n  new --title TITLE [--project NAME] [--objective TEXT] [--plan FILE]\n  associate|switch TASK --base-revision N --agent NAME --session ID\n  checkpoint TASK --input FILE|--data JSON\n  complete TASK --base-revision N [--force --reason TEXT]\n  archive TASK --base-revision N\n  validate [TASK] [--json]\n  rebuild-index\n  import-inbox [--apply] [--project NAME]\n  unlock TASK|index --force`; }
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    process.exitCode = await runCli(process.argv.slice(2));
}
//# sourceMappingURL=cli.js.map