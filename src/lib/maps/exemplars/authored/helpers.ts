// Builders for authored exemplars: every field explicit, defaults as the schema's sentinels.
import type { MapNode, MapRelation, MapRole } from "../../types";

export const node = (id: string, role: MapRole, label: string, extra: Partial<MapNode> = {}): MapNode =>
  ({ id, label, detail: "", role, kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal", ...extra });

export const rel = (from: string, to: string, label = "", extra: Partial<MapRelation> = {}): MapRelation =>
  ({ from, to, label, style: "solid", weight: "normal", direction: "forward", ...extra });

export const props = (o: Record<string, unknown>): string => JSON.stringify(o);
