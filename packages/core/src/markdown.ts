import { ValidationError } from "./errors.js";
import { parseFrontmatterYaml, stringifyFrontmatterYaml } from "./yaml.js";
import { migrateTaskMetadata } from "./migrations.js";
import type { TaskDocument, TaskMetadata } from "./types.js";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export function parseTaskDocument(input: string): TaskDocument {
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

export function serializeTaskDocument(document: TaskDocument): string {
  const metadata = migrateTaskMetadata(document.metadata);
  const yaml = stringifyFrontmatterYaml(metadata).trimEnd();
  return `---\n${yaml}\n---\n${document.body}`;
}

export function updateTaskMetadata(input: string, metadata: TaskMetadata): string {
  const current = parseTaskDocument(input);
  return serializeTaskDocument({ metadata, body: current.body });
}
