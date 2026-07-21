import assert from "node:assert/strict";
import { test } from "node:test";
import type { SessionInfo } from "@earendil-works/pi-coding-agent";
import type { OhMyTaskConfig } from "oh-my-task-cli";
import { filterPiSessions, sanitizeSummary } from "../src/session-import.js";

const config: OhMyTaskConfig = {
  schemaVersion: 1, checkpointMode: "manual", startupPrompt: true, defaultSessionSearchDays: 30,
  lock: { retryMs: 1, timeoutMs: 10, staleAfterMs: 100 }, sessionDisplayLimit: 3,
  ignoredPaths: ["**/.env*", "**/*secret*"],
};

function session(overrides: Partial<SessionInfo>): SessionInfo {
  return {
    path: "/sessions/one.jsonl", id: "one", cwd: "/work/app", created: new Date("2026-03-01"),
    modified: new Date("2026-03-20"), messageCount: 4, firstMessage: "Refactor auth token=abc-secret-value",
    allMessagesText: "Refactor authentication middleware", ...overrides,
  };
}

test("session search applies keyword, age, and path filters before preview", () => {
  const results = filterPiSessions([
    session({ id: "match", cwd: "/work/app", modified: new Date("2026-03-25") }),
    session({ id: "old", modified: new Date("2025-01-01") }),
    session({ id: "other", cwd: "/work/other" }),
  ], { keywords: ["authentication"], days: 10, repoPath: "/work/app", now: new Date("2026-03-30") }, config);
  assert.deepEqual(results.map((item) => item.id), ["match"]);
  assert.doesNotMatch(results[0]!.preview, /abc-secret-value/);
});

test("summary sanitization removes credentials and ignored path lines", () => {
  const value = sanitizeSummary("password=hunter2\nRead .env.production\nSafe decision", config.ignoredPaths);
  assert.match(value, /password=\[REDACTED\]/);
  assert.doesNotMatch(value, /\.env/);
  assert.match(value, /Safe decision/);
});
