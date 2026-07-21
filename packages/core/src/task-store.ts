import { access, mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { atomicWriteFile } from "./atomic.js";
import { createTaskId } from "./id.js";
import { withFileLock, type AcquireLockOptions } from "./lock.js";
import { parseTaskDocument, serializeTaskDocument } from "./markdown.js";
import {
  IncompletePlanError,
  StaleRevisionError,
  TaskAlreadyExistsError,
  TaskNotFoundError,
  ValidationError,
} from "./errors.js";
import {
  addSession,
  appendCheckpoint,
  countCheckpoints,
  createTaskBody,
  hasIncompletePlanItems,
  updateCurrentState,
  updatePlanItems,
} from "./task-body.js";
import { getOhMyTaskPaths, type OhMyTaskPaths } from "./paths.js";
import { TASK_SCHEMA_VERSION, type PlanItem, type PlanItemStatus, type RelevantFile, type SessionReference, type SourcePlanReference, type TaskDocument, type TaskMetadata, type TaskStatus } from "./types.js";

export interface TaskStoreOptions {
  paths?: OhMyTaskPaths;
  lock: AcquireLockOptions;
  now?: () => Date;
}

export interface CreateTaskInput {
  id?: string;
  title: string;
  projectName: string;
  objective?: string;
  constraints?: string[];
  plan?: PlanItem[];
  sourcePlan?: SourcePlanReference;
}

export interface CheckpointInput {
  baseRevision: number;
  planItemStatuses?: Record<string, PlanItemStatus>;
  progress: string;
  files?: RelevantFile[];
  decisions?: string[];
  blockers?: string[];
  nextAction: string;
  status?: TaskStatus;
  session?: SessionReference;
}

export interface CompleteTaskInput {
  baseRevision: number;
  force?: boolean;
  reason?: string;
  session?: SessionReference;
}

export class TaskStore {
  readonly paths: OhMyTaskPaths;
  private readonly now: () => Date;

  constructor(private readonly options: TaskStoreOptions) {
    this.paths = options.paths ?? getOhMyTaskPaths();
    this.now = options.now ?? (() => new Date());
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(this.paths.root, { recursive: true }),
      mkdir(this.paths.tasks, { recursive: true }),
      mkdir(this.paths.locks, { recursive: true }),
      mkdir(this.paths.recovery, { recursive: true }),
    ]);
  }

  async create(input: CreateTaskInput): Promise<TaskDocument> {
    await this.initialize();
    const id = input.id ?? createTaskId(input.title, { now: this.now() });
    validateTaskId(id);
    const path = this.taskPath(id);
    return withFileLock(this.lockPath(id), this.options.lock, async () => {
      if (await exists(path)) throw new TaskAlreadyExistsError(id);
      const timestamp = this.now().toISOString();
      const metadata: TaskMetadata = {
        schemaVersion: TASK_SCHEMA_VERSION,
        id,
        title: input.title.trim(),
        status: "planned",
        revision: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        project: { name: input.projectName.trim() },
        ...(input.sourcePlan ? { sourcePlan: input.sourcePlan } : {}),
      };
      const document: TaskDocument = {
        metadata,
        body: createTaskBody(metadata.title, input.objective?.trim() ?? "", input.plan ?? [], input.constraints ?? []),
      };
      const serialized = serializeTaskDocument(document);
      await atomicWriteFile(path, serialized, { recoveryDir: this.paths.recovery });
      return parseTaskDocument(serialized);
    });
  }

  async read(id: string): Promise<TaskDocument> {
    validateTaskId(id);
    try { return parseTaskDocument(await readFile(this.taskPath(id), "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new TaskNotFoundError(id);
      throw error;
    }
  }

  async list(): Promise<TaskDocument[]> {
    await this.initialize();
    const files = (await readdir(this.paths.tasks)).filter((name) => name.endsWith(".md")).sort();
    return Promise.all(files.map((name) => this.read(name.slice(0, -3))));
  }

  async associate(id: string, baseRevision: number, session: SessionReference): Promise<TaskDocument> {
    return this.mutate(id, baseRevision, (document) => {
      document.metadata.latestSession = session;
      document.body = addSession(document.body, session);
    });
  }

  async checkpoint(id: string, input: CheckpointInput): Promise<TaskDocument> {
    if (!input.progress.trim()) throw new ValidationError("Checkpoint is invalid.", [{ path: "progress", message: "must not be empty" }]);
    if (!input.nextAction.trim()) throw new ValidationError("Checkpoint is invalid.", [{ path: "nextAction", message: "must not be empty" }]);
    return this.mutate(id, input.baseRevision, (document) => {
      const changes = input.planItemStatuses ?? {};
      document.body = updatePlanItems(document.body, changes);
      const completed = Object.entries(changes).filter(([, status]) => status === "completed").map(([itemId]) => itemId);
      const affected = Object.keys(changes);
      const files = input.files ?? [];
      const decisions = input.decisions ?? [];
      const blockers = input.blockers ?? [];
      const status = input.status ?? (blockers.length ? "blocked" : "in-progress");
      document.body = updateCurrentState(document.body, {
        progress: input.progress.trim(), nextAction: input.nextAction.trim(), decisions, blockers, files,
      });
      document.body = appendCheckpoint(document.body, {
        number: countCheckpoints(document.body) + 1,
        createdAt: this.now().toISOString(),
        planItemIds: affected,
        completedPlanItemIds: completed,
        progress: input.progress.trim(),
        nextAction: input.nextAction.trim(),
        decisions,
        blockers,
        files,
        status,
        ...(input.session ? { session: input.session } : {}),
      });
      document.metadata.status = status;
      document.metadata.progressSummary = input.progress.trim();
      document.metadata.nextAction = input.nextAction.trim();
      const active = Object.entries(changes).find(([, itemStatus]) => itemStatus === "in-progress" || itemStatus === "blocked")?.[0];
      if (active) document.metadata.activePlanItem = active;
      if (input.session) {
        document.metadata.latestSession = input.session;
        document.body = addSession(document.body, input.session);
      }
    });
  }

  async complete(id: string, input: CompleteTaskInput): Promise<TaskDocument> {
    return this.mutate(id, input.baseRevision, (document) => {
      if (hasIncompletePlanItems(document.body) && !input.force) throw new IncompletePlanError(id);
      if (input.force && !input.reason?.trim()) {
        throw new ValidationError("Force completion is invalid.", [{ path: "reason", message: "is required when force is true" }]);
      }
      const reason = input.force ? `Force-completed: ${input.reason!.trim()}` : "All implementation plan items are complete.";
      document.metadata.status = "completed";
      document.metadata.progressSummary = reason;
      document.metadata.nextAction = "No further action; task is complete.";
      delete document.metadata.activePlanItem;
      document.body = updateCurrentState(document.body, {
        progress: reason,
        nextAction: "No further action; task is complete.",
        decisions: input.force ? [input.reason!.trim()] : [], blockers: [], files: [],
      });
      document.body = appendCheckpoint(document.body, {
        number: countCheckpoints(document.body) + 1,
        createdAt: this.now().toISOString(), planItemIds: [], completedPlanItemIds: [],
        progress: reason, nextAction: "No further action; task is complete.",
        decisions: input.force ? [input.reason!.trim()] : [], blockers: [], files: [], status: "completed",
        ...(input.session ? { session: input.session } : {}),
      });
      if (input.session) document.metadata.latestSession = input.session;
    });
  }

  async archive(id: string, baseRevision: number): Promise<TaskDocument> {
    return this.mutate(id, baseRevision, (document) => { document.metadata.status = "archived"; });
  }

  async mutate(id: string, baseRevision: number, change: (document: TaskDocument) => void | Promise<void>): Promise<TaskDocument> {
    await this.initialize();
    return withFileLock(this.lockPath(id), this.options.lock, async () => {
      const document = await this.read(id);
      if (document.metadata.revision !== baseRevision) {
        throw new StaleRevisionError(id, baseRevision, document.metadata.revision);
      }
      await change(document);
      document.metadata.revision += 1;
      document.metadata.updatedAt = this.now().toISOString();
      const serialized = serializeTaskDocument(document);
      await atomicWriteFile(this.taskPath(id), serialized, { recoveryDir: this.paths.recovery });
      return parseTaskDocument(serialized);
    });
  }

  private taskPath(id: string): string { return join(this.paths.tasks, `${id}.md`); }
  private lockPath(id: string): string { return join(this.paths.locks, `${id}.lock`); }
}

function validateTaskId(id: string): void {
  if (!/^omt-\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new ValidationError("Task ID is invalid.", [{ path: "id", message: "must be a valid omt task ID" }]);
  }
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
