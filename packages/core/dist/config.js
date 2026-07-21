import { CONFIG_SCHEMA_VERSION } from "./types.js";
export const DEFAULT_CONFIG = Object.freeze({
    schemaVersion: CONFIG_SCHEMA_VERSION,
    checkpointMode: "manual",
    startupPrompt: true,
    defaultSessionSearchDays: 30,
    lock: Object.freeze({
        retryMs: 250,
        timeoutMs: 5_000,
        staleAfterMs: 300_000,
    }),
    sessionDisplayLimit: 3,
    ignoredPaths: Object.freeze([
        "**/.env*",
        "**/*secret*",
        "**/*credential*",
        "**/.ssh/**",
    ]),
});
export function createDefaultConfig() {
    return {
        ...DEFAULT_CONFIG,
        lock: { ...DEFAULT_CONFIG.lock },
        ignoredPaths: [...DEFAULT_CONFIG.ignoredPaths],
    };
}
//# sourceMappingURL=config.js.map