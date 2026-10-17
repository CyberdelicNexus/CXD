// Run: npx tsx src/lib/ai/__verify__/diagram-vocabulary.verify.ts
// The diagram vocabulary (canvas-skill.ts) end to end: every prop the skill
// teaches reaches the element it promises, through both AI paths, and the
// draft layout arranges connected nodes by the shape of their graph.
import {
  generatedToCanvas, TINT_GRADIENTS, TINT_RINGS, TINT_TEXT_GRADIENTS, SHAPE_TYPES,
  CANVAS_GENERATION_GUIDE, type GeneratedElement, type GeneratedEdge,
} from "../element-generation";
import { sanitizeCanvasOperations, CANVAS_OPERATIONS_GUIDE, type CanvasOpRow } from "../canvas-operations";
import { translateForApply } from "../canvas-operations-executor";
import { layoutDraftElements, connectorsThroughNodes } from "../draft-layout";
import { checkLayout } from "@/lib/canvas-layout-rules";
import type { CanvasElement, ContainerElement, ShapeElement, TextElement, FreeformElement } from "@/types/canvas-elements";
import type { CanvasInventory } from "@/types/ai-operations";

let failures = 0;
function check(name: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}`);
}

const gen = (g: Partial<GeneratedElement> & Pick<GeneratedElement, "kind" | "ref">): GeneratedElement => ({
  parentRef: null, label: null, content: null, tint: null, shapeType: null, hypercubeTags: null,
  x: 0, y: 0, width: 260, height: 100, props: null, ...g,
});
const edge = (from: string, to: string): GeneratedEdge => ({ from, to, label: null, props: null });
const centre = (el: CanvasElement) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

// ── Vocabulary: props reach the element ──────────────────────────────
console.log("Vocabulary:");
{
  const { elements } = generatedToCanvas([
    gen({ kind: "container", ref: "f1", label: "Review", tint: "emerald", width: 520, height: 360, props: '{"titled":false}' }),
    gen({ kind: "text", ref: "t1", parentRef: "f1", content: "Review of V1", x: 40, y: 20, width: 300, height: 10, props: '{"role":"heading"}' }),
    gen({ kind: "shape", ref: "n1", parentRef: "f1", content: "PAIN POINTS", shapeType: "pill", x: 40, y: 100 }),
    gen({ kind: "container", ref: "f2", label: "Loose frame", x: 700, width: 400, height: 300 }),
    gen({ kind: "freeform", ref: "c1", parentRef: "f2", x: 720, y: 80, props: '{"noteTitle":"Brief","noteBody":"..."}' }),
    gen({ kind: "shape", ref: "n2", content: "Ghost", shapeType: "hexagon", tint: "rose", x: 1300, props: '{"look":"ghost","fontSize":22}' }),
    gen({ kind: "text", ref: "t2", content: "The Shift", x: 1300, y: 300, width: 400, props: '{"role":"title","tint":"ocean","align":"center"}' }),
    gen({ kind: "text", ref: "t3", content: "A muted line", x: 1300, y: 400, width: 400, props: '{"role":"caption"}' }),
    gen({ kind: "text", ref: "t4", content: "Legacy text", x: 1300, y: 500, width: 300, height: 60 }),
  ]);
  const by = <T extends CanvasElement>(pred: (e: CanvasElement) => boolean) => elements.find(pred) as T;

  const frame = by<ContainerElement>((e) => e.type === "container" && (e as ContainerElement).label === "Review");
  check("a frame is untitled and keeps its name for the inventory", frame.hideLabel === true && frame.label === "Review");
  const loose = by<ContainerElement>((e) => e.type === "container" && (e as ContainerElement).label === "Loose frame");
  check("a frame nobody names with a heading keeps its title bar", loose.hideLabel === false);

  const heading = by<TextElement>((e) => e.type === "text" && (e as TextElement).content === "Review of V1");
  check("a heading inherits its frame's family as gradient text",
    heading.style?.bgColor === TINT_TEXT_GRADIENTS.emerald && heading.style?.fontSize === 20 && heading.style?.fontWeight === "bold");
  check("styled text gets a computed height, not the model's guess", heading.height > 20 && heading.height < 60);

  const pill = by<ShapeElement>((e) => e.type === "shape" && (e as ShapeElement).content === "PAIN POINTS");
  check("a node defaults to the outline look in its frame's family",
    pill.shapeType === "pill" && pill.style?.borderColor === TINT_RINGS.emerald && pill.style?.bgColor === "#0B0E17" && pill.style?.textColor === "#ffffff");
  const ghost = by<ShapeElement>((e) => e.type === "shape" && (e as ShapeElement).content === "Ghost");
  check("look and fontSize are honoured",
    ghost.style?.fillOpacity === 0 && ghost.style?.borderColor === TINT_RINGS.rose && ghost.style?.fontSize === 22);

  const title = by<TextElement>((e) => e.type === "text" && (e as TextElement).content === "The Shift");
  check("a title is 30px gradient and can be centred",
    title.style?.fontSize === 30 && title.style?.bgColor === TINT_TEXT_GRADIENTS.ocean && title.textAlign === "center");
  const caption = by<TextElement>((e) => e.type === "text" && (e as TextElement).content === "A muted line");
  check("a caption is muted and carries no gradient", !caption.style?.bgColor && caption.style?.fontSize === 13);
  const legacy = by<TextElement>((e) => e.type === "text" && (e as TextElement).content === "Legacy text");
  check("text without a role is unchanged", legacy.style?.fontSize === 14 && legacy.height === 60);

  const note = by<FreeformElement>((e) => e.type === "freeform");
  check("a note takes its frame's family", note.style?.bgColor === TINT_GRADIENTS[loose.tintColor!]);
  // Every hex stop of every note gradient is dark: no channel above 0x45.
  const dark = Object.values(TINT_GRADIENTS).every((g) =>
    (g.match(/#[0-9A-Fa-f]{6}/g) ?? []).every((hex) => [1, 3, 5].every((i) => parseInt(hex.slice(i, i + 2), 16) <= 0x45)));
  check("note fills are near-black in every family", dark);
}

// ── Operations path: the same props through sanitize, and recolouring ─
console.log("Operations path:");
{
  const row = (r: Partial<CanvasOpRow> & Pick<CanvasOpRow, "op" | "summary">): CanvasOpRow => ({
    kind: "none", ref: "", parentRef: "", targetIds: [], label: "", content: "",
    x: 0, y: 0, width: 0, height: 0, fromRef: "", toRef: "", props: "{}", ...r,
  });
  const live = [
    { id: "x1", type: "freeform", x: 3000, y: 0, width: 300, height: 300, zIndex: 1, cardType: "note", content: "", style: { bgColor: "#fff" } },
    { id: "x2", type: "container", x: 3400, y: 0, width: 400, height: 300, zIndex: 0, label: "Zone", tintColor: "violet" },
  ] as unknown as CanvasElement[];
  const inventory: CanvasInventory = {
    totalCount: 2, truncated: false, selectedIds: [],
    elements: live.map((e) => ({ id: e.id, type: e.type, title: e.id, x: e.x, y: e.y, width: e.width, height: e.height })),
  };
  const proposal = sanitizeCanvasOperations({
    reply: "",
    operations: [
      row({ op: "create", summary: "", kind: "shape", ref: "n1", content: "EXPERIENCE", width: 260, height: 100, props: '{"shapeType":"pill","tint":"ocean"}' }),
      row({ op: "create", summary: "", kind: "shape", ref: "n2", content: "REFLECT", x: 400, width: 260, height: 100, props: '{"shapeType":"pill","tint":"ocean"}' }),
      row({ op: "connect", summary: "", fromRef: "n1", toRef: "n2", props: '{"gradientName":"ocean"}' }),
      row({ op: "update", summary: "darker note", targetIds: ["x1"], props: '{"tint":"rose"}' }),
      row({ op: "update", summary: "outline only", targetIds: ["x2"], props: '{"titled":false}' }),
    ],
  }, inventory);
  const pills = (proposal.creates?.elements ?? []) as ShapeElement[];
  check("create rows carry shapeType and tint from props",
    pills.length === 2 && pills.every((p) => p.shapeType === "pill" && p.style?.borderColor === TINT_RINGS.ocean));
  check("ref-to-ref connect rides along, in its family",
    proposal.creates?.edges.length === 1 && proposal.creates.edges[0].style?.gradientName === "ocean");
  check("nothing was dropped", proposal.droppedCount === 0);

  const plan = translateForApply(proposal, new Set(proposal.rows.map((r) => r.rowId)), live, []);
  const patch = (id: string) => plan.batch.updates.find((u) => u.id === id)?.updates as Record<string, unknown> | undefined;
  check("tint on a note recolours its fill",
    (patch("x1")?.style as { bgColor?: string } | undefined)?.bgColor === TINT_GRADIENTS.rose);
  check("titled:false turns an existing container into an outline", patch("x2")?.hideLabel === true);
}

// ── Draft layout: arranged by the shape of the graph ─────────────────
console.log("Compact rows:");
{
  const inventory: CanvasInventory = {
    totalCount: 1, truncated: false, selectedIds: [],
    elements: [{ id: "x1", type: "freeform", title: "Onboarding", x: 3000, y: 0, width: 300, height: 300 }],
  };
  const node = (ref: string, text: string, x: number, extra: Record<string, unknown> = {}) =>
    ({ ref, kind: "shape" as const, shape: "pill" as const, tint: "emerald" as const, parent: "", text, x, y: 0, w: 260, h: 100, props: "{}", ...extra });
  const proposal = sanitizeCanvasOperations({
    reply: "",
    nodes: [
      node("n1", "ARRIVE", 0),
      node("n2", "PEAK", 400, { props: '{"look":"filled"}' }),
      node("t1", "The journey", 0, { kind: "text", shape: "none", tint: "none", y: -120, w: 400, h: 40, props: '{"role":"title"}' }),
      node("c1", "Facilitator brief", 900, { kind: "freeform", shape: "none", tint: "none", w: 300, h: 300, props: '{"noteBody":"Hold the room."}' }),
    ],
    links: [
      { from: "n1", to: "n2", label: "", props: "{}" },
      { from: "n2", to: "x1", label: "then", props: '{"lineStyle":"dashed"}' },
    ],
    operations: [],
  }, inventory);
  const els = proposal.creates?.elements ?? [];
  const shapes = els.filter((e): e is ShapeElement => e.type === "shape");
  check("node rows become elements with their shape and family",
    shapes.length === 2 && shapes.every((s) => s.shapeType === "pill" && s.style?.borderColor === TINT_RINGS.emerald));
  check("a node's props still apply", shapes.find((s) => s.content === "PEAK")?.style?.bgColor?.includes("gradient") === true);
  const note = els.find((e): e is FreeformElement => e.type === "freeform");
  check("a note's text is its title and its body comes from props", note?.noteTitle === "Facilitator brief" && note?.noteBody === "Hold the room.");
  check("floating text keeps its role", (els.find((e) => e.type === "text") as TextElement | undefined)?.style?.fontSize === 30);
  const edges = proposal.creates?.edges ?? [];
  check("a link takes the colour family of the node it leaves", edges.find((e) => !e.label)?.style?.gradientName === "emerald");
  check("a link may end on an existing element, with its own styling",
    edges.some((e) => e.toNodeId === "x1" && e.label?.text === "then" && e.style?.lineStyle === "dashed"));
  check("nothing was dropped", proposal.droppedCount === 0 && edges.length === 2);
  check("the build is one drawing row", proposal.rows.length === 1 && proposal.rows[0].kind === "create");
}

console.log("Draft layout:");
{
  // Loop: four pills in a closed ring, with the loop's name floating free.
  const { elements, edges } = generatedToCanvas([
    gen({ kind: "shape", ref: "a", content: "EXPERIENCE", shapeType: "pill" }),
    gen({ kind: "shape", ref: "b", content: "REFLECT", shapeType: "pill" }),
    gen({ kind: "shape", ref: "c", content: "PRACTISE", shapeType: "pill" }),
    gen({ kind: "shape", ref: "d", content: "EMBODY", shapeType: "pill" }),
    gen({ kind: "text", ref: "t", content: "CAPACITY BUILDING", width: 360, props: '{"role":"heading","align":"center"}' }),
    gen({ kind: "text", ref: "s", content: "DEFAULT LOOP", width: 360, props: '{"role":"label","align":"center"}' }),
  ], [edge("a", "b"), edge("b", "c"), edge("c", "d"), edge("d", "a")]);
  const out = layoutDraftElements(elements, edges);
  const node = (name: string) => out.find((e) => e.type === "shape" && (e as ShapeElement).content === name)!;
  const [a, b, c, d] = ["EXPERIENCE", "REFLECT", "PRACTISE", "EMBODY"].map(node);
  check("pills keep their node size", out.filter((e) => e.type === "shape").every((e) => e.width === 260 && e.height === 100));
  check("a ring is laid out clockwise in two rows",
    a.y === b.y && c.y === d.y && a.x === d.x && b.x === c.x && a.x < b.x && a.y < d.y);
  const texts = out.filter((e) => e.type === "text");
  check("the loop's name sits in the middle of the ring", texts.length === 2 && texts.every((t) => {
    const p = centre(t);
    return p.y > a.y + a.height && p.y < d.y && Math.abs(p.x - (a.x + b.x + b.width) / 2) < 2;
  }));
  check("loop has no layout errors", checkLayout(out, edges).filter((v) => v.severity === "error").length === 0);
}
{
  // Spine: a chain of stages, each with one detail node hanging off it.
  const stages = ["Discover", "Understand", "Assess", "Enquire"];
  const { elements, edges } = generatedToCanvas([
    gen({ kind: "text", ref: "title", content: "Patient discovery", width: 420, props: '{"role":"title"}' }),
    ...stages.map((s, i) => gen({ kind: "shape", ref: `s${i}`, content: s, shapeType: "rectangle", width: 160, height: 80 })),
    ...stages.map((s, i) => gen({ kind: "shape", ref: `d${i}`, content: `What ${s} answers`, shapeType: "rectangle", width: 320, height: 120 })),
  ], [
    ...stages.slice(1).map((_, i) => edge(`s${i}`, `s${i + 1}`)),
    ...stages.map((_, i) => edge(`s${i}`, `d${i}`)),
  ]);
  const out = layoutDraftElements(elements, edges);
  const stage = (s: string) => out.find((e) => e.type === "shape" && (e as ShapeElement).content === s)!;
  const detail = (s: string) => out.find((e) => e.type === "shape" && (e as ShapeElement).content === `What ${s} answers`)!;
  check("stages run left to right on one axis",
    stages.every((s, i) => i === 0 || (stage(s).x > stage(stages[i - 1]).x && centre(stage(s)).y === centre(stage(stages[0])).y)));
  check("every detail sits under its own stage",
    stages.every((s) => Math.abs(centre(detail(s)).x - centre(stage(s)).x) < 2 && detail(s).y > stage(s).y + stage(s).height));
  const title = out.find((e) => e.type === "text")!;
  check("free text becomes the title block above the structure", out.every((e) => e === title || e.y > title.y + title.height));
  check("spine has no layout errors", checkLayout(out, edges).filter((v) => v.severity === "error").length === 0);
}

{
  /* Long flow with a retry loop and a "back to the start" connector: the shape
     that used to strand stages in the first column and score lines through
     every node of a single 8000px row. */
  const stages = Array.from({ length: 16 }, (_, i) => `S${i}`);
  const { elements, edges } = generatedToCanvas([
    ...stages.map((s) => gen({ kind: "shape", ref: s, content: s, shapeType: "pill" })),
    gen({ kind: "shape", ref: "retry", content: "Retry", shapeType: "rectangle", width: 200, height: 80 }),
  ], [
    ...stages.slice(1).map((_, i) => edge(`S${i}`, `S${i + 1}`)),
    edge("S2", "retry"), edge("retry", "S1"),
    edge("S15", "S0"),
  ]);
  const out = layoutDraftElements(elements, edges);
  const at = (s: string) => out.find((e) => e.type === "shape" && (e as ShapeElement).content === s)!;
  const width = Math.max(...out.map((e) => e.x + e.width)) - Math.min(...out.map((e) => e.x));
  check("a cycle does not strand stages: every stage has its own place",
    new Set(stages.map((s) => `${at(s).x},${at(s).y}`)).size === stages.length);
  check(`a long flow snakes instead of running in one row (width ${width})`, width <= 7 * 380);
  check("each row turn is a short vertical step",
    stages.slice(1).every((s, i) => at(s).y === at(stages[i]).y || Math.abs(centre(at(s)).x - centre(at(stages[i])).x) < 2));
  check("the retry step sits with the stage it leaves", Math.abs(centre(at("Retry")).x - centre(at("S2")).x) < 2);
  check("long flow has no layout errors", checkLayout(out, edges).filter((v) => v.severity === "error").length === 0);
  const closing = edges.find((e) => e.fromNodeId === at("S15").id && e.toNodeId === at("S0").id)!;
  const cut = connectorsThroughNodes(out, edges);
  check("only the connector that would cut across the diagram is left out", cut.has(closing.id) && cut.size === 1);
}
// ── The guides teach exactly what the generator implements ───────────
console.log("Guides:");
for (const [name, guide] of [["generation", CANVAS_GENERATION_GUIDE], ["operations", CANVAS_OPERATIONS_GUIDE]] as const) {
  check(`${name} guide carries the composition skill`, guide.includes("PICK THE FORM FROM THE CONTENT"));
  check(`${name} guide names only real shape types`,
    ["pill", "diamond", "hexagon", "parallelogram", "cylinder", "document", "callout"].every((s) => (SHAPE_TYPES as readonly string[]).includes(s) && guide.includes(s)));
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
