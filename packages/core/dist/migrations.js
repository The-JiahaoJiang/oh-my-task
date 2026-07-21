import { UnsupportedSchemaVersionError } from "./errors.js";
import { TASK_SCHEMA_VERSION } from "./types.js";
import { parseTaskMetadata } from "./schema.js";
/**
 * Migration registry. Version 1 is the initial format; future migrations are
 * registered here and applied sequentially before final validation.
 */
export const taskMigrations = [];
export function migrateTaskMetadata(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return parseTaskMetadata(value);
    }
    let current = value;
    let version = value.schemaVersion;
    if (!Number.isInteger(version))
        return parseTaskMetadata(value);
    if (version > TASK_SCHEMA_VERSION) {
        throw new UnsupportedSchemaVersionError("task", version, TASK_SCHEMA_VERSION);
    }
    while (version < TASK_SCHEMA_VERSION) {
        const migration = taskMigrations.find((candidate) => candidate.from === version);
        if (!migration)
            throw new UnsupportedSchemaVersionError("task", version, TASK_SCHEMA_VERSION);
        current = migration.migrate(current);
        version = migration.to;
    }
    return parseTaskMetadata(current);
}
//# sourceMappingURL=migrations.js.map