// Run: npx tsx src/lib/ai/__verify__/assistant-tools.verify.ts
// The Canvas Assistant's model-free logic: where a build lands, the order it
// appears in, the free selection tools, and the form suggestions.
import { generatedToCanvas, buildConnectorEdge, TINT_RINGS, type GeneratedElement, type GeneratedEdge } from "../element-generation";
import { translateForApply } from "../canvas-operations-executor";
import { tidyLayout, connectInOrder } from "../canvas-tools";
import { revealOrder } from "../assistant-build";
import { allDiagramForms, describeStyle, explicitForm, isDrawRequest, needsFormChoice, projectStarters, reworksSelection, suggestForms } from "../assistant-forms";
import { buildCanvasInventory, getElementTitle } from "@/utils/ai-context-aggregator";
import { isActionableMessage } from "../canvas-operations";
import { checkLayout, realBounds } from "@/lib/canvas-layout-rules";
import type { CanvasElement, ShapeElement } from "@/types/canvas-elements";
import type { SanitizedProposal } from "@/types/ai-operations";
import type { AIProjectContext } from "@/types/ai-types";

let failures = 0;
function check(name: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}`);
}

const gen = (ref: string, content: string, x: number, y: number, extra: Partial<GeneratedElement> = {}): GeneratedElement => ({
  kind: "shape", ref, parentRef: null, label: null, content, tint: "ocean", shapeType: "pill", hypercubeTags: null,
  x, y, width: 260, height: 100, props: null, ...extra,
});
const edge = (from: string, to: string): GeneratedEdge => ({ from, to, label: null, props: null });
const node = (els: CanvasElement[], name: string) => els.find((e) => (e as ShapeElement).content === name)!;
const boundsOf = (els: CanvasElement[]) => {
  const bs = els.map((e) => realBounds(e)!).filter(Boolean);
  return { x: Math.min(...bs.map((b) => b.x)), y: Math.min(...bs.map((b) => b.y)), r: Math.max(...bs.map((b) => b.x + b.w)), b: Math.max(...bs.map((b) => b.y + b.h)) };
};

// A four-stage flow the "model" placed at the origin.
const flow = generatedToCanvas(
  [gen("a", "A", 0, 0), gen("b", "B", 380, 0), gen("c", "C", 760, 0), gen("d", "D", 1140, 0)],
  [edge("a", "b"), edge("b", "c"), edge("c", "d")],
);
const proposalOf = (extraOps: SanitizedProposal["ops"] = []): SanitizedProposal => ({
  reply: "", droppedCount: 0,
  rows: [{ rowId: "r1", kind: "create", summary: "", destructive: false }, ...extraOps.map((o) => ({ rowId: o.rowId, kind: o.kind, summary: "", destructive: o.kind === "delete" }))],
  creates: { rowId: "r1", elements: flow.elements, edges: flow.edges },
  ops: extraOps,
});
const live = (id: string, x: number, y: number): CanvasElement =>
  ({ id, type: "shape", shapeType: "rectangle", x, y, width: 300, height: 200, zIndex: 1, content: id }) as unknown as CanvasElement;

console.log("Where a build lands:");
{
  const all = new Set(["r1"]);
  // Existing work sits exactly where the model drew; the user is looking far away.
  const existing = [live("x1", 0, 0), live("x2", 400, 0)];
  const plan = translateForApply(proposalOf(), all, existing, [], { viewportCenter: { x: 5000, y: 3000 } });
  const box = boundsOf(plan.batch.addElements);
  check("a standalone diagram is built where the user is looking",
    Math.abs((box.x + box.r) / 2 - 5000) <= 20 && Math.abs((box.y + box.b) / 2 - 3000) <= 20);
  check("it keeps its internal layout", node(plan.batch.addElements, "B").x - node(plan.batch.addElements, "A").x === 380);
  check("it stays on the 20px grid", plan.batch.addElements.every((e) => e.x % 20 === 0 && e.y % 20 === 0));

  // The view is on top of existing work: the diagram goes to the nearest clear spot.
  const crowded = translateForApply(proposalOf(), all, existing, [], { viewportCenter: { x: 300, y: 100 } });
  check("it never lands on existing elements",
    checkLayout([...existing, ...crowded.batch.addElements], crowded.batch.addEdges).filter((v) => v.rule === "overlap").length === 0);

  // A diagram whose nodes still carry a containerId but sit outside that
  // frame (dragged out by hand) must still be seen as in the way.
  const frame = { id: "fr", type: "container", x: 9000, y: 9000, width: 200, height: 200, zIndex: 0, label: "Old frame" } as unknown as CanvasElement;
  const escaped = [live("e1", 100, 100), live("e2", 500, 100), live("e3", 900, 100)].map((e) => ({ ...e, containerId: "fr" }) as CanvasElement);
  const onTop = translateForApply(proposalOf(), all, [frame, ...escaped], [], { viewportCenter: { x: 600, y: 200 }, boardId: null });
  check("children that escaped their frame still block a build",
    checkLayout([...escaped.map((e) => ({ ...e, containerId: undefined }) as CanvasElement), ...onTop.batch.addElements], onTop.batch.addEdges).filter((v) => v.rule === "overlap").length === 0);
  // Elements of another board share coordinates but not the screen.
  const elsewhere = [live("b1", 4900, 2900), live("b2", 5200, 3000)].map((e) => ({ ...e, boardId: "other-board" }) as CanvasElement);
  const boardAware = translateForApply(proposalOf(), all, elsewhere, [], { viewportCenter: { x: 5000, y: 3000 }, boardId: null });
  const bb = boundsOf(boardAware.batch.addElements);
  check("another board's elements are not in the way", Math.abs((bb.x + bb.r) / 2 - 5000) <= 20);
  // No viewport given (the lab, the eval): the model's position, moved only if it collides.
  const legacy = translateForApply(proposalOf(), all, [], []);
  check("without a viewport the model's position is kept", node(legacy.batch.addElements, "A").x === 0 && node(legacy.batch.addElements, "A").y === 0);

  // Replacing: the proposal deletes the old version, and the new one takes its place.
  const old = [live("o1", 2000, 1000), live("o2", 2400, 1000)];
  const replace = translateForApply(
    proposalOf([{ rowId: "r2", kind: "delete", ids: ["o1", "o2"] }]), new Set(["r1", "r2"]), [...old, live("far", 9000, 9000)], [],
    { viewportCenter: { x: 5000, y: 3000 } },
  );
  const rb = boundsOf(replace.batch.addElements);
  check("a revision takes the place of what it replaces", rb.x === 2000 && rb.y === 1000);
  check("and the old version is removed", replace.batch.removeElementIds.length === 2);

  // An addition wired to an existing element is not a standalone diagram.
  const wired: SanitizedProposal = {
    ...proposalOf(),
    creates: { rowId: "r1", elements: flow.elements, edges: [...flow.edges, buildConnectorEdge(flow.elements[3].id, "x1")] },
  };
  const attached = translateForApply(wired, all, [live("x1", 3000, 0)], [], { viewportCenter: { x: 9000, y: 9000 } });
  check("an addition connected to existing work stays where it was placed", node(attached.batch.addElements, "A").x === 0);
}

console.log("Reveal order:");
{
  const titled = generatedToCanvas(
    [gen("c", "C", 760, 200), gen("a", "A", 0, 200), gen("b", "B", 380, 200),
      gen("t", "Title", 0, 0, { kind: "text", shapeType: null, width: 400, height: 40, props: '{"role":"title"}' })],
    [edge("a", "b"), edge("b", "c")],
  );
  const order = revealOrder(titled.elements, titled.edges).map((id) => (titled.elements.find((e) => e.id === id) as ShapeElement).content);
  check(`title first, then the flow in connector order (${order.join(" > ")})`, order.join(",") === "Title,A,B,C");

  const framed = generatedToCanvas([
    gen("n", "Inside", 40, 100, { parentRef: "f" }),
    gen("f", "", 0, 0, { kind: "container", shapeType: null, label: "Frame", width: 400, height: 300, props: '{"titled":false}' }),
  ]);
  const fo = revealOrder(framed.elements, framed.edges);
  check("a frame appears before what is inside it", framed.elements.find((e) => e.id === fo[0])!.type === "container");
}

console.log("Free selection tools:");
{
  // Four connected nodes dropped in a heap.
  const heap = generatedToCanvas(
    [gen("a", "A", 500, 500), gen("b", "B", 520, 510), gen("c", "C", 510, 530), gen("d", "D", 540, 520)],
    [edge("a", "b"), edge("b", "c"), edge("c", "d")],
  );
  // generatedToCanvas already repairs overlaps; pile them back up to model a real mess.
  const messy = heap.elements.map((e, i) => ({ ...e, x: 500 + i * 20, y: 500 + i * 10 }) as CanvasElement);
  const ids = messy.map((e) => e.id);
  const batch = tidyLayout(messy, heap.edges, ids)!;
  const after = messy.map((e) => ({ ...e, ...(batch.updates.find((u) => u.id === e.id)?.updates ?? {}) }) as CanvasElement);
  check("tidy removes every overlap", checkLayout(after, heap.edges).filter((v) => v.severity === "error").length === 0);
  check("tidy lays a chain out in connector order", node(after, "A").x < node(after, "B").x && node(after, "B").x < node(after, "C").x && node(after, "C").x < node(after, "D").x);
  check("tidy keeps the top-left corner where it was", Math.min(...after.map((e) => e.x)) === 500 && Math.min(...after.map((e) => e.y)) === 500);
  check("tidy adds and removes nothing", batch.addElements.length === 0 && batch.removeElementIds.length === 0 && batch.addEdges.length === 0);
  check("tidying an already tidy selection is a no-op", tidyLayout(after, heap.edges, ids) === null);
  check("tidy needs at least two elements", tidyLayout(messy, heap.edges, [ids[0]]) === null);

  const row = [live("p", 0, 0), live("q", 800, 20), live("r", 400, 10)];
  const chain = connectInOrder(row, [], ["p", "q", "r"])!;
  check("connect in order follows reading order", chain.addEdges.map((e) => `${e.fromNodeId}>${e.toNodeId}`).join(",") === "p>r,r>q");
  const partial = connectInOrder(row, [buildConnectorEdge("r", "p")], ["p", "q", "r"])!;
  check("pairs already connected (either way) are left alone", partial.addEdges.length === 1 && partial.addEdges[0].fromNodeId === "r");
  check("a fully connected chain is a no-op", connectInOrder(row, chain.addEdges, ["p", "q", "r"]) === null);
}

console.log("Routing and form suggestions:");
{
  check("a draw command reaches the canvas path", isDrawRequest("Draw our capacity building loop") && isDrawRequest("map the participant journey"));
  check("a question does not", !isDrawRequest("What should I draw first?") && !isDrawRequest("show me what is missing"));
  check("an open request is asked its form", needsFormChoice("Map the participant journey from landing to follow-up"));
  check("a request that names its form is not", !needsFormChoice("Draw our capacity building loop") && !needsFormChoice("Show this as a table"));
  check("an edit is never asked its form", !needsFormChoice("Tag the selected elements to Sensory Domains") && !needsFormChoice("delete the empty cards"));
  check("edits still route as before", isActionableMessage("rename the Onboarding card"));

  const top = (text: string) => suggestForms(text)[0].id;
  check("stages suggest a flow", top("The journey has five stages: arrive, orient, induct, peak, then integrate") === "flow");
  check("a cycle suggests a loop", top("It is a feedback cycle that repeats: practise, reflect, back to practise") === "loop");
  check("a comparison suggests a table", top("Compare what we believe versus what we must prove, with criteria") === "table");
  check("positioning suggests quadrants", top("Positioning against competitors on two axes") === "quadrants");
  check("explained list items suggest a spine",
    top("- Discover: the patient first hears about the programme from their oncologist\n- Understand: they read what a session involves and who can take part\n- Assess: they decide whether they can manage it and trust the team") === "spine");
  const opts = suggestForms("something with no signals at all");
  check("there are always three distinct choices", opts.length === 3 && new Set(opts.map((o) => o.id)).size === 3);
}

console.log("What the assistant can see:");
{
  const shape = { id: "s1", type: "shape", shapeType: "rectangle", content: "SECOND BRAIN\nCLAUDE PROJECTS", x: 0, y: 0, width: 240, height: 90, zIndex: 1, hypercubeTags: ["Core"] } as unknown as CanvasElement;
  const noteCard = { id: "n1", type: "freeform", cardType: "note", content: "", noteTitle: "Facilitator brief", noteBody: "<p>Hold the room.</p><p>Stay quiet.</p>", x: 400, y: 0, width: 300, height: 300, zIndex: 1 } as unknown as CanvasElement;
  const frame = { id: "c1", type: "container", label: "Tech Stack", x: 800, y: 0, width: 400, height: 300, zIndex: 0 } as unknown as CanvasElement;
  const grid = { id: "t1", type: "table", rows: 2, cols: 2, cells: [[{ text: "Tool" }, { text: "Role" }], [{ text: "Claude" }, { text: "Agent" }]], x: 1300, y: 0, width: 320, height: 96, zIndex: 1 } as unknown as CanvasElement;
  check("a shape is known by its text, not as \"Element\"", getElementTitle(shape) === "SECOND BRAIN");
  check("a note card is known by its title", getElementTitle(noteCard) === "Facilitator brief");
  check("a container is known by its label", getElementTitle(frame) === "Tech Stack");
  check("a table is known by its header row", getElementTitle(grid) === "Table: Tool | Role");
  const inv = buildCanvasInventory([shape, noteCard, frame, grid], ["s1"], [buildConnectorEdge("s1", "n1", "feeds")]);
  const item = (id: string) => inv.elements.find((e) => e.id === id)!;
  check("the rest of an element's text travels with it", item("s1").text === "CLAUDE PROJECTS" && item("n1").text === "Hold the room. Stay quiet.");
  check("tags and selection are carried", item("s1").tags?.[0] === "Core" && item("s1").selected === true);
  check("existing connectors are listed", inv.connections?.length === 1 && inv.connections[0].from === "s1" && inv.connections[0].label === "feeds");
}

console.log("More forms and selection rework:");
{
  check("a tech stack suggests a layered stack", suggestForms("Rearrange my tools into a better tech stack diagram")[0].id === "stack");
  check("a dated plan suggests a timeline", suggestForms("Roadmap with milestones for each quarter")[0].id === "timeline");
  check("a named form is recognised", explicitForm("draw it as swimlanes") === "swimlanes" && explicitForm("make a funnel") === "funnel" && explicitForm("map the journey") === null);
  check("every form but the note is offered under More", allDiagramForms().length === 12 && !allDiagramForms().some((f) => f.id === "note"));
  check("\"rearrange them in a better diagram\" reworks the selection",
    reworksSelection("read the elements tag and rearrange them in a better tech stack diagram", 5));
  check("\"make a better tech stack diagram\" with a selection reworks it", reworksSelection("Make a better tech stack diagram", 5));
  check("without a selection nothing is reworked", !reworksSelection("Make a better tech stack diagram", 0));
  check("an edit of the selection is not a rework", !reworksSelection("delete these diagrams", 3) && !reworksSelection("tag them to Core", 3));
  check("a fresh drawing with a selection is not a rework", !reworksSelection("Map the participant journey", 4));
}
console.log("Style memory and starters:");
{
  const style = describeStyle(flow.elements, flow.edges, flow.elements.map((e) => e.id))!;
  check(`a diagram's style is described (${style})`, /pill/.test(style) && /outline/.test(style) && /ocean/.test(style) && /No note cards/.test(style));
  check("the ring colour is what identifies the family", (flow.elements[0] as ShapeElement).style?.borderColor === TINT_RINGS.ocean);
  check("too little to learn from yields nothing", describeStyle(flow.elements, flow.edges, [flow.elements[0].id]) === null);

  const ctx = {
    framing: {
      intentionCore: { coreMessage: "Less fear, more freedom", mainConcept: "", projectName: "" },
      desiredChange: { insights: "", feelings: "", states: "calm", knowledge: "" },
      humanContext: { audienceNeeds: "", audienceDesires: "", userRole: "" },
      contextAndMeaning: { world: "", story: "", magic: "" },
      experienceFlow: { description: "", stages: [{ name: "Arrive" }, { name: "Peak" }, { name: "Return" }] },
    },
    map: { faces: [{ id: "sensoryDomains", label: "Sensory Domains", completion: 0.2 }] },
    canvas: { elementCount: 2 },
  } as unknown as AIProjectContext;
  const starters = projectStarters(ctx, 0);
  check("starters come from the project's own data", starters.some((s) => s.includes("3 stages")) && starters.some((s) => s.includes("Sensory Domains")));
  check("a selection leads the starters", projectStarters(ctx, 3)[0].includes("3 selected"));
  check("an empty project still gets starters", projectStarters(null, 0).length >= 3);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
