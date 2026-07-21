import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseTaskDocument,
  serializeTaskDocument,
  UnsupportedSchemaVersionError,
  ValidationError,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "task.md");

test("valid task document round-trips without semantic loss", async () => {
  const source = await readFile(fixturePath, "utf8");
  const first = parseTaskDocument(source);
  const rendered = serializeTaskDocument(first);
  const second = parseTaskDocument(rendered);

  assert.deepEqual(second.metadata, first.metadata);
  assert.equal(second.body, first.body);
  assert.match(rendered, /Human formatting and comments must survive/);
});

test("invalid task fields produce actionable paths", () => {
  const source = `---\nschemaVersion: 1\nid: bad\ntitle: ''\nstatus: unknown\nrevision: -1\nproject: {}\n---\n# Body\n`;

  assert.throws(
    () => parseTaskDocument(source),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.match(error.message, /id:/);
      assert.match(error.message, /title:/);
      assert.match(error.message, /status:/);
      assert.match(error.message, /createdAt:/);
      assert.match(error.message, /project.name:/);
      return true;
    },
  );
});

test("malformed YAML is distinguished from schema validation", () => {
  assert.throws(
    () => parseTaskDocument("---\ntitle: [unterminated\n---\nbody"),
    (error: unknown) => error instanceof ValidationError && /invalid YAML/.test(error.message),
  );
});

test("future schema versions fail with upgrade guidance", async () => {
  const source = (await readFile(fixturePath, "utf8")).replace("schemaVersion: 1", "schemaVersion: 99");
  assert.throws(
    () => parseTaskDocument(source),
    (error: unknown) => error instanceof UnsupportedSchemaVersionError && /Upgrade/.test(error.message),
  );
});
