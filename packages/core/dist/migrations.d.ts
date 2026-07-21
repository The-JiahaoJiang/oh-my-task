import { type Migration, type TaskMetadata } from "./types.js";
/**
 * Migration registry. Version 1 is the initial format; future migrations are
 * registered here and applied sequentially before final validation.
 */
export declare const taskMigrations: ReadonlyArray<Migration<unknown>>;
export declare function migrateTaskMetadata(value: unknown): TaskMetadata;
//# sourceMappingURL=migrations.d.ts.map