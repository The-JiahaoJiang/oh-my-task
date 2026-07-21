import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { atomicWriteFile } from "./atomic.js";
import { withFileLock } from "./lock.js";
import { validateProjectName } from "./project.js";
export class ProjectLinkStore {
    paths;
    lock;
    constructor(paths, lock) {
        this.paths = paths;
        this.lock = lock;
    }
    async get(cwd) {
        return (await this.read()).links[workspaceKey(cwd)];
    }
    async set(cwd, projectName) {
        const name = validateProjectName(projectName);
        await withFileLock(`${this.paths.locks}/project-links.lock`, this.lock, async () => {
            const data = await this.read();
            data.links[workspaceKey(cwd)] = name;
            await atomicWriteFile(this.paths.projectLinks, `${JSON.stringify(data, null, 2)}\n`, {
                recoveryDir: this.paths.recovery,
            });
        });
    }
    async remove(cwd) {
        await withFileLock(`${this.paths.locks}/project-links.lock`, this.lock, async () => {
            const data = await this.read();
            delete data.links[workspaceKey(cwd)];
            await atomicWriteFile(this.paths.projectLinks, `${JSON.stringify(data, null, 2)}\n`, {
                recoveryDir: this.paths.recovery,
            });
        });
    }
    async read() {
        try {
            const value = JSON.parse(await readFile(this.paths.projectLinks, "utf8"));
            if (value.schemaVersion !== 1 || !value.links || typeof value.links !== "object" || Array.isArray(value.links)) {
                throw new Error(`Invalid project links file: ${this.paths.projectLinks}`);
            }
            const links = {};
            for (const [key, name] of Object.entries(value.links)) {
                if (typeof name !== "string")
                    throw new Error(`Invalid project link for ${key}`);
                links[key] = validateProjectName(name);
            }
            return { schemaVersion: 1, links };
        }
        catch (error) {
            if (error.code === "ENOENT")
                return { schemaVersion: 1, links: {} };
            throw error;
        }
    }
}
export function workspaceKey(cwd) {
    const canonical = resolve(cwd).replace(/\\/g, "/").replace(/\/$/, "");
    return process.platform === "win32" ? canonical.toLowerCase() : canonical;
}
//# sourceMappingURL=project-links.js.map