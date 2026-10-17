// Audits a zod schema against Anthropic structured-output limits, as JSON
// Schema. Every limit here was hit for real: minItems/maxItems are rejected,
// union-typed params are capped at 16, optional params at 24.
import { z } from "zod";

interface Node {
  type?: string;
  anyOf?: unknown[];
  oneOf?: unknown[];
  properties?: Record<string, Node>;
  required?: string[];
  items?: Node;
  maxItems?: number;
  minItems?: number;
  enum?: unknown[];
}

export interface SchemaAudit {
  arrayBounds: number;
  unions: number;
  optionals: number;
  /** Enums with an empty string as a member: Gemini's structured output rejects those outright. */
  emptyEnumMembers: number;
}

export function auditSchemaForAnthropic(schema: z.ZodTypeAny): SchemaAudit {
  const json = z.toJSONSchema(schema, { io: "input" }) as Node;
  const audit: SchemaAudit = { arrayBounds: 0, unions: 0, optionals: 0, emptyEnumMembers: 0 };
  const walk = (n: Node | undefined): void => {
    if (!n || typeof n !== "object") return;
    if (n.maxItems !== undefined || n.minItems !== undefined) audit.arrayBounds++;
    if (Array.isArray(n.anyOf) || Array.isArray(n.oneOf)) audit.unions++;
    if (Array.isArray(n.enum) && n.enum.some((v) => v === "")) audit.emptyEnumMembers++;
    if (n.properties) {
      const required = new Set(n.required || []);
      audit.optionals += Object.keys(n.properties).filter((k) => !required.has(k)).length;
      Object.values(n.properties).forEach(walk);
    }
    if (n.items) walk(n.items);
    for (const child of [...(n.anyOf || []), ...(n.oneOf || [])]) walk(child as Node);
  };
  walk(json);
  return audit;
}

/** Human-readable problems; empty when the schema is safe for Anthropic. */
export function anthropicSchemaProblems(schema: z.ZodTypeAny): string[] {
  const a = auditSchemaForAnthropic(schema);
  const problems: string[] = [];
  if (a.arrayBounds > 0) problems.push(`${a.arrayBounds} array min/max bound(s) — Anthropic rejects them`);
  if (a.unions > 16) problems.push(`${a.unions} union-typed params — Anthropic allows 16`);
  if (a.optionals > 24) problems.push(`${a.optionals} optional params — Anthropic allows 24`);
  return problems;
}
