import { readFile } from "node:fs/promises";
import { atomicWriteFile } from "./atomic.js";
import { createDefaultConfig } from "./config.js";
import { parseConfig } from "./schema.js";
export async function loadConfig(paths) {
    try {
        const source = await readFile(paths.config, "utf8");
        return parseConfig(JSON.parse(source));
    }
    catch (error) {
        if (error.code === "ENOENT")
            return createDefaultConfig();
        if (error instanceof SyntaxError)
            throw new SyntaxError(`Invalid JSON in ${paths.config}: ${error.message}`);
        throw error;
    }
}
export async function saveConfig(paths, config) {
    const validated = parseConfig(config);
    await atomicWriteFile(paths.config, `${JSON.stringify(validated, null, 2)}\n`, { recoveryDir: paths.recovery });
}
//# sourceMappingURL=config-store.js.map