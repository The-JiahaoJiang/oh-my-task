import { UnsupportedSchemaVersionError } from "./errors.js";
import { TASK_SCHEMA_VERSION, type Migration, type TaskMetadata } from "./types.js";
import { parseTaskMetadata } from "./schema.js";

/**
 * Migration registry. Version 1 is the initial format; future migrations are
 * registered here and applied sequentially before final validation.
 */
export const taskMigrations: ReadonlyArray<Migration<unknown>> = [];

export function migrateTaskMetadata(value: unknown): TaskMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return parseTaskMetadata(value);
  }

  let current: unknown = value;
  let version = (value as Record<string, unknown>).schemaVersion;
  if (!Number.isInteger(version)) return parseTaskMetadata(value);
  if ((version as number) > TASK_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError("task", version, TASK_SCHEMA_VERSION);
  }

  while ((version as number) < TASK_SCHEMA_VERSION) {
    const migration = taskMigrations.find((candidate) => candidate.from === version);
    if (!migration) throw new UnsupportedSchemaVersionError("task", version, TASK_SCHEMA_VERSION);
    current = migration.migrate(current);
    version = migration.to;
  }

  return parseTaskMetadata(current);
}
