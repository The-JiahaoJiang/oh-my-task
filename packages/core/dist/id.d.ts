export interface TaskIdOptions {
    now?: Date;
    suffix?: string;
}
export declare function slugify(value: string): string;
export declare function createTaskId(title: string, options?: TaskIdOptions): string;
//# sourceMappingURL=id.d.ts.map