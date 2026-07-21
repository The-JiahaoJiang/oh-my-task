export class ValidationError extends Error {
    issues;
    code = "VALIDATION_ERROR";
    constructor(message, issues) {
        super(`${message}${formatIssues(issues)}`);
        this.issues = issues;
        this.name = "ValidationError";
    }
}
export class TaskNotFoundError extends Error {
    taskId;
    code = "TASK_NOT_FOUND";
    constructor(taskId) {
        super(`Task was not found: ${taskId}`);
        this.taskId = taskId;
        this.name = "TaskNotFoundError";
    }
}
export class TaskAlreadyExistsError extends Error {
    taskId;
    code = "TASK_ALREADY_EXISTS";
    constructor(taskId) {
        super(`Task already exists: ${taskId}`);
        this.taskId = taskId;
        this.name = "TaskAlreadyExistsError";
    }
}
export class StaleRevisionError extends Error {
    taskId;
    expected;
    actual;
    code = "STALE_REVISION";
    constructor(taskId, expected, actual) {
        super(`Task ${taskId} changed since it was read (expected revision ${expected}, actual revision ${actual}). Reload and merge before retrying.`);
        this.taskId = taskId;
        this.expected = expected;
        this.actual = actual;
        this.name = "StaleRevisionError";
    }
}
export class IncompletePlanError extends Error {
    taskId;
    code = "INCOMPLETE_PLAN";
    constructor(taskId) {
        super(`Task ${taskId} still has incomplete or blocked plan items. Complete them or provide an explicit force-completion reason.`);
        this.taskId = taskId;
        this.name = "IncompletePlanError";
    }
}
export class UnsupportedSchemaVersionError extends Error {
    code = "UNSUPPORTED_SCHEMA_VERSION";
    constructor(kind, version, supported) {
        super(`${kind} schemaVersion ${String(version)} is not supported; this build supports version ${supported}. ` +
            "Upgrade oh-my-task-cli or migrate the file before continuing.");
        this.name = "UnsupportedSchemaVersionError";
    }
}
function formatIssues(issues) {
    if (issues.length === 0)
        return "";
    return `\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n")}`;
}
//# sourceMappingURL=errors.js.map