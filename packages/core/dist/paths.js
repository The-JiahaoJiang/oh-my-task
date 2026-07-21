import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
export function getOhMyTaskPaths(options = {}) {
    const env = options.env ?? process.env;
    const home = options.home ?? homedir();
    const cwd = options.cwd ?? process.cwd();
    const configured = env.OH_MY_TASK_HOME?.trim();
    const expanded = configured?.startsWith("~/") || configured?.startsWith("~\\")
        ? join(home, configured.slice(2))
        : configured;
    const root = expanded
        ? (isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded))
        : join(home, ".oh-my-task");
    return {
        root,
        index: join(root, "oh-my-task.md"),
        config: join(root, "config.json"),
        tasks: join(root, "tasks"),
        locks: join(root, "locks"),
        recovery: join(root, "recovery"),
    };
}
//# sourceMappingURL=paths.js.map