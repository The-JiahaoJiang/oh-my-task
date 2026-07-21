import { CONFIG_SCHEMA_VERSION, type OhMyTaskConfig } from "./types.js";

export const DEFAULT_CONFIG: Readonly<OhMyTaskConfig> = Object.freeze({
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
  ]) as unknown as string[],
});

export function createDefaultConfig(): OhMyTaskConfig {
  return {
    ...DEFAULT_CONFIG,
    lock: { ...DEFAULT_CONFIG.lock },
    ignoredPaths: [...DEFAULT_CONFIG.ignoredPaths],
  };
}
