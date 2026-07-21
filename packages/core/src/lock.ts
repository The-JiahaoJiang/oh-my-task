import { hostname } from "node:os";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import type { LockConfig } from "./types.js";

export interface LockOwner {
  pid: number;
  hostname: string;
  agent?: string;
  sessionId?: string;
  createdAt: string;
}

export class LockBusyError extends Error {
  readonly code = "LOCK_BUSY";
  constructor(readonly lockPath: string, readonly owner?: LockOwner) {
    super(`Lock is busy: ${lockPath}${owner ? ` (PID ${owner.pid} on ${owner.hostname})` : ""}`);
    this.name = "LockBusyError";
  }
}

export interface AcquireLockOptions {
  config: LockConfig;
  agent?: string;
  sessionId?: string;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface FileLock {
  path: string;
  owner: LockOwner;
  release(): Promise<void>;
}

export async function acquireFileLock(lockPath: string, options: AcquireLockOptions): Promise<FileLock> {
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline = Date.now() + options.config.timeoutMs;
  await mkdir(dirname(lockPath), { recursive: true });

  while (true) {
    const owner: LockOwner = {
      pid: process.pid,
      hostname: hostname(),
      createdAt: now().toISOString(),
      ...(options.agent ? { agent: options.agent } : {}),
      ...(options.sessionId ? { sessionId: options.sessionId } : {}),
    };
    try {
      await mkdir(lockPath);
      const handle = await open(`${lockPath}/owner.json`, "wx", 0o600);
      try { await handle.writeFile(`${JSON.stringify(owner, null, 2)}\n`); }
      finally { await handle.close(); }
      let released = false;
      return {
        path: lockPath,
        owner,
        async release() {
          if (released) return;
          released = true;
          await rm(lockPath, { recursive: true, force: true });
        },
      };
    } catch (error) {
      if (!isAlreadyExists(error)) {
        await rm(lockPath, { recursive: true, force: true }).catch(() => undefined);
        throw error;
      }
      const existing = await readOwner(lockPath);
      // A lock directory briefly exists before owner.json is written. It may also
      // disappear between mkdir(EEXIST) and this read. Never remove an ownerless
      // path here: doing so could delete a newly acquired lock (an ABA race).
      if (!existing) {
        if (Date.now() >= deadline) throw new LockBusyError(lockPath);
        await sleep(options.config.retryMs);
        continue;
      }
      if (isReclaimable(existing, options.config.staleAfterMs, now())) {
        await rm(lockPath, { recursive: true, force: true });
        continue;
      }
      if (Date.now() >= deadline) throw new LockBusyError(lockPath, existing);
      await sleep(options.config.retryMs);
    }
  }
}

export async function withFileLock<T>(
  lockPath: string,
  options: AcquireLockOptions,
  operation: () => Promise<T>,
): Promise<T> {
  const lock = await acquireFileLock(lockPath, options);
  try { return await operation(); }
  finally { await lock.release(); }
}

async function readOwner(lockPath: string): Promise<LockOwner | undefined> {
  try { return JSON.parse(await readFile(`${lockPath}/owner.json`, "utf8")) as LockOwner; }
  catch { return undefined; }
}

function isReclaimable(owner: LockOwner, staleAfterMs: number, now: Date): boolean {
  const created = Date.parse(owner.createdAt);
  if (now.getTime() - created < staleAfterMs) return false;
  if (owner.hostname !== hostname()) return false;
  return !isProcessAlive(owner.pid);
}

function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
}

function isAlreadyExists(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "EEXIST";
}
