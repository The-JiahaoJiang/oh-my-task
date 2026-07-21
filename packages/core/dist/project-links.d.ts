import { type AcquireLockOptions } from "./lock.js";
import type { OhMyTaskPaths } from "./paths.js";
export declare class ProjectLinkStore {
    private readonly paths;
    private readonly lock;
    constructor(paths: OhMyTaskPaths, lock: AcquireLockOptions);
    get(cwd: string): Promise<string | undefined>;
    set(cwd: string, projectName: string): Promise<void>;
    remove(cwd: string): Promise<void>;
    private read;
}
export declare function workspaceKey(cwd: string): string;
//# sourceMappingURL=project-links.d.ts.map