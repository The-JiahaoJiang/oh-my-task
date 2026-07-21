import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const root = resolve(process.cwd());

test("shared skill has valid Agent Skills frontmatter and portable CLI guidance", async () => {
  const source = await readFile(resolve(root, "skills", "oh-my-task", "SKILL.md"), "utf8");
  assert.match(source, /^---\nname: oh-my-task\ndescription: .+\ncompatibility: .+\n---/);
  assert.match(source, /oh-my-task-cli checkpoint/);
  assert.match(source, /STALE_REVISION/);
  assert.match(source, /claude-code\|codex-cli\|kimi-cli\|opencode/);
});

test("recovery and migration guidance documents destructive-operation safeguards", async () => {
  const source = await readFile(resolve(root, "docs", "RECOVERY.md"), "utf8");
  assert.match(source, /Back up/);
  assert.match(source, /explicit approval/);
  assert.match(source, /schemaVersion/);
  assert.match(source, /Name collisions/);
});

test("root Pi package manifest references existing extension and skill", async () => {
  const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as {
    keywords: string[];
    pi: { extensions: string[]; skills: string[] };
  };
  assert.ok(manifest.keywords.includes("pi-package"));
  for (const path of [...manifest.pi.extensions, ...manifest.pi.skills]) await access(resolve(root, path));
});
