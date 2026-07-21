import { hostname } from "node:os";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
export class LockBusyError extends Error {
    lockPath;
    owner;
    code = "LOCK_BUSY";
    constructor(lockPath, owner) {
        super(`Lock is busy: ${lockPath}${owner ? ` (PID ${owner.pid} on ${owner.hostname})` : ""}`);
        this.lockPath = lockPath;
        this.owner = owner;
        this.name = "LockBusyError";
    }
}
export async function acquireFileLock(lockPath, options) {
    const now = options.now ?? (() => new Date());
    const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    const deadline = Date.now() + options.config.timeoutMs;
    await mkdir(dirname(lockPath), { recursive: true });
    while (true) {
        const owner = {
            pid: process.pid,
            hostname: hostname(),
            createdAt: now().toISOString(),
            ...(options.agent ? { agent: options.agent } : {}),
            ...(options.sessionId ? { sessionId: options.sessionId } : {}),
        };
        try {
            await mkdir(lockPath);
            const handle = await open(`${lockPath}/owner.json`, "wx", 0o600);
            try {
                await handle.writeFile(`${JSON.stringify(owner, null, 2)}\n`);
            }
            finally {
                await handle.close();
            }
            let released = false;
            return {
                path: lockPath,
                owner,
                async release() {
                    if (released)
                        return;
                    released = true;
                    await rm(lockPath, { recursive: true, force: true });
                },
            };
        }
        catch (error) {
            if (!isAlreadyExists(error)) {
                await rm(lockPath, { recursive: true, force: true }).catch(() => undefined);
                throw error;
            }
            const existing = await readOwner(lockPath);
            // A lock directory briefly exists before owner.json is written. It may also
            // disappear between mkdir(EEXIST) and this read. Never remove an ownerless
            // path here: doing so could delete a newly acquired lock (an ABA race).
            if (!existing) {
                if (Date.now() >= deadline)
                    throw new LockBusyError(lockPath);
                await sleep(options.config.retryMs);
                continue;
            }
            if (isReclaimable(existing, options.config.staleAfterMs, now())) {
                await rm(lockPath, { recursive: true, force: true });
                continue;
            }
            if (Date.now() >= deadline)
                throw new LockBusyError(lockPath, existing);
            await sleep(options.config.retryMs);
        }
    }
}
export async function withFileLock(lockPath, options, operation) {
    const lock = await acquireFileLock(lockPath, options);
    try {
        return await operation();
    }
    finally {
        await lock.release();
    }
}
async function readOwner(lockPath) {
    try {
        return JSON.parse(await readFile(`${lockPath}/owner.json`, "utf8"));
    }
    catch {
        return undefined;
    }
}
function isReclaimable(owner, staleAfterMs, now) {
    const created = Date.parse(owner.createdAt);
    if (now.getTime() - created < staleAfterMs)
        return false;
    if (owner.hostname !== hostname())
        return false;
    return !isProcessAlive(owner.pid);
}
function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return error.code === "EPERM";
    }
}
function isAlreadyExists(error) {
    return error.code === "EEXIST";
}
//# sourceMappingURL=lock.js.map