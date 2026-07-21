export interface ValidationIssue {
  path: string;
  message: string;
  actual?: unknown;
}

export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR";

  constructor(
    message: string,
    readonly issues: ValidationIssue[],
  ) {
    super(`${message}${formatIssues(issues)}`);
    this.name = "ValidationError";
  }
}

export class TaskNotFoundError extends Error {
  readonly code = "TASK_NOT_FOUND";
  constructor(readonly taskId: string) {
    super(`Task was not found: ${taskId}`);
    this.name = "TaskNotFoundError";
  }
}

export class TaskAlreadyExistsError extends Error {
  readonly code = "TASK_ALREADY_EXISTS";
  constructor(readonly taskId: string) {
    super(`Task already exists: ${taskId}`);
    this.name = "TaskAlreadyExistsError";
  }
}

export class StaleRevisionError extends Error {
  readonly code = "STALE_REVISION";
  constructor(readonly taskId: string, readonly expected: number, readonly actual: number) {
    super(`Task ${taskId} changed since it was read (expected revision ${expected}, actual revision ${actual}). Reload and merge before retrying.`);
    this.name = "StaleRevisionError";
  }
}

export class IncompletePlanError extends Error {
  readonly code = "INCOMPLETE_PLAN";
  constructor(readonly taskId: string) {
    super(`Task ${taskId} still has incomplete or blocked plan items. Complete them or provide an explicit force-completion reason.`);
    this.name = "IncompletePlanError";
  }
}

export class UnsupportedSchemaVersionError extends Error {
  readonly code = "UNSUPPORTED_SCHEMA_VERSION";

  constructor(kind: "task" | "config", version: unknown, supported: number) {
    super(
      `${kind} schemaVersion ${String(version)} is not supported; this build supports version ${supported}. ` +
        "Upgrade oh-my-task-cli or migrate the file before continuing.",
    );
    this.name = "UnsupportedSchemaVersionError";
  }
}

function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return "";
  return `\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n")}`;
}
