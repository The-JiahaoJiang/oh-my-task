import type { PlanItem, PlanItemStatus, RelevantFile, SessionReference, TaskStatus } from "./types.js";
export interface CurrentStateContent {
    progress: string;
    nextAction: string;
    decisions: string[];
    blockers: string[];
    files: RelevantFile[];
}
export interface CheckpointBodyContent extends CurrentStateContent {
    number: number;
    createdAt: string;
    planItemIds: string[];
    completedPlanItemIds: string[];
    status: TaskStatus;
    session?: SessionReference;
}
export declare function createTaskBody(title: string, objective: string, plan: PlanItem[], constraints?: string[]): string;
export declare function updatePlanItems(body: string, changes: Readonly<Record<string, PlanItemStatus>>): string;
export declare function updateCurrentState(body: string, state: CurrentStateContent): string;
export declare function appendCheckpoint(body: string, checkpoint: CheckpointBodyContent): string;
export declare function addSession(body: string, session: SessionReference): string;
export declare function countCheckpoints(body: string): number;
export declare function hasIncompletePlanItems(body: string): boolean;
export declare function replaceSection(body: string, heading: string, content: string): string;
export declare function getSection(body: string, heading: string): string;
//# sourceMappingURL=task-body.d.ts.map