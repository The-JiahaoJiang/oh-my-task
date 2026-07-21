import { randomBytes } from "node:crypto";

export interface TaskIdOptions {
  now?: Date;
  suffix?: string;
}

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || "task";
}

export function createTaskId(title: string, options: TaskIdOptions = {}): string {
  const now = options.now ?? new Date();
  if (Number.isNaN(now.getTime())) throw new TypeError("Cannot create task ID from an invalid date.");
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = options.suffix ?? randomBytes(3).toString("hex");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(suffix)) {
    throw new TypeError("Task ID suffix must contain lowercase letters, numbers, or single hyphens.");
  }
  return `omt-${date}-${slugify(title).slice(0, 48)}-${suffix}`;
}
