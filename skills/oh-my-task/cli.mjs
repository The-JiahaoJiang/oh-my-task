#!/usr/bin/env node
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const skillDirectory = dirname(fileURLToPath(import.meta.url));
const candidates = [
  resolve(skillDirectory, "../../packages/core/dist/cli.js"),
  resolve(skillDirectory, "runtime/cli.js"),
];
let cliPath;
for (const candidate of candidates) {
  try { await access(candidate); cliPath = candidate; break; } catch { /* try the standalone install layout */ }
}
if (!cliPath) throw new Error("Oh My Task CLI runtime was not found. Reinstall the package or skill.");
const { runCli } = await import(pathToFileURL(cliPath).href);
process.exitCode = await runCli(process.argv.slice(2));
