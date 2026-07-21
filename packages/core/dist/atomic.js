import { copyFile, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
export async function atomicWriteFile(path, content, options = {}) {
    const directory = dirname(path);
    await mkdir(directory, { recursive: true });
    const temporaryPath = join(directory, `.${basename(path)}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`);
    const handle = await open(temporaryPath, "wx", options.mode ?? 0o600);
    try {
        await handle.writeFile(content, "utf8");
        await handle.sync();
    }
    finally {
        await handle.close();
    }
    try {
        await options.beforeReplace?.(temporaryPath);
        await rename(temporaryPath, path);
    }
    catch (error) {
        if (options.recoveryDir) {
            await mkdir(options.recoveryDir, { recursive: true });
            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            const recoveryPath = join(options.recoveryDir, `${basename(path)}.${stamp}.recovery`);
            try {
                await copyFile(temporaryPath, recoveryPath);
            }
            catch {
                const data = await readFile(temporaryPath).catch(() => undefined);
                if (data) {
                    const recovery = await open(recoveryPath, "wx", 0o600);
                    try {
                        await recovery.writeFile(data);
                    }
                    finally {
                        await recovery.close();
                    }
                }
            }
        }
        throw error;
    }
    finally {
        await rm(temporaryPath, { force: true });
    }
}
//# sourceMappingURL=atomic.js.map