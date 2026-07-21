import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  atomicWriteFile,
  validateProjectName,
  withFileLock,
  type AcquireLockOptions,
  type OhMyTaskPaths,
} from "oh-my-task-cli";

interface ProjectLinksFile {
  schemaVersion: 1;
  links: Record<string, string>;
}

/**
 * Extension-local project links implementation.
 *
 * Keep this outside the core package export surface so Pi /reload does not
 * depend on a newly installed core constructor that may still be cached from
 * the previous extension version in the current process.
 */
export class ExtensionProjectLinkStore {
  private readonly file: string;

  constructor(private readonly paths: OhMyTaskPaths, private readonly lock: AcquireLockOptions) {
    this.file = `${paths.root}/project-links.json`;
  }

  async get(cwd: string): Promise<string | undefined> {
    return (await this.read()).links[workspaceKey(cwd)];
  }

  async set(cwd: string, projectName: string): Promise<void> {
    const name = validateProjectName(projectName);
    await withFileLock(`${this.paths.locks}/project-links.lock`, this.lock, async () => {
      const data = await this.read();
      data.links[workspaceKey(cwd)] = name;
      await atomicWriteFile(this.file, `${JSON.stringify(data, null, 2)}\n`, { recoveryDir: this.paths.recovery });
    });
  }

  async remove(cwd: string): Promise<void> {
    await withFileLock(`${this.paths.locks}/project-links.lock`, this.lock, async () => {
      const data = await this.read();
      delete data.links[workspaceKey(cwd)];
      await atomicWriteFile(this.file, `${JSON.stringify(data, null, 2)}\n`, { recoveryDir: this.paths.recovery });
    });
  }

  private async read(): Promise<ProjectLinksFile> {
    try {
      const value = JSON.parse(await readFile(this.file, "utf8")) as Partial<ProjectLinksFile>;
      if (value.schemaVersion !== 1 || !value.links || typeof value.links !== "object" || Array.isArray(value.links)) {
        throw new Error(`Invalid project links file: ${this.file}`);
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
