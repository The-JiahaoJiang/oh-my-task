import { readFile } from "node:fs/promises";
import { atomicWriteFile } from "./atomic.js";
import { createDefaultConfig } from "./config.js";
import { parseConfig } from "./schema.js";
import type { OhMyTaskPaths } from "./paths.js";
import type { OhMyTaskConfig } from "./types.js";

export async function loadConfig(paths: OhMyTaskPaths): Promise<OhMyTaskConfig> {
  try {
    const source = await readFile(paths.config, "utf8");
    return parseConfig(JSON.parse(source) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return createDefaultConfig();
    if (error instanceof SyntaxError) throw new SyntaxError(`Invalid JSON in ${paths.config}: ${error.message}`);
    throw error;
  }
}

export async function saveConfig(paths: OhMyTaskPaths, config: OhMyTaskConfig): Promise<void> {
  const validated = parseConfig(config);
  await atomicWriteFile(paths.config, `${JSON.stringify(validated, null, 2)}\n`, { recoveryDir: paths.recovery });
}
