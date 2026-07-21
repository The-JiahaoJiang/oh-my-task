import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { atomicWriteFile } from "./atomic.js";
import { withFileLock, type AcquireLockOptions } from "./lock.js";
import type { OhMyTaskPaths } from "./paths.js";
import { validateProjectName } from "./project.js";

interface ProjectLinksFile {
  schemaVersion: 1;
  links: Record<string, string>;
}

export class ProjectLinkStore {
  constructor(private readonly paths: OhMyTaskPaths, private readonly lock: AcquireLockOptions) {}

  async get(cwd: string): Promise<string | undefined> {
    return (await this.read()).links[workspaceKey(cwd)];
  }

  async set(cwd: string, projectName: string): Promise<void> {
    const name = validateProjectName(projectName);
    await withFileLock(`${this.paths.locks}/project-links.lock`, this.lock, async () => {
      const data = await this.read();
      data.links[workspaceKey(cwd)] = name;
      await atomicWriteFile(this.paths.projectLinks, `${JSON.stringify(data, null, 2)}\n`, {
        recoveryDir: this.paths.recovery,
      });
    });
  }

  async remove(cwd: string): Promise<void> {
    await withFileLock(`${this.paths.locks}/project-links.lock`, this.lock, async () => {
      const data = await this.read();
      delete data.links[workspaceKey(cwd)];
      await atomicWriteFile(this.paths.projectLinks, `${JSON.stringify(data, null, 2)}\n`, {
        recoveryDir: this.paths.recovery,
      });
    });
  }

  private async read(): Promise<ProjectLinksFile> {
    try {
      const value = JSON.parse(await readFile(this.paths.projectLinks, "utf8")) as Partial<ProjectLinksFile>;
      if (value.schemaVersion !== 1 || !value.links || typeof value.links !== "object" || Array.isArray(value.links)) {
        throw new Error(`Invalid project links file: ${this.paths.projectLinks}`);
      }
      const links: Record<string, string> = {};
      for (const [key, name] of Object.entries(value.links)) {
        if (typeof name !== "string") throw new Error(`Invalid project link for ${key}`);
        links[key] = validateProjectName(name);
      }
      return { schemaVersion: 1, links };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, links: {} };
      throw error;
    }
  }
}

export function workspaceKey(cwd: string): string {
  const canonical = resolve(cwd).replace(/\\/g, "/").replace(/\/$/, "");
  return process.platform === "win32" ? canonical.toLowerCase() : canonical;
}
