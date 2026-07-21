import assert from "node:assert/strict";
import { test } from "node:test";
import { join, resolve } from "node:path";
import {
  createDefaultConfig,
  createTaskId,
  getOhMyTaskPaths,
  parseConfig,
  slugify,
  suggestProjectName,
  validateProjectName,
  ValidationError,
} from "../src/index.js";

test("OH_MY_TASK_HOME overrides the user-wide default", () => {
  const defaults = getOhMyTaskPaths({ env: {}, home: "/home/alice", cwd: "/work" });
  assert.equal(defaults.root, join("/home/alice", ".oh-my-task"));
  assert.equal(defaults.index, join("/home/alice", ".oh-my-task", "oh-my-task.md"));

  const overridden = getOhMyTaskPaths({
    env: { OH_MY_TASK_HOME: "./state" },
    home: "/home/alice",
    cwd: "/work/project",
  });
  assert.equal(overridden.root, resolve("/work/project", "state"));
});

test("task IDs are stable with injected time and suffix", () => {
  assert.equal(slugify("  Café & Auth API  "), "cafe-auth-api");
  assert.equal(
    createTaskId("Refactor Authentication", {
      now: new Date("2026-03-27T12:00:00Z"),
      suffix: "a1b2c3",
    }),
    "omt-20260327-refactor-authentication-a1b2c3",
  );
});

test("project name uses only the current folder basename", () => {
  assert.equal(suggestProjectName("/work/acme/my-app"), "my-app");
  assert.equal(validateProjectName("  Customer Portal  "), "Customer Portal");
  assert.throws(() => validateProjectName(" \n "), /cannot be empty|line breaks/);
});

test("default configuration validates and returns independent copies", () => {
  const first = createDefaultConfig();
  const second = createDefaultConfig();
  assert.deepEqual(parseConfig(first), first);
  first.ignoredPaths.push("custom");
  assert.equal(second.ignoredPaths.includes("custom"), false);
});

test("invalid configuration reports actionable fields", () => {
  const config = { ...createDefaultConfig(), checkpointMode: "sometimes", lock: { retryMs: 0 } };
  assert.throws(
    () => parseConfig(config),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.match(error.message, /checkpointMode/);
      assert.match(error.message, /lock.retryMs/);
      assert.match(error.message, /lock.timeoutMs/);
      return true;
    },
  );
});
