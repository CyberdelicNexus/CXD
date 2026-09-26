// Run: npx tsx src/lib/maps/__verify__/render.verify.ts
// Round trip (spec §8): each MapGraph field reaches the canvas element or edge it promises.
import { BOARD_HEX_COLORS, TINT_COLORS, TINT_GRADIENTS } from "@/lib/ai/element-generation";
import type {
  BoardElement, CanvasElement, ContainerElement, FreeformElement, LineElement, ShapeElement, TableElement, TextElement,
} from "@/types/canvas-elements";
import { checkMapStructure } from "../catalog";
import { RENDER_FLOORS, realBounds } from "@/lib/canvas-layout-rules";
import {
  HEADING_FONT_PX, LEGEND, NEUTRAL_CARD_BG, NEUTRAL_SHAPE_STYLE, readLegend, TINT_ACCENTS, tintOf,
} from "../element-style";
import { footprint, NEUTRAL_CONNECTOR } from "../layouts/shared";
import { TASK_CARD_W, TASK_DETAIL_MAX, taskCardHeight } from "../task-card";
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
// A task card paints 300px wide and at least 300px tall (324px with a one-line
// description): it must be stored, and measured by realBounds, at least that big.
check(`task is stored at least at the task-card floor (${task?.width}x${task?.height})`,
  !!task && task.width >= RENDER_FLOORS.taskCard.width && task.height >= RENDER_FLOORS.taskCard.height);
check("task is stored at least as tall as its painted estimate (title, description, owner)",
  !!task && task.height >= taskCardHeight("Call the venue", "Before Friday", "Sam") && task.height >= 324);
check("realBounds floors a task card at 300x300",
  (() => { const b = realBounds({ ...task!, width: 260, height: 160 }); return b?.w === 300 && b?.h === 300; })());
{
  const long = { ...n("t2", "leaf", "", "task", '{"owner":"Exhibits team, Venue lead, Ana"}',
    "Test the mist levels with families and the venue team"), detail: "word ".repeat(60).trim() };
  const f = footprint(long);
  const strong = footprint({ ...long, emphasis: "strong" });
  check(`a long task grows its footprint to its painted height (${f.w}x${f.h})`,
    f.w === TASK_CARD_W && f.h >= taskCardHeight(long.label, long.detail.slice(0, TASK_DETAIL_MAX), "Exhibits team, Venue lead, Ana") && f.h > 400);
  check("strong emphasis never shrinks a task below its painted size", strong.w >= TASK_CARD_W && strong.h >= f.h);
  const hub = renderMap({ mapType: "radial", title: "Long task", legend: [], relations: [],
    nodes: [n("a", "center"), { ...long, role: "branch" }, n("b", "branch")] });
  const lt = hub.elements.find((e): e is FreeformElement => e.type === "freeform" && e.cardType === "task");
  check(`a long description is cut to ${TASK_DETAIL_MAX} characters, as footprint() sized it`,
    Array.from(lt?.taskMetadata?.description ?? "").length === TASK_DETAIL_MAX && !!lt?.taskMetadata?.description?.endsWith("…")
    && lt!.height >= f.h);
}

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
const goal = find<ShapeElement>((e) => e.type === "shape" && e.content === "Goal");
check("with a legend, an untinted shape is neutral, not the generator's violet",
  goal?.style?.bgColor === NEUTRAL_SHAPE_STYLE.bgColor && goal?.style?.borderColor === NEUTRAL_SHAPE_STYLE.borderColor && tintOf(goal!) === null);

const legend = readLegend(els);
check(`legend renders one swatch and label per entry (${legend.map((l) => `${l.tint}:${l.meaning}`).join(",")})`,
  legend.map((l) => `${l.tint}:${l.meaning}`).join(",") === "rose:Risk,emerald:Opportunity");
const title = find<TextElement>((e) => e.type === "text" && e.content === "Round trip")!;
const legendIds = new Set(legend.flatMap((l) => [l.swatchId, l.labelId]));
const mapTop = Math.min(...els.filter((e) => e.type !== "line" && e.id !== title.id && !legendIds.has(e.id)).map((e) => e.y));
const legendEls = els.filter((e) => legendIds.has(e.id));
check("legend sits under the title and above the map",
  legendEls.length === 4 && legendEls.every((e) => e.y >= title.y + title.height && e.y + e.height <= mapTop));
const swatch = els.find((e): e is ShapeElement => e.id === legend[0]?.swatchId);
// ShapeCard strokes in a 100-unit viewBox stretched to the element: borderWidth 2
// on a 20px swatch is a 0.4px hairline. The disc is opaque in the tint's card
// colour (card gradient midpoint = portal hex) and ringed in its accent.
check("legend swatch is an opaque disc in the card colour with a visible accent ring",
  swatch?.style?.bgColor === BOARD_HEX_COLORS.rose && TINT_GRADIENTS.rose.includes(BOARD_HEX_COLORS.rose)
  && swatch?.style?.borderColor === TINT_ACCENTS.rose && (swatch?.style?.borderWidth ?? 0) * LEGEND.swatch / 100 >= 2);
{ // A canvas snapshot: TextCard auto-grows the label; readLegend still pairs it by position.
  const grown = els.map((e) => (e.type === "text" && legendIds.has(e.id) ? { ...e, height: 36 } : e));
  check("readLegend matches labels by position when TextCard has grown them",
    readLegend(grown).map((l) => `${l.tint}:${l.meaning}`).join(",") === "rose:Risk,emerald:Opportunity");
}

const tree: MapGraph = {
  mapType: "tree", title: "Heading check", legend: [], relations: [],
  nodes: [n("r", "root", "", "card", "{}", "Root"), n("h", "branch", "r", "heading", "{}", "Region A"), n("c", "leaf", "h", "card", "{}", "Inside A")],
};
check("heading graph is valid", checkMapStructure(tree).length === 0);
const heading = renderMap(tree).elements.find((e) => e.type === "text" && e.content === "Region A") as TextElement | undefined;
// TextCard passes fontWeight straight to inline CSS: it must be a CSS value ("semibold" is dropped).
check("heading renders at heading size, in bold", heading?.style?.fontSize === HEADING_FONT_PX && heading?.style?.fontWeight === "bold");

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
check("beside a legend, edges from untinted sources avoid legend colours",
  cm.edges.filter((e) => e.label?.text !== "serves").every((e) => e.style?.gradientName && e.style.gradientName !== "sunset"));
{
  const all = TINT_COLORS.map((t) => ({ tint: t, meaning: t }));
  const full: MapGraph = {
    ...concept, legend: all,
    nodes: concept.nodes.map((x, i) => (i === 0 ? x : i === 1 ? { ...x, tint: "violet" } : i === 2 ? { ...x, tint: "ocean" } : x)),
  };
  full.nodes.push(...(["emerald", "rose", "glacier"] as const).map((t, i) => ({ ...n(`x${i}`, "concept", "", "card", "{}", `Extra ${t}`), tint: t })));
  full.relations = [...concept.relations, r("a", "x0", "one"), r("a", "x1", "two"), r("a", "x2", "three")];
  check(`all-six legend graph is valid (${checkMapStructure(full).join("; ")})`, checkMapStructure(full).length === 0);
  // "trade" runs from d, which stays untinted.
  const fe = renderMap(full).edges.find((e) => e.label?.text === "trade");
  check("with every tint in the legend, an untinted source's edge takes the neutral connector",
    fe?.style?.gradientName === NEUTRAL_CONNECTOR);
}
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
