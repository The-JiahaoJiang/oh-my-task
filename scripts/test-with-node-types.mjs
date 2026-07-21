#!/usr/bin/env node
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = join(root, ".test-build");
await rm(buildRoot, { recursive: true, force: true });

async function transpileTree(sourceDir, packageRoot, outputRoot) {
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name);
    if (entry.isDirectory()) await transpileTree(source, packageRoot, outputRoot);
    else if (extname(source) === ".ts") {
      const destination = join(outputRoot, relative(packageRoot, source)).replace(/\.ts$/, ".js");
      await mkdir(dirname(destination), { recursive: true });
      const output = stripTypeScriptTypes(await readFile(source, "utf8"), {
        mode: "transform", sourceMap: true, sourceUrl: source,
      });
      await writeFile(destination, output, "utf8");
    }
  }
}

const testFiles = [];
for (const packageName of await readdir(join(root, "packages"))) {
  const packageRoot = join(root, "packages", packageName);
  const outputRoot = join(buildRoot, "packages", packageName);
  try { await transpileTree(join(packageRoot, "src"), packageRoot, outputRoot); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await transpileTree(join(packageRoot, "test"), packageRoot, outputRoot);
    for (const name of (await readdir(join(outputRoot, "test"))).filter((name) => name.endsWith(".test.js")).sort()) {
      testFiles.push(join(outputRoot, "test", name));
    }
    try { await cp(join(packageRoot, "test", "fixtures"), join(outputRoot, "test", "fixtures"), { recursive: true }); } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

// Make the transpiled workspace package resolvable to cross-package tests without npm install.
const localPackage = join(buildRoot, "node_modules", "oh-my-task-cli");
await mkdir(localPackage, { recursive: true });
await writeFile(join(localPackage, "package.json"), JSON.stringify({
  name: "oh-my-task-cli",
  type: "module",
  exports: "./index.js",
}), "utf8");
await writeFile(join(localPackage, "index.js"), 'export * from "../../packages/core/src/index.js";\n', "utf8");

const child = spawn(process.execPath, ["--test", ...testFiles], { cwd: root, stdio: "inherit" });
const code = await new Promise((resolveCode, reject) => {
  child.once("error", reject);
  child.once("exit", (value) => resolveCode(value ?? 1));
});
process.exitCode = code;
