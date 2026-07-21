export interface ValidationIssue {
    path: string;
    message: string;
    actual?: unknown;
}
export declare class ValidationError extends Error {
    readonly issues: ValidationIssue[];
    readonly code = "VALIDATION_ERROR";
    constructor(message: string, issues: ValidationIssue[]);
}
export declare class TaskNotFoundError extends Error {
    readonly taskId: string;
    readonly code = "TASK_NOT_FOUND";
    constructor(taskId: string);
}
export declare class TaskAlreadyExistsError extends Error {
    readonly taskId: string;
    readonly code = "TASK_ALREADY_EXISTS";
    constructor(taskId: string);
}
export declare class StaleRevisionError extends Error {
    readonly taskId: string;
    readonly expected: number;
    readonly actual: number;
    readonly code = "STALE_REVISION";
    constructor(taskId: string, expected: number, actual: number);
}
export declare class IncompletePlanError extends Error {
    readonly taskId: string;
    readonly code = "INCOMPLETE_PLAN";
    constructor(taskId: string);
}
export declare class UnsupportedSchemaVersionError extends Error {
    readonly code = "UNSUPPORTED_SCHEMA_VERSION";
    constructor(kind: "task" | "config", version: unknown, supported: number);
}
//# sourceMappingURL=errors.d.ts.map