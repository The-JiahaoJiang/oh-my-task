import type { PlanItem, SourcePlanReference } from "./types.js";
export interface ImportedPlan {
    suggestedTitle?: string;
    objective?: string;
    plan: PlanItem[];
    sourcePlan: SourcePlanReference;
}
export declare function importPlanFile(path: string, now?: Date): Promise<ImportedPlan>;
export declare function normalizePlanMarkdown(source: string, path: string, now?: Date): ImportedPlan;
//# sourceMappingURL=plan-import.d.ts.map