import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePlanMarkdown } from "../src/index.js";

test("plan import extracts title, objective, statuses, and unique IDs", () => {
  const imported = normalizePlanMarkdown(`# Authentication Plan\n\n## Objective\n\nReplace legacy authentication.\n\n- [x] Inspect code\n- [>] **implement-auth** — Implement auth\n- [!] Fix tests\n- [ ] Fix tests\n`, "/work/PLAN.md", new Date("2026-03-27T00:00:00Z"));
  assert.equal(imported.suggestedTitle, "Authentication Plan");
  assert.equal(imported.objective, "Replace legacy authentication.");
  assert.deepEqual(imported.plan.map((item) => [item.id, item.status]), [
    ["inspect-code", "completed"],
    ["implement-auth", "in-progress"],
    ["fix-tests", "blocked"],
    ["fix-tests-2", "not-started"],
  ]);
  assert.equal(imported.sourcePlan.path, "/work/PLAN.md");
});
