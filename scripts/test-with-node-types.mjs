#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = join(root, ".test-build");
const packageRoot = join(root, "packages", "core");
const outputRoot = join(buildRoot, "packages", "core");

await rm(buildRoot, { recursive: true, force: true });

async function transpileTree(sourceDir) {
  const { readdir } = await import("node:fs/promises");
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      await transpileTree(source);
    } else if (extname(source) === ".ts") {
      const destination = join(outputRoot, relative(packageRoot, source)).replace(/\.ts$/, ".js");
      await mkdir(dirname(destination), { recursive: true });
      const code = await readFile(source, "utf8");
      const output = stripTypeScriptTypes(code, {
        mode: "transform",
        sourceMap: true,
        sourceUrl: source,
      });
      await writeFile(destination, output, "utf8");
    }
  }
}

await transpileTree(join(packageRoot, "src"));
await transpileTree(join(packageRoot, "test"));
await cp(join(packageRoot, "test", "fixtures"), join(outputRoot, "test", "fixtures"), { recursive: true });

const { readdir } = await import("node:fs/promises");
const testFiles = (await readdir(join(outputRoot, "test")))
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => join(outputRoot, "test", name));
const child = spawn(process.execPath, ["--test", ...testFiles], { cwd: root, stdio: "inherit" });
const code = await new Promise((resolveCode, reject) => {
  child.once("error", reject);
  child.once("exit", (value) => resolveCode(value ?? 1));
});
process.exitCode = code;
