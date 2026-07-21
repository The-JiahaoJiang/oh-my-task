import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const root = resolve(process.cwd());

test("shared skill has valid Agent Skills frontmatter and portable CLI guidance", async () => {
  const source = await readFile(resolve(root, "skills", "oh-my-task", "SKILL.md"), "utf8");
  assert.match(source, /^---\nname: oh-my-task\ndescription: .+\ncompatibility: .+\n---/);
  assert.doesNotMatch(source, /oh-my-task-cli/);
  assert.match(source, /node <skill-directory>\/cli\.mjs checkpoint/);
  assert.match(source, /<skill-directory>\/cli\.mjs/);
  assert.match(source, /STALE_REVISION/);
  assert.match(source, /claude-code\|codex-cli\|kimi-cli\|opencode/);
  assert.match(source, /separately ask whether to review and update implementation progress/);
  assert.match(source, /Generate a Completion and Design Document/);
  assert.match(source, /docs\/oh-my-task\/<task-id>-completion\.md/);
  assert.match(source, /complete final design/i);
  await access(resolve(root, "skills", "oh-my-task", "assets", "completion-doc-template.md"));
});

test("recovery and migration guidance documents destructive-operation safeguards", async () => {
  const source = await readFile(resolve(root, "docs", "RECOVERY.md"), "utf8");
  assert.match(source, /Back up/);
  assert.match(source, /explicit approval/);
  assert.match(source, /schemaVersion/);
  assert.match(source, /Name collisions/);
});

test("GitHub Pages workflow generates, validates, and deploys the project site", async () => {
  const workflow = await readFile(resolve(root, ".github", "workflows", "pages.yml"), "utf8");
  assert.match(workflow, /generate_design_html\.py/);
  assert.match(workflow, /generate_project_site\.py/);
  assert.match(workflow, /check_project_site\.py/);
  assert.match(workflow, /OH-MY-TASK\.html/);
  assert.match(workflow, /pip install --requirement requirements-site\.txt/);
  await access(resolve(root, "requirements-site.txt"));
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /pages: write/);
  await access(resolve(root, "scripts", "generate_project_site.py"));
  await access(resolve(root, "scripts", "check_project_site.py"));
});

test("Pi extension cannot register a competing user command", async () => {
  const source = await readFile(resolve(root, "packages", "pi-extension", "src", "index.ts"), "utf8");
  assert.doesNotMatch(source, /registerCommand\s*\(\s*["']oh-my-task["']/);
  assert.doesNotMatch(source, /\/oh-my-task\b/);
});

test("Pi hot reload does not require the core ProjectLinkStore export", async () => {
  const source = await readFile(resolve(root, "packages", "pi-extension", "src", "runtime.ts"), "utf8");
  assert.doesNotMatch(source, /new ProjectLinkStore\s*\(/);
  assert.match(source, /new ExtensionProjectLinkStore\s*\(/);
});

test("root Pi package manifest references existing extension and skill", async () => {
  const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as {
    keywords: string[];
    pi: { extensions: string[]; skills: string[] };
  };
  assert.ok(manifest.keywords.includes("pi-package"));
  for (const path of [...manifest.pi.extensions, ...manifest.pi.skills]) await access(resolve(root, path));
});
