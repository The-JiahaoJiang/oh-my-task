import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir, hostname } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  acquireFileLock,
  atomicWriteFile,
  LockBusyError,
  withFileLock,
  type LockConfig,
} from "../src/index.js";

const fast: LockConfig = { retryMs: 5, timeoutMs: 30, staleAfterMs: 10_000 };

async function temporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), "oh-my-task-"));
}

test("a live lock blocks a second writer and release is idempotent", async () => {
  const root = await temporaryDirectory();
  try {
    const path = join(root, "locks", "task.lock");
    const first = await acquireFileLock(path, { config: fast, agent: "pi", sessionId: "one" });
    await assert.rejects(
      acquireFileLock(path, { config: fast, agent: "pi", sessionId: "two" }),
      (error: unknown) => error instanceof LockBusyError && error.owner?.sessionId === "one",
    );
    await first.release();
    await first.release();
    const second = await acquireFileLock(path, { config: fast });
    await second.release();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("concurrent critical sections are serialized", async () => {
  const root = await temporaryDirectory();
  try {
    const lockPath = join(root, "locks", "task.lock");
    const config = { retryMs: 2, timeoutMs: 1_000, staleAfterMs: 10_000 };
    let active = 0;
    let maximum = 0;
    const order: number[] = [];
    await Promise.all(Array.from({ length: 5 }, (_, index) => withFileLock(lockPath, { config }, async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 8));
      order.push(index);
      active -= 1;
    })));
    assert.equal(maximum, 1);
    assert.equal(order.length, 5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("stale local lock is reclaimed only when its process is dead", async () => {
  const root = await temporaryDirectory();
  try {
    const lockPath = join(root, "locks", "task.lock");
    await mkdir(lockPath, { recursive: true });
    await writeFile(join(lockPath, "owner.json"), JSON.stringify({
      pid: 2_147_483_000,
      hostname: hostname(),
      createdAt: "2000-01-01T00:00:00.000Z",
    }));
    const lock = await acquireFileLock(lockPath, { config: { ...fast, staleAfterMs: 1 } });
    assert.equal(lock.owner.pid, process.pid);
    await lock.release();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("atomic write replaces complete content", async () => {
  const root = await temporaryDirectory();
  try {
    const path = join(root, "tasks", "task.md");
    await atomicWriteFile(path, "first");
    await atomicWriteFile(path, "second");
    assert.equal(await readFile(path, "utf8"), "second");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("interrupted atomic write preserves old file and saves recovery content", async () => {
  const root = await temporaryDirectory();
  try {
    const path = join(root, "tasks", "task.md");
    const recovery = join(root, "recovery");
    await atomicWriteFile(path, "stable");
    await assert.rejects(
      atomicWriteFile(path, "candidate", {
        recoveryDir: recovery,
        beforeReplace: async () => { throw new Error("simulated interruption"); },
      }),
      /simulated interruption/,
    );
    assert.equal(await readFile(path, "utf8"), "stable");
    const files = await readdir(recovery);
    assert.equal(files.length, 1);
    assert.equal(await readFile(join(recovery, files[0]!), "utf8"), "candidate");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
