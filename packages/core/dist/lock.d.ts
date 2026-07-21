import type { LockConfig } from "./types.js";
export interface LockOwner {
    pid: number;
    hostname: string;
    agent?: string;
    sessionId?: string;
    createdAt: string;
}
export declare class LockBusyError extends Error {
    readonly lockPath: string;
    readonly owner?: LockOwner | undefined;
    readonly code = "LOCK_BUSY";
    constructor(lockPath: string, owner?: LockOwner | undefined);
}
export interface AcquireLockOptions {
    config: LockConfig;
    agent?: string;
    sessionId?: string;
    now?: () => Date;
    sleep?: (milliseconds: number) => Promise<void>;
}
export interface FileLock {
    path: string;
    owner: LockOwner;
    release(): Promise<void>;
}
export declare function acquireFileLock(lockPath: string, options: AcquireLockOptions): Promise<FileLock>;
export declare function withFileLock<T>(lockPath: string, options: AcquireLockOptions, operation: () => Promise<T>): Promise<T>;
//# sourceMappingURL=lock.d.ts.map