import { parseDocument, stringify } from "yaml";
import { ValidationError } from "./errors.js";
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
  const document = parseDocument(yamlSource, { prettyErrors: true, strict: true });
  if (document.errors.length) {
    throw new ValidationError("Task frontmatter contains invalid YAML.", document.errors.map((error) => ({
      path: "frontmatter",
      message: error.message,
    })));
  }

  return {
    metadata: migrateTaskMetadata(document.toJS()),
    body: input.slice(match[0].length),
  };
}

export function serializeTaskDocument(document: TaskDocument): string {
  const metadata = migrateTaskMetadata(document.metadata);
  const yaml = stringify(metadata, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n${document.body}`;
}

export function updateTaskMetadata(input: string, metadata: TaskMetadata): string {
  const current = parseTaskDocument(input);
  return serializeTaskDocument({ metadata, body: current.body });
}
