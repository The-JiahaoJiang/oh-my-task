import assert from "node:assert/strict";
import { test } from "node:test";
import { ASSOCIATION_ENTRY, buildCompactContext, extractRecentSessions, findAssociation } from "../src/context.js";
import { buildImportedPlanProgressPrompt, filteringHint, parseNewTaskArguments, taskLabel } from "../src/ui.js";

const task = {
  metadata: {
    schemaVersion: 1 as const,
    id: "omt-20260327-test-a1b2c3",
    title: "Test task",
    status: "in-progress" as const,
    revision: 3,
    createdAt: "2026-03-27T00:00:00Z",
    updatedAt: "2026-03-27T02:00:00Z",
    project: { name: "app" },
    progressSummary: "Implementation underway",
    nextAction: "Run tests",
  },
  body: `# Test task\n\n## Objective\n\nBuild it.\n\n## Constraints\n\n- Safe\n\n## Plan\n\n- [>] **build** — Build it\n\n## Current State\n\n### Progress\n\nUnderway.\n\n## Sessions\n\n- pi — \`old\` — \`/app\` — last used 2026-03-26T00:00:00Z\n- claude-code — \`foreign\` — \`/app\` — last used 2026-03-28T00:00:00Z\n- pi — \`new\` — \`/app\` — last used 2026-03-27T00:00:00Z\n\n## Checkpoint History\n\n_None._\n`,
};

test("compact context includes current sections but not session history", () => {
  const context = buildCompactContext(task);
  assert.match(context, /Build it/);
  assert.match(context, /Run tests/);
  assert.doesNotMatch(context, /foreign/);
  assert.doesNotMatch(context, /Checkpoint History/);
});

test("recent session selector keeps only compatible sessions", () => {
  assert.deepEqual(extractRecentSessions(task, "pi", 1).map((item) => item.sessionId), ["new"]);
});

test("latest valid branch association wins", () => {
  const entries = [
    { type: "custom", customType: ASSOCIATION_ENTRY, data: { taskId: "one", revision: 1, projectName: "app" } },
    { type: "custom", customType: "other", data: {} },
    { type: "custom", customType: ASSOCIATION_ENTRY, data: { taskId: "two", revision: 2, projectName: "app" } },
  ];
  assert.equal(findAssociation(entries)?.taskId, "two");
});

test("task labels explicitly identify tasks, status, and progress", () => {
  assert.equal(taskLabel(task), "Task: Test task · Status: in-progress · Progress: Implementation underway");
  assert.match(filteringHint("app"), /Other user-wide tasks are hidden/);
});

test("approved imported-plan review prompt limits inspection and requires evidence", () => {
  const importedTask = {
    ...task,
    metadata: { ...task.metadata, sourcePlan: { path: "/work/app/PLAN.md", importedAt: "2026-03-27T00:00:00Z" } },
  };
  const prompt = buildImportedPlanProgressPrompt(importedTask);
  assert.match(prompt, /user approved/);
  assert.match(prompt, /directly related project files/);
  assert.match(prompt, /verified evidence/);
  assert.match(prompt, /PLAN\.md/);
  assert.match(prompt, /instead of guessing/);
});

test("new-task arguments accept @ plan references including spaces", () => {
  assert.deepEqual(parseNewTaskArguments("--plan @docs/PLAN.md"), { title: "", planPath: "docs/PLAN.md" });
  assert.deepEqual(parseNewTaskArguments("My task --plan \"@docs/design plan.md\""), {
    title: "My task", planPath: "docs/design plan.md",
  });
});
