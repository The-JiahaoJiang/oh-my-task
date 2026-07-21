import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseProjectName, type Runtime } from "../src/runtime.js";

function context() {
  let prompts = 0;
  return {
    ctx: {
      cwd: "/work/app",
      hasUI: true,
      ui: {
        async select() { prompts += 1; return undefined; },
        async input() { prompts += 1; return undefined; },
      },
    },
    promptCount: () => prompts,
  };
}

test("saved workspace link bypasses the project prompt", async () => {
  const view = context();
  const runtime = {
    projectLinks: { async get() { return "Approved Project"; } },
  } as unknown as Runtime;
  assert.equal(await chooseProjectName(view.ctx, runtime), "Approved Project");
  assert.equal(view.promptCount(), 0);
});

test("matching task session infers and saves a workspace link", async () => {
  const view = context(); let saved: string | undefined;
  const runtime = {
    projectLinks: {
      async get() { return undefined; },
      async set(_cwd: string, project: string) { saved = project; },
    },
    tasks: {
      async list() {
        return [{
          metadata: { project: { name: "Inferred Project" }, latestSession: { cwd: "/work/app" } },
          body: "",
        }];
      },
    },
  } as unknown as Runtime;
  assert.equal(await chooseProjectName(view.ctx, runtime), "Inferred Project");
  assert.equal(saved, "Inferred Project");
  assert.equal(view.promptCount(), 0);
});
