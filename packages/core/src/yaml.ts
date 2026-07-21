import { ValidationError } from "./errors.js";

/** Parse the conservative YAML subset used by Oh My Task frontmatter. */
export function parseFrontmatterYaml(source: string): unknown {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; value: Record<string, unknown> }> = [{ indent: -2, value: root }];
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (/\t/.test(line)) throw yamlError(index, "tabs are not allowed; use two-space indentation");
    const indent = line.length - line.trimStart().length;
    if (indent % 2 !== 0) throw yamlError(index, "indentation must use multiples of two spaces");
    const content = line.slice(indent);
    const separator = content.indexOf(":");
    if (separator <= 0) throw yamlError(index, "expected a key followed by ':'");
    const key = content.slice(0, separator).trim();
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) throw yamlError(index, `invalid key: ${key}`);
    while (stack.length > 1 && indent <= stack.at(-1)!.indent) stack.pop();
    const parent = stack.at(-1)!;
    if (indent !== parent.indent + 2) throw yamlError(index, "unexpected indentation level");
    if (Object.hasOwn(parent.value, key)) throw yamlError(index, `duplicate key: ${key}`);
    const raw = content.slice(separator + 1).trim();
    if (!raw) {
      const child: Record<string, unknown> = {};
      parent.value[key] = child;
      stack.push({ indent, value: child });
    } else parent.value[key] = parseScalar(raw, index);
  }
  return root;
}

export function stringifyFrontmatterYaml(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Frontmatter cannot be serialized.", [{ path: "frontmatter", message: "must be an object" }]);
  }
  return renderObject(value as Record<string, unknown>, 0).join("\n");
}

function renderObject(value: Record<string, unknown>, indent: number): string[] {
  const lines: string[] = [];
  for (const [key, item] of Object.entries(value)) {
    const prefix = `${" ".repeat(indent)}${key}:`;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      lines.push(prefix, ...renderObject(item as Record<string, unknown>, indent + 2));
    } else lines.push(`${prefix} ${renderScalar(item)}`);
  }
  return lines;
}

function parseScalar(raw: string, line: number): unknown {
  if (raw.startsWith('"')) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== "string") throw new Error("not a string");
      return parsed;
    } catch { throw yamlError(line, "invalid double-quoted string"); }
  }
  if (raw.startsWith("'")) {
    if (!raw.endsWith("'") || raw.length < 2) throw yamlError(line, "invalid single-quoted string");
    return raw.slice(1, -1).replace(/''/g, "'");
  }
  if (raw === "{}") return {};
  if (/^[\[\]{},&*!|>]/.test(raw)) throw yamlError(line, "unsupported YAML construct in task frontmatter");
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;
  if (/^-?(?:0|[1-9]\d*)$/.test(raw)) return Number(raw);
  return raw;
}

function renderScalar(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  if (value === null) return "null";
  throw new ValidationError("Frontmatter cannot be serialized.", [{ path: "frontmatter", message: `unsupported value: ${String(value)}` }]);
}

function yamlError(line: number, message: string): ValidationError {
  return new ValidationError("Task frontmatter contains invalid YAML.", [{ path: `frontmatter.line${line + 1}`, message }]);
}
