import { ValidationError } from "./errors.js";
import { parseFrontmatterYaml, stringifyFrontmatterYaml } from "./yaml.js";
import { migrateTaskMetadata } from "./migrations.js";
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
export function parseTaskDocument(input) {
    const match = FRONTMATTER.exec(input);
    if (!match) {
        throw new ValidationError("Task document is missing YAML frontmatter.", [
            { path: "frontmatter", message: "document must start with a --- delimited YAML block" },
        ]);
    }
    const yamlSource = match[1] ?? "";
    return {
        metadata: migrateTaskMetadata(parseFrontmatterYaml(yamlSource)),
        body: input.slice(match[0].length),
    };
}
export function serializeTaskDocument(document) {
    const metadata = migrateTaskMetadata(document.metadata);
    const yaml = stringifyFrontmatterYaml(metadata).trimEnd();
    return `---\n${yaml}\n---\n${document.body}`;
}
export function updateTaskMetadata(input, metadata) {
    const current = parseTaskDocument(input);
    return serializeTaskDocument({ metadata, body: current.body });
}
//# sourceMappingURL=markdown.js.map