import { type AcquireLockOptions } from "./lock.js";
import { type OhMyTaskPaths } from "./paths.js";
import { type PlanItem, type PlanItemStatus, type RelevantFile, type SessionReference, type SourcePlanReference, type TaskDocument, type TaskStatus } from "./types.js";
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
export declare class TaskStore {
    private readonly options;
    readonly paths: OhMyTaskPaths;
    private readonly now;
    constructor(options: TaskStoreOptions);
    initialize(): Promise<void>;
    create(input: CreateTaskInput): Promise<TaskDocument>;
    read(id: string): Promise<TaskDocument>;
    list(): Promise<TaskDocument[]>;
    associate(id: string, baseRevision: number, session: SessionReference): Promise<TaskDocument>;
    checkpoint(id: string, input: CheckpointInput): Promise<TaskDocument>;
    complete(id: string, input: CompleteTaskInput): Promise<TaskDocument>;
    archive(id: string, baseRevision: number): Promise<TaskDocument>;
    mutate(id: string, baseRevision: number, change: (document: TaskDocument) => void | Promise<void>): Promise<TaskDocument>;
    private taskPath;
    private lockPath;
}
//# sourceMappingURL=task-store.d.ts.map