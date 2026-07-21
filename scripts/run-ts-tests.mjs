#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(process.cwd(), process.argv[2] ?? "test");
const files = (await readdir(directory))
  .filter((name) => name.endsWith(".test.ts"))
  .sort()
  .map((name) => resolve(directory, name));
if (!files.length) throw new Error(`No TypeScript tests found in ${directory}`);
const child = spawn(process.execPath, ["--import", "tsx", "--test", ...files], { cwd: root, stdio: "inherit" });
child.once("error", (error) => { throw error; });
child.once("exit", (code) => { process.exitCode = code ?? 1; });
