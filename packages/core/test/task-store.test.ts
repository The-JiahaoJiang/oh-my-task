import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  getOhMyTaskPaths,
  IncompletePlanError,
  StaleRevisionError,
  TaskStore,
  ValidationError,
  type PlanItem,
  type SessionReference,
} from "../src/index.js";

const plan: PlanItem[] = [
  { id: "inspect", title: "Inspect existing implementation", status: "not-started" },
  { id: "implement", title: "Implement the change", status: "not-started" },
];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "oh-my-task-store-"));
  const store = new TaskStore({
    paths: getOhMyTaskPaths({ env: { OH_MY_TASK_HOME: root } }),
    lock: { config: { retryMs: 2, timeoutMs: 1_000, staleAfterMs: 10_000 }, agent: "test" },
    now: () => new Date("2026-03-27T10:30:00.000Z"),
  });
  return { root, store, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test("task lifecycle persists projection, sessions, and append-only checkpoints", async () => {
  const { store, cleanup } = await fixture();
  try {
    const task = await store.create({
      id: "omt-20260327-auth-a1b2c3",
      title: "Refactor auth",
      projectName: "my-app",
      objective: "Replace legacy authentication.",
      plan,
    });
    assert.equal(task.metadata.revision, 0);
    assert.match(task.body, /\[ \] \*\*inspect\*\*/);

    const session: SessionReference = {
      agent: "pi", sessionId: "session-1", cwd: "/work/my-app", updatedAt: "2026-03-27T10:30:00Z",
    };
    const associated = await store.associate(task.metadata.id, 0, session);
    assert.equal(associated.metadata.revision, 1);
    assert.match(associated.body, /session-1/);

    const checkpoint = await store.checkpoint(task.metadata.id, {
      baseRevision: 1,
      planItemStatuses: { inspect: "completed", implement: "in-progress" },
      progress: "Inspection finished and implementation started.",
      files: [{ path: "src/auth.ts", note: "validator implementation" }],
      decisions: ["Keep token validation stateless."],
      blockers: [],
      nextAction: "Finish implementation.",
      session,
    });
    assert.equal(checkpoint.metadata.revision, 2);
    assert.equal(checkpoint.metadata.activePlanItem, "implement");
    assert.equal(checkpoint.metadata.progressSummary, "Inspection finished and implementation started.");
    assert.match(checkpoint.body, /\[x\] \*\*inspect\*\*/);
    assert.match(checkpoint.body, /\[>\] \*\*implement\*\*/);
    assert.match(checkpoint.body, /### Checkpoint 1/);
    assert.match(checkpoint.body, /src\/auth\.ts/);

    await assert.rejects(
      store.checkpoint(task.metadata.id, {
        baseRevision: 1,
        progress: "Stale update",
        nextAction: "Should fail",
      }),
      StaleRevisionError,
    );

    await assert.rejects(store.complete(task.metadata.id, { baseRevision: 2 }), IncompletePlanError);
    await assert.rejects(
      store.complete(task.metadata.id, { baseRevision: 2, force: true }),
      (error: unknown) => error instanceof ValidationError && /reason/.test(error.message),
    );

    const completed = await store.complete(task.metadata.id, {
      baseRevision: 2,
      force: true,
      reason: "Remaining work moved to a separate task.",
      session,
    });
    assert.equal(completed.metadata.status, "completed");
    assert.equal(completed.metadata.revision, 3);
    assert.match(completed.body, /### Checkpoint 2/);

    const archived = await store.archive(task.metadata.id, 3);
    assert.equal(archived.metadata.status, "archived");
    assert.equal(archived.metadata.revision, 4);
    assert.equal((await store.list()).length, 1);
  } finally {
    await cleanup();
  }
});

test("natural completion requires every plan item to be complete", async () => {
  const { store, cleanup } = await fixture();
  try {
    const task = await store.create({
      id: "omt-20260327-done-a1b2c3",
      title: "Already done",
      projectName: "my-app",
      plan: [{ id: "done", title: "Finished item", status: "completed" }],
    });
    const completed = await store.complete(task.metadata.id, { baseRevision: 0 });
    assert.equal(completed.metadata.status, "completed");
  } finally {
    await cleanup();
  }
});

test("two writers using one revision cannot overwrite each other", async () => {
  const { store, cleanup } = await fixture();
  try {
    const task = await store.create({
      id: "omt-20260327-race-a1b2c3",
      title: "Concurrent update",
      projectName: "my-app",
      plan,
    });
    const attempts = await Promise.allSettled([
      store.checkpoint(task.metadata.id, {
        baseRevision: 0,
        planItemStatuses: { inspect: "in-progress" },
        progress: "Writer one", nextAction: "Continue one",
      }),
      store.checkpoint(task.metadata.id, {
        baseRevision: 0,
        planItemStatuses: { inspect: "blocked" },
        progress: "Writer two", nextAction: "Continue two",
      }),
    ]);
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
    const failure = attempts.find((result) => result.status === "rejected");
    assert.ok(failure?.status === "rejected" && failure.reason instanceof StaleRevisionError);
    const stored = await store.read(task.metadata.id);
    assert.equal(stored.metadata.revision, 1);
    assert.equal((stored.body.match(/### Checkpoint 1/g) ?? []).length, 1);
  } finally {
    await cleanup();
  }
});

test("task IDs cannot escape the task directory", async () => {
  const { store, cleanup } = await fixture();
  try {
    await assert.rejects(store.read("../../outside"), ValidationError);
    await assert.rejects(store.create({ id: "../outside", title: "Escape", projectName: "app" }), ValidationError);
  } finally {
    await cleanup();
  }
});

test("unknown plan item fails without changing revision", async () => {
  const { store, cleanup } = await fixture();
  try {
    const task = await store.create({
      id: "omt-20260327-invalid-a1b2c3",
      title: "Invalid checkpoint",
      projectName: "my-app",
      plan,
    });
    await assert.rejects(
      store.checkpoint(task.metadata.id, {
        baseRevision: 0,
        planItemStatuses: { missing: "completed" },
        progress: "No change", nextAction: "Reload",
      }),
      (error: unknown) => error instanceof ValidationError && /plan\.missing/.test(error.message),
    );
    assert.equal((await store.read(task.metadata.id)).metadata.revision, 0);
  } finally {
    await cleanup();
  }
});
