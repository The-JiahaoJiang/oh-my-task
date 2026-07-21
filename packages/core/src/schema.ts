import { UnsupportedSchemaVersionError, ValidationError, type ValidationIssue } from "./errors.js";
import {
  CONFIG_SCHEMA_VERSION,
  TASK_SCHEMA_VERSION,
  type OhMyTaskConfig,
  type SessionReference,
  type TaskMetadata,
  type TaskStatus,
} from "./types.js";

const TASK_STATUSES = new Set<TaskStatus>(["planned", "in-progress", "blocked", "completed", "archived"]);

export function parseTaskMetadata(value: unknown): TaskMetadata {
  const object = record(value, "frontmatter");
  checkVersion("task", object.schemaVersion, TASK_SCHEMA_VERSION);
  const issues: ValidationIssue[] = [];

  requiredString(object, "id", issues, { pattern: /^omt-\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*$/ });
  requiredString(object, "title", issues);
  requiredEnum(object, "status", TASK_STATUSES, issues);
  requiredInteger(object, "revision", issues, 0);
  requiredDate(object, "createdAt", issues);
  requiredDate(object, "updatedAt", issues);

  const project = optionalRecord(object.project, "project", issues);
  if (project) requiredString(project, "name", issues, {}, "project.name");

  optionalString(object, "activePlanItem", issues);
  optionalString(object, "progressSummary", issues);
  optionalString(object, "nextAction", issues);
  if (object.latestSession !== undefined) validateSession(object.latestSession, "latestSession", issues);

  if (object.sourcePlan !== undefined) {
    const source = optionalRecord(object.sourcePlan, "sourcePlan", issues);
    if (source) {
      requiredString(source, "path", issues, {}, "sourcePlan.path");
      requiredDate(source, "importedAt", issues, "sourcePlan.importedAt");
    }
  }

  if (issues.length) throw new ValidationError("Task frontmatter is invalid.", issues);
  return object as unknown as TaskMetadata;
}

export function parseConfig(value: unknown): OhMyTaskConfig {
  const object = record(value, "config");
  checkVersion("config", object.schemaVersion, CONFIG_SCHEMA_VERSION);
  const issues: ValidationIssue[] = [];

  requiredEnum(object, "checkpointMode", new Set(["manual", "auto"]), issues);
  requiredBoolean(object, "startupPrompt", issues);
  requiredInteger(object, "defaultSessionSearchDays", issues, 1);
  requiredInteger(object, "sessionDisplayLimit", issues, 1);
  const lock = optionalRecord(object.lock, "lock", issues);
  if (lock) {
    requiredInteger(lock, "retryMs", issues, 1, "lock.retryMs");
    requiredInteger(lock, "timeoutMs", issues, 1, "lock.timeoutMs");
    requiredInteger(lock, "staleAfterMs", issues, 1, "lock.staleAfterMs");
  }
  if (!Array.isArray(object.ignoredPaths) || object.ignoredPaths.some((item) => typeof item !== "string")) {
    issues.push({ path: "ignoredPaths", message: "must be an array of strings" });
  }

  if (issues.length) throw new ValidationError("Configuration is invalid.", issues);
  return object as unknown as OhMyTaskConfig;
}

function validateSession(value: unknown, path: string, issues: ValidationIssue[]): SessionReference | undefined {
  const session = optionalRecord(value, path, issues);
  if (!session) return undefined;
  requiredString(session, "agent", issues, {}, `${path}.agent`);
  requiredString(session, "sessionId", issues, {}, `${path}.sessionId`);
  requiredString(session, "cwd", issues, {}, `${path}.cwd`);
  requiredDate(session, "updatedAt", issues, `${path}.updatedAt`);
  return session as unknown as SessionReference;
}

function checkVersion(kind: "task" | "config", value: unknown, supported: number): void {
  if (value !== supported) throw new UnsupportedSchemaVersionError(kind, value, supported);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${path} is invalid.`, [{ path, message: "must be an object", actual: value }]);
  }
  return value as Record<string, unknown>;
}

function optionalRecord(value: unknown, path: string, issues: ValidationIssue[]): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push({ path, message: "must be an object", actual: value });
    return undefined;
  }
  return value as Record<string, unknown>;
}

function requiredString(
  object: Record<string, unknown>, key: string, issues: ValidationIssue[],
  constraints: { pattern?: RegExp } = {}, path = key,
): void {
  const value = object[key];
  if (typeof value !== "string" || value.trim() === "") {
    issues.push({ path, message: "must be a non-empty string", actual: value });
  } else if (constraints.pattern && !constraints.pattern.test(value)) {
    issues.push({ path, message: `must match ${constraints.pattern}`, actual: value });
  }
}

function optionalString(object: Record<string, unknown>, key: string, issues: ValidationIssue[]): void {
  if (object[key] !== undefined && (typeof object[key] !== "string" || object[key] === "")) {
    issues.push({ path: key, message: "must be a non-empty string when provided", actual: object[key] });
  }
}

function requiredInteger(
  object: Record<string, unknown>, key: string, issues: ValidationIssue[], minimum: number, path = key,
): void {
  const value = object[key];
  if (!Number.isInteger(value) || (value as number) < minimum) {
    issues.push({ path, message: `must be an integer greater than or equal to ${minimum}`, actual: value });
  }
}

function requiredBoolean(object: Record<string, unknown>, key: string, issues: ValidationIssue[]): void {
  if (typeof object[key] !== "boolean") issues.push({ path: key, message: "must be a boolean", actual: object[key] });
}

function requiredDate(object: Record<string, unknown>, key: string, issues: ValidationIssue[], path = key): void {
  const value = object[key];
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    issues.push({ path, message: "must be an ISO-8601 date string", actual: value });
  }
}

function requiredEnum<T extends string>(
  object: Record<string, unknown>, key: string, allowed: Set<T>, issues: ValidationIssue[],
): void {
  if (typeof object[key] !== "string" || !allowed.has(object[key] as T)) {
    issues.push({ path: key, message: `must be one of: ${[...allowed].join(", ")}`, actual: object[key] });
  }
}
