import assert from "node:assert/strict";
import { test } from "node:test";
import { AutoCheckpointController } from "../src/auto-checkpoint.js";

test("meaningful file work requests one guarded checkpoint", () => {
  const state = new AutoCheckpointController();
  state.observeTool("read", false);
  assert.equal(state.shouldRequestCheckpoint(true), false);
  state.observeTool("edit", false);
  assert.equal(state.shouldRequestCheckpoint(true), true);
  assert.equal(state.shouldRequestCheckpoint(true), false, "prompted turn must not loop");
  assert.equal(state.shouldRequestCheckpoint(true), true, "later settlement may retry uncheckpointed work");
});

test("failed writes and sessions without active tasks do not prompt", () => {
  const state = new AutoCheckpointController();
  state.observeTool("write", true);
  assert.equal(state.shouldRequestCheckpoint(true), false);
  state.observeTool("write", false);
  assert.equal(state.shouldRequestCheckpoint(false), false);
});

test("successful checkpoint clears dirty and guard state", () => {
  const state = new AutoCheckpointController();
  state.markTaskStateChanged();
  assert.equal(state.shouldRequestCheckpoint(true), true);
  state.checkpointSucceeded();
  assert.deepEqual(state.snapshot(), { dirty: false, promptInFlight: false });
  assert.equal(state.shouldRequestCheckpoint(true), false);
});
