import { type AcquireLockOptions } from "./lock.js";
import type { OhMyTaskPaths } from "./paths.js";
import type { TaskDocument } from "./types.js";
export declare const GENERATED_START = "<!-- OH-MY-TASK:GENERATED:START -->";
export declare const GENERATED_END = "<!-- OH-MY-TASK:GENERATED:END -->";
export interface ManualInboxEntry {
    title: string;
    projectName?: string;
    objective?: string;
    planLines: string[];
    source: string;
}
export interface IndexStoreOptions {
    paths: OhMyTaskPaths;
    lock: AcquireLockOptions;
}
export declare class IndexReconciliationRequiredError extends Error {
    readonly preview: string;
    readonly code = "INDEX_RECONCILIATION_REQUIRED";
    constructor(preview: string);
}
export declare class IndexStore {
    private readonly options;
    constructor(options: IndexStoreOptions);
    read(): Promise<string | undefined>;
    rebuild(tasks: TaskDocument[]): Promise<string>;
    validate(tasks: TaskDocument[]): Promise<{
        valid: boolean;
        staleTaskIds: string[];
        errors: string[];
    }>;
    readInbox(): Promise<ManualInboxEntry[]>;
}
export declare function createIndexDocument(generated: string): string;
export declare function replaceGeneratedRegion(source: string, generated: string): string;
export declare function renderGeneratedIndex(tasks: TaskDocument[]): string;
export declare function parseManualInbox(source: string): ManualInboxEntry[];
//# sourceMappingURL=index-store.d.ts.map