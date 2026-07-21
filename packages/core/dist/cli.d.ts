#!/usr/bin/env node
export interface CliIo {
    out(value: string): void;
    error(value: string): void;
    cwd: string;
    env: NodeJS.ProcessEnv;
}
export declare function runCli(argv: string[], io?: CliIo): Promise<number>;
//# sourceMappingURL=cli.d.ts.map