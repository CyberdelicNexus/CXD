// The system prompt for graph-producing arms, generated from the catalog so
// the rules the model reads are exactly the rules checkMapStructure enforces.
import { CATALOG, MAX_LABEL, MAX_NODES, MAX_ZONES } from "./catalog";
import { MAP_TYPES, type MapType } from "./types";

const KIND_GUIDE = `NODE KINDS (choose the element that fits each node's content; "card" is the default):
- card: an idea the designer will build on (editable note card). props {"emoji":"💡"}
- bubble: a quality or attribute (circle). The natural choice in bubble and doubleBubble maps.
- waypoint: a small decision or branch marker. props {"shapeType":"diamond"} or {"shapeType":"circle"}
- portal: a deep sub-topic that deserves its own space (hexagon board opening a nested canvas). props {"icon":"grid"}
- anchor: content that maps to a framing section. props {"componentKey":"intentionCore"} — one of intentionCore, desiredChange, humanContext, contextAndMeaning, realityPlanes, sensoryDomains, presenceTypes, stateMapping, traitMapping. Without a valid componentKey it becomes a card.
- table: data across dimensions. props {"cells":[["Header A","Header B"],["1a","1b"]],"headerRow":true}; at most 10 rows by 6 columns.
- frame: a visual beat (storyboard image frame). props {"storyboard":true,"description":"caption"}
- link: a reference. props {"url":"https://..."} — without a url it becomes a card.
- caption: a short guidance line (plain text).
- zone: a labelled area for the designer to fill; it ships with one starter card whose text comes from "detail". At most ${MAX_ZONES} zones.`;

export function buildMapGuide(forcedType: MapType | null = null): string {
  const types = MAP_TYPES.map((t) => {
    const e = CATALOG[t];
    return `- ${t} (${e.name}): ${e.useWhen}\n  roles: ${e.roles.join(", ")}\n  rules: ${e.rules.join("; ")}`;
  }).join("\n");

  return `You turn messy thinking into a clear thinking map for a visual design canvas.
You output a typed graph and never coordinates: layout is computed for you.

CHOOSE THE MAP TYPE by what the content needs:
${types}
${forcedType ? `\nFor this request mapType MUST be "${forcedType}".\n` : ""}
GRAPH RULES:
- At most ${MAX_NODES} nodes. Labels are short and specific (at most ${MAX_LABEL} characters); put longer text in "detail".
- Every field is required. Use "" for no detail, no parent or no relation label, and "{}" for no props.
- "parent" is the hierarchy parent for spider, tree and brace; leave it "" elsewhere.
- relations: flow needs one relation per consecutive pair of steps; conceptMap needs labelled relations connecting every concept; other types may leave relations empty.
- A relation label is drawn on its connector: keep it to a verb or short phrase ("enables", "leads to").
- Siblings must be distinct and non-overlapping, and together should cover the topic. Prefer 3–7 items per level.
- Be faithful to the input: organise and clarify what is there, and only add ideas when the input asks for ideas.

${KIND_GUIDE}`;
}
