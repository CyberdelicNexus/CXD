// zod schema for model output. Every field is required, with sentinels for
// "absent" ("" and "{}"), because Anthropic's grammar compiler rejects schemas
// with many optional fields inside array elements. No array bounds, no
// nullable (both are Anthropic structured-output limits).
import { z } from "zod";
import { MAP_TYPES, MAP_ROLES, NODE_KINDS } from "./types";

export const mapNodeSchema = z.object({
  id: z.string().describe('Short unique ref, e.g. "n1"'),
  label: z.string().describe("Short label, at most 60 characters"),
  detail: z.string().describe('Body text shown on cards; "" when none'),
  role: z.enum(MAP_ROLES).describe("The node's structural role for this mapType"),
  kind: z.enum(NODE_KINDS).describe("Which canvas element renders this node"),
  parent: z.string().describe('id of the parent node in hierarchical maps; "" for roots'),
  props: z.string().describe('JSON object string of extras for this kind; "{}" when none'),
});

export const mapRelationSchema = z.object({
  from: z.string().describe("id of the source node"),
  to: z.string().describe("id of the target node"),
  label: z.string().describe('Relationship wording; "" when none (required in conceptMap)'),
});

export const mapGraphSchema = z.object({
  mapType: z.enum(MAP_TYPES),
  title: z.string().describe("Short title for the whole map"),
  nodes: z.array(mapNodeSchema),
  relations: z.array(mapRelationSchema),
});
