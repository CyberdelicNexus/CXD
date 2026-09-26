// Run: npx tsx src/lib/maps/__verify__/render.verify.ts
// Round trip (spec §8): each MapGraph field reaches the canvas element or edge it promises.
import { BOARD_HEX_COLORS, TINT_COLORS, TINT_GRADIENTS } from "@/lib/ai/element-generation";
import type {
  BoardElement, CanvasElement, ContainerElement, FreeformElement, LineElement, ShapeElement, TableElement, TextElement,
} from "@/types/canvas-elements";
import { checkMapStructure } from "../catalog";
import { HEADING_FONT_PX, NEUTRAL_CARD_BG, readLegend, TINT_ACCENTS, tintOf } from "../element-style";
import { footprint } from "../layouts/shared";
import { renderMap } from "../render";
import type { MapGraph } from "../types";
import { n, r, VALID } from "./fixtures";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};

const radial: MapGraph = {
  mapType: "radial", title: "Round trip",
  legend: [{ tint: "rose", meaning: "Risk" }, { tint: "emerald", meaning: "Opportunity" }],
  relations: [],
  nodes: [
    { ...n("c", "center", "", "shape", '{"shapeType":"star"}', "Goal"), emphasis: "strong" },
    { ...n("t", "branch", "", "task", '{"owner":"Sam"}', "Call the venue"), detail: "Before Friday" },
    { ...n("r", "branch", "", "card", "{}", "Risky card"), tint: "rose" },
    { ...n("p", "branch", "", "portal", '{"icon":"grid"}', "Deep dive"), tint: "emerald" },
    { ...n("z", "branch", "", "zone", "{}", "Fill me"), tint: "rose" },
    { ...n("s", "branch", "", "shape", '{"shapeType":"triangle"}', "Stage"), tint: "emerald" },
    { ...n("tb", "branch", "", "table", '{"cells":[["A","B"],["1","2"]]}', "Numbers"), tint: "rose" },
    n("pl", "branch", "", "card", "{}", "Plain card"),
  ],
};
check(`round-trip graph is valid (${checkMapStructure(radial).join("; ")})`, checkMapStructure(radial).length === 0);
const out = renderMap(radial);
const els = out.elements;
const find = <T extends CanvasElement>(pred: (e: CanvasElement) => boolean) => els.find(pred) as T | undefined;

const star = find<ShapeElement>((e) => e.type === "shape" && e.content === "Goal");
check("star shape keeps shapeType star", star?.shapeType === "star");
check("strong emphasis: the star is drawn at 1.25x (200x200, not 160x160)", star?.width === 200 && star?.height === 200);
const card = n("x", "branch");
check("strong emphasis grows the footprint by about 25%",
  footprint({ ...card, emphasis: "strong" }).w === 340 && footprint({ ...card, emphasis: "strong" }).h === 380);

const task = find<FreeformElement>((e) => e.type === "freeform" && e.cardType === "task");
check("task node becomes a task card titled by its label", task?.content === "Call the venue");
check("task owner and detail reach the task metadata",
  task?.taskMetadata?.assignee === "Sam" && task?.taskMetadata?.description === "Before Friday" && task?.taskMetadata?.isActionable === true);

const risky = find<FreeformElement>((e) => e.type === "freeform" && e.noteTitle === "Risky card");
check("tint reaches the card gradient", risky?.style?.bgColor === TINT_GRADIENTS.rose && tintOf(risky!) === "rose");
const portal = find<BoardElement>((e) => e.type === "board");
check("tint reaches the board hex", portal?.hexColor === BOARD_HEX_COLORS.emerald && tintOf(portal!) === "emerald");
const zone = find<ContainerElement>((e) => e.type === "container");
check("tint reaches the container tint", zone?.tintColor === "rose");
const tri = find<ShapeElement>((e) => e.type === "shape" && e.content === "Stage");
check("tint reaches the shape accent", tri?.style?.borderColor === TINT_ACCENTS.emerald && tintOf(tri!) === "emerald");
const table = find<TableElement>((e) => e.type === "table");
check("tint reaches the table border", table?.lineColor === TINT_ACCENTS.rose && tintOf(table!) === "rose");
const plain = find<FreeformElement>((e) => e.type === "freeform" && e.noteTitle === "Plain card");
check("with a legend, an untinted card is neutral", plain?.style?.bgColor === NEUTRAL_CARD_BG && tintOf(plain!) === null);

const legend = readLegend(els);
check(`legend renders one swatch and label per entry (${legend.map((l) => `${l.tint}:${l.meaning}`).join(",")})`,
  legend.map((l) => `${l.tint}:${l.meaning}`).join(",") === "rose:Risk,emerald:Opportunity");
const title = find<TextElement>((e) => e.type === "text" && e.content === "Round trip")!;
const legendIds = new Set(legend.flatMap((l) => [l.swatchId, l.labelId]));
const mapTop = Math.min(...els.filter((e) => e.type !== "line" && e.id !== title.id && !legendIds.has(e.id)).map((e) => e.y));
const legendEls = els.filter((e) => legendIds.has(e.id));
check("legend sits under the title and above the map",
  legendEls.length === 4 && legendEls.every((e) => e.y >= title.y + title.height && e.y + e.height <= mapTop));

const tree: MapGraph = {
  mapType: "tree", title: "Heading check", legend: [], relations: [],
  nodes: [n("r", "root", "", "card", "{}", "Root"), n("h", "branch", "r", "heading", "{}", "Region A"), n("c", "leaf", "h", "card", "{}", "Inside A")],
};
check("heading graph is valid", checkMapStructure(tree).length === 0);
const heading = renderMap(tree).elements.find((e) => e.type === "text" && e.content === "Region A") as TextElement | undefined;
check("heading renders at heading size", heading?.style?.fontSize === HEADING_FONT_PX && heading?.style?.fontWeight === "semibold");

const noLegend = renderMap(VALID.radial).elements.filter((e): e is FreeformElement => e.type === "freeform");
check("without a legend, untinted cards keep the engine's rotation",
  noLegend.length > 0 && noLegend.every((e) => TINT_COLORS.some((t) => TINT_GRADIENTS[t] === e.style?.bgColor)));
check("without a legend, no swatches are drawn", readLegend(renderMap(VALID.radial).elements).length === 0);

// ── Relations (spec §3.3) ────────────────────────────────────────────
const concept: MapGraph = {
  mapType: "conceptMap", title: "Relations", legend: [{ tint: "sunset", meaning: "Ours" }],
  nodes: [{ ...n("a", "concept", "", "card", "{}", "Studio"), tint: "sunset" }, n("b", "concept", "", "card", "{}", "Members"),
    n("c", "concept", "", "card", "{}", "Partners"), n("d", "concept", "", "card", "{}", "Council")],
  relations: [
    { ...r("a", "b", "serves"), weight: "strong" },
    { ...r("b", "c", "maybe feeds"), style: "dashed" },
    { ...r("c", "d", "loosely tied"), style: "dotted", direction: "none" },
    { ...r("d", "a", "trade"), direction: "both" },
  ],
};
check("relation graph is valid", checkMapStructure(concept).length === 0);
const cm = renderMap(concept);
const edge = (label: string) => cm.edges.find((e) => e.label?.text === label);
check("strong relation -> thickness 4", edge("serves")?.style?.thickness === 4);
check("forward relation -> arrowStyle end", edge("serves")?.style?.arrowStyle === "end");
check("edge colour is the source node's tint", edge("serves")?.style?.gradientName === "sunset");
check("dashed relation -> lineStyle dashed", edge("maybe feeds")?.style?.lineStyle === "dashed");
check("dotted relation -> lineStyle dotted", edge("loosely tied")?.style?.lineStyle === "dotted");
check("direction none -> arrowStyle none", edge("loosely tied")?.style?.arrowStyle === "none");
check("direction both -> arrowStyle both", edge("trade")?.style?.arrowStyle === "both");
check("normal relation -> thickness 2", edge("maybe feeds")?.style?.thickness === 2);
check("no connector carries a bend", cm.edges.every((e) => e.bend === undefined));

const reversed: MapGraph = {
  mapType: "tree", title: "Reversed", legend: [],
  nodes: [n("root", "root"), n("kid", "branch", "root"), n("kid2", "branch", "root")],
  relations: [r("kid", "root", "part of")],
};
const rev = renderMap(reversed).edges.find((e) => e.label?.text === "part of");
check("a relation drawn against its engine edge points back: arrowStyle start", rev?.style?.arrowStyle === "start");
check("an edge with no relation keeps the engine default (tree: none)",
  renderMap(reversed).edges.some((e) => !e.label && e.style?.arrowStyle === "none"));

const looped: MapGraph = {
  mapType: "flow", title: "Loop", legend: [],
  nodes: [n("s1", "step"), n("s2", "step"), n("s3", "step")],
  relations: [r("s1", "s2"), r("s2", "s3"), { ...r("s3", "s1", "again"), style: "dotted", weight: "strong" }],
};
const loopLine = renderMap(looped).elements.find((e): e is LineElement => e.type === "line" && e.style?.endCap === "arrow");
check("the loop-back line takes the relation's style and weight",
  loopLine?.style?.kind === "dotted" && loopLine?.style?.widthPx === 4 && !!loopLine?.bend);

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
