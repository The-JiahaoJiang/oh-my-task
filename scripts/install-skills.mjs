#!/usr/bin/env node
import { cp, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "skills", "oh-my-task");
const targetArg = process.argv.indexOf("--path");
const requested = targetArg >= 0 ? process.argv[targetArg + 1] : undefined;
const target = requested ? resolve(requested) : join(homedir(), ".agents", "skills", "oh-my-task");

await mkdir(dirname(target), { recursive: true });
await cp(source, target, { recursive: true, force: true });
console.log(`Installed Oh My Task skill to ${target}`);
console.log("Pi discovers ~/.agents/skills automatically. For another harness, pass --path with its documented skill directory.");
