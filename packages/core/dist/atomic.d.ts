export interface AtomicWriteOptions {
    recoveryDir?: string;
    mode?: number;
    /** Test/instrumentation hook invoked after the temp file is durable. */
    beforeReplace?: (temporaryPath: string) => Promise<void>;
}
export declare function atomicWriteFile(path: string, content: string, options?: AtomicWriteOptions): Promise<void>;
//# sourceMappingURL=atomic.d.ts.map