export interface OhMyTaskPaths {
    root: string;
    index: string;
    config: string;
    tasks: string;
    locks: string;
    recovery: string;
}
export interface PathOptions {
    env?: NodeJS.ProcessEnv;
    home?: string;
    cwd?: string;
}
export declare function getOhMyTaskPaths(options?: PathOptions): OhMyTaskPaths;
//# sourceMappingURL=paths.d.ts.map