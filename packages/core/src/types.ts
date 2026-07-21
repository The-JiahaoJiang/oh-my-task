export const TASK_SCHEMA_VERSION = 1 as const;
export const CONFIG_SCHEMA_VERSION = 1 as const;

export type TaskStatus = "planned" | "in-progress" | "blocked" | "completed" | "archived";
export type PlanItemStatus = "not-started" | "in-progress" | "completed" | "blocked";
export type CheckpointMode = "manual" | "auto";

export interface ProjectReference {
  name: string;
}

export interface SessionReference {
  agent: string;
  sessionId: string;
  cwd: string;
  updatedAt: string;
}

export interface SourcePlanReference {
  path: string;
  importedAt: string;
}

export interface TaskMetadata {
  schemaVersion: typeof TASK_SCHEMA_VERSION;
  id: string;
  title: string;
  status: TaskStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  project: ProjectReference;
  activePlanItem?: string;
  progressSummary?: string;
  nextAction?: string;
  latestSession?: SessionReference;
  sourcePlan?: SourcePlanReference;
}

export interface PlanItem {
  id: string;
  title: string;
  status: PlanItemStatus;
  progress?: string;
  files?: RelevantFile[];
  decisions?: string[];
  blockers?: string[];
}

export interface RelevantFile {
  path: string;
  note?: string;
}

export interface Checkpoint {
  number: number;
  createdAt: string;
  baseRevision: number;
  planItemIds: string[];
  completedPlanItemIds: string[];
  progress: string;
  files: RelevantFile[];
  decisions: string[];
  blockers: string[];
  nextAction: string;
  status: TaskStatus;
  session?: SessionReference;
}

export interface LockConfig {
  retryMs: number;
  timeoutMs: number;
  staleAfterMs: number;
}

export interface OhMyTaskConfig {
  schemaVersion: typeof CONFIG_SCHEMA_VERSION;
  checkpointMode: CheckpointMode;
  startupPrompt: boolean;
  defaultSessionSearchDays: number;
  lock: LockConfig;
  sessionDisplayLimit: number;
  ignoredPaths: string[];
}

export interface TaskDocument {
  metadata: TaskMetadata;
  /** Markdown after the YAML frontmatter, preserved verbatim. */
  body: string;
}

export interface Migration<T> {
  readonly from: number;
  readonly to: number;
  migrate(value: unknown): T;
}
