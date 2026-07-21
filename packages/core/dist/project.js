import { basename, resolve } from "node:path";
export function suggestProjectName(cwd) {
    const name = basename(resolve(cwd)).trim();
    if (!name)
        throw new TypeError("Cannot suggest a project name from an empty working directory.");
    return name;
}
export function validateProjectName(name) {
    const normalized = name.trim();
    if (!normalized)
        throw new TypeError("Project name cannot be empty.");
    if (normalized.length > 120)
        throw new TypeError("Project name must be 120 characters or fewer.");
    if (/[\r\n\0]/.test(normalized))
        throw new TypeError("Project name cannot contain line breaks or null bytes.");
    return normalized;
}
//# sourceMappingURL=project.js.map