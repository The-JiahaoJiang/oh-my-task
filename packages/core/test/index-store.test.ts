import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  GENERATED_END,
  GENERATED_START,
  getOhMyTaskPaths,
  IndexReconciliationRequiredError,
  IndexStore,
  parseManualInbox,
  TaskStore,
} from "../src/index.js";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "omt-index-"));
  const paths = getOhMyTaskPaths({ env: { OH_MY_TASK_HOME: root } });
  const lock = { config: { retryMs: 2, timeoutMs: 1_000, staleAfterMs: 10_000 } };
  const tasks = new TaskStore({ paths, lock, now: () => new Date("2026-03-27T10:30:00Z") });
  const index = new IndexStore({ paths, lock });
  return { root, paths, tasks, index, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test("index rebuild is deterministic and preserves manual content", async () => {
  const { tasks, index, paths, cleanup } = await fixture();
  try {
    const task = await tasks.create({ id: "omt-20260327-index-a1b2c3", title: "Index task", projectName: "app" });
    const first = await index.rebuild([task]);
    assert.match(first, /Manual Inbox/);
    assert.match(first, /id=omt-20260327-index-a1b2c3 revision=0/);
    const manual = first.replace("Add task ideas here", "My preserved notes\n\n### Manual task\n\n- Project: app\n- Objective: Review indexing\n- [ ] Write tests\n\nAdd task ideas here");
    await writeFile(paths.index, manual);
    const second = await index.rebuild([task]);
    assert.match(second, /My preserved notes/);
    assert.equal(second, await index.rebuild([task]));
    const inbox = await index.readInbox();
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0]?.title, "Manual task");
    assert.deepEqual(inbox[0]?.planLines, ["Write tests"]);
  } finally { await cleanup(); }
});

test("stale index revisions are detected and repaired", async () => {
  const { tasks, index, cleanup } = await fixture();
  try {
    const created = await tasks.create({ id: "omt-20260327-stale-a1b2c3", title: "Stale", projectName: "app" });
    await index.rebuild([created]);
    const changed = await tasks.archive(created.metadata.id, 0);
    const stale = await index.validate([changed]);
    assert.equal(stale.valid, false);
    assert.deepEqual(stale.staleTaskIds, [created.metadata.id]);
    await index.rebuild([changed]);
    assert.deepEqual(await index.validate([changed]), { valid: true, staleTaskIds: [], errors: [] });
  } finally { await cleanup(); }
});

test("missing markers produce preview without modifying index", async () => {
  const { tasks, index, paths, cleanup } = await fixture();
  try {
    const task = await tasks.create({ id: "omt-20260327-preview-a1b2c3", title: "Preview", projectName: "app" });
    const manual = "# My hand-written tasks\n\nDo not overwrite this.\n";
    await writeFile(paths.index, manual);
    await assert.rejects(
      index.rebuild([task]),
      (error: unknown) => error instanceof IndexReconciliationRequiredError && error.preview.includes("Proposed Generated Content"),
    );
    assert.equal(await readFile(paths.index, "utf8"), manual);
  } finally { await cleanup(); }
});

test("manual inbox parser ignores generated tasks", () => {
  const source = `# Oh My Task\n\n## Manual Inbox\n\n### Idea\n\n- Objective: Build it\n\n${GENERATED_START}\n## Active Tasks\n\n### Generated\n${GENERATED_END}\n`;
  const entries = parseManualInbox(source);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.title, "Idea");
});
