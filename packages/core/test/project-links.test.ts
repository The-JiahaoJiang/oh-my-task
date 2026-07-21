import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { getOhMyTaskPaths, ProjectLinkStore, workspaceKey } from "../src/index.js";

test("workspace project links persist approved names", async () => {
  const root = await mkdtemp(join(tmpdir(), "omt-links-"));
  try {
    const paths = getOhMyTaskPaths({ env: { OH_MY_TASK_HOME: root } });
    const store = new ProjectLinkStore(paths, { config: { retryMs: 2, timeoutMs: 1000, staleAfterMs: 10000 } });
    assert.equal(await store.get(join(root, "workspace")), undefined);
    await store.set(join(root, "workspace"), "Customer Portal");
    assert.equal(await store.get(join(root, "workspace", ".")), "Customer Portal");
    await store.remove(join(root, "workspace"));
    assert.equal(await store.get(join(root, "workspace")), undefined);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("workspace keys normalize path separators and Windows case", () => {
  const key = workspaceKey(join("some", "folder"));
  assert.doesNotMatch(key, /\\/);
  assert.ok(key.endsWith("/some/folder"));
});
