// The example library's data model (spec §4.1).
import type { LegacyMapGraph } from "../legacy";
import type { MapGraph, MapType, NodeKind } from "../types";
import type { PairingId } from "./pairings";

export const EXEMPLAR_INPUT_TYPES = ["brainDump", "canvasCards", "topic", "comparison"] as const;
export type ExemplarInputType = (typeof EXEMPLAR_INPUT_TYPES)[number];

export interface ExemplarInput {
  type: ExemplarInputType;
  title: string;
  text: string;
  cards: { title: string; body: string }[];
}

/** Derived from the graph and input (never hand-written), plus free-form labels a person may add. */
export interface ExemplarTags {
  mapType: MapType;
  inputType: ExemplarInputType;
  kinds: NodeKind[];
  pairings: PairingId[];
  labels: string[];
}

export interface ExemplarProvenance {
  source: "authored" | "promoted";
  promptVersion?: string;
  modelId?: string;
  promotedAt?: string;
  cellId?: string;
  /** The corpus input a promoted example came from: exempt from its own corpus-similarity check. */
  inputId?: string;
}

export interface Exemplar {
  id: string;
  title: string;
  /** One line: why this is a good example. */
  note: string;
  input: ExemplarInput;
  graph: MapGraph;
  tags: ExemplarTags;
  provenance: ExemplarProvenance;
}

/** What an authored file declares; tags and provenance are added on load. */
export interface AuthoredExemplar {
  id: string;
  title: string;
  note: string;
  input: ExemplarInput;
  graph: MapGraph;
  labels: string[];
}

/** One promoted/<id>.json file. The graph may predate a later schema change, so it is read with upgradeGraph. */
export interface PromotedExemplarFile {
  id: string;
  title: string;
  note: string;
  input: ExemplarInput;
  graph: LegacyMapGraph;
  labels: string[];
  provenance: ExemplarProvenance & { source: "promoted" };
}
