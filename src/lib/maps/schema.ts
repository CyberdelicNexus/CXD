// zod schema for model output. Every field is required, with sentinels for
// "absent" ("", "{}" and []), because Anthropic's grammar compiler rejects
// schemas with many optional fields inside array elements. New fields are
// enums (JSON Schema "enum", never anyOf), so the union budget stays at zero.
// No array bounds, no nullable (both are Anthropic structured-output limits).
import { z } from "zod";
import {
  EMPHASES, MAP_ROLES, MAP_TYPES, NODE_KINDS, NODE_TINTS,
  RELATION_DIRECTIONS, RELATION_STYLES, RELATION_WEIGHTS, TINTS,
} from "./types";

export const mapNodeSchema = z.object({
  id: z.string().describe('Short unique ref, e.g. "n1"'),
  label: z.string().describe("Short label, at most 60 characters"),
  detail: z.string().describe('Body text shown on cards; "" when none'),
  role: z.enum(MAP_ROLES).describe("The node's structural role for this mapType"),
  kind: z.enum(NODE_KINDS).describe("Which canvas element renders this node"),
  parent: z.string().describe('id of the parent node in hierarchical maps; "" for roots'),
  props: z.string().describe('JSON object string of extras for this kind; "{}" when none'),
  tint: z.enum(NODE_TINTS).describe('A colour whose meaning is in the legend; "" when colour means nothing here'),
  emphasis: z.enum(EMPHASES).describe('"strong" for the one or two nodes that matter most (drawn larger); "normal" otherwise'),
});

export const mapRelationSchema = z.object({
  from: z.string().describe("id of the source node"),
  to: z.string().describe("id of the target node"),
  label: z.string().describe('Relationship wording; "" when none (required in conceptMap)'),
  style: z.enum(RELATION_STYLES).describe('"dashed" for uncertain or proposed, "dotted" for weak or indirect, "solid" otherwise'),
  weight: z.enum(RELATION_WEIGHTS).describe('"strong" for the main path or a key dependency; "normal" otherwise'),
  direction: z.enum(RELATION_DIRECTIONS).describe('"forward" points from -> to, "both" is mutual, "none" is a plain association'),
});

export const legendEntrySchema = z.object({
  tint: z.enum(TINTS),
  meaning: z.string().describe("What this colour means, at most 30 characters"),
});

export const mapGraphSchema = z.object({
  mapType: z.enum(MAP_TYPES),
  title: z.string().describe("Short title for the whole map"),
  legend: z.array(legendEntrySchema).describe("One entry per tint used on a node; [] when colour carries no meaning"),
  nodes: z.array(mapNodeSchema),
  relations: z.array(mapRelationSchema),
});
