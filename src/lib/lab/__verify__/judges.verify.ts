// Run: npx tsx src/lib/lab/__verify__/judges.verify.ts
// Offline. I7: the LLM judges see every arm the same way, described from the
// rendered elements and edges, with no mapType or arm metadata. I6: the prompt
// version is a short, deterministic hash.
import { execFileSync } from "node:child_process";
import { auditSchemaForAnthropic } from "@/lib/ai/schema-guards";
import { EXEMPLARS } from "@/lib/maps/exemplars";
import { MAP_TYPES, type MapGraph } from "@/lib/maps/types";
import { renderMap } from "@/lib/maps/render";
import type { CanvasElement } from "@/types/canvas-elements";
import { CORPUS } from "../corpus";
import { describeRendered, elementKind, elementText, elementUsage } from "../describe";
import { cardsAsElements } from "../format-input";
import { JUDGES, judgePrompt, judgeSchema, JUDGE_SYSTEM } from "../judges";
import { PROMPT_VERSION } from "../prompts";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};

const input = CORPUS[0];
const mentionsMapType = (text: string) => /mapType/i.test(text) || MAP_TYPES.some((t) => new RegExp(`\\b${t}\\b`).test(text));

// A graph arm cell: rendered from each exemplar (every map type the exemplars cover).
for (const ex of EXEMPLARS) {
  const r = renderMap(ex.graph);
  const cell = { graph: ex.graph, elements: r.elements, edges: r.edges };
  const prompt = judgePrompt(input, cell);
  const result = prompt.slice(prompt.indexOf("RESULT"));
  check(`${ex.graph.mapType}: judge view names no map type and no graph JSON`,
    !mentionsMapType(result) && !result.includes('"nodes"') && !result.includes('"relations"'));
  check(`${ex.graph.mapType}: judge view is identical with or without the graph attached`,
    prompt === judgePrompt(input, { ...cell, graph: null }));
  const labelled = ex.graph.nodes.filter((n) => n.kind !== "zone" && n.kind !== "table").slice(0, 3);
  check(`${ex.graph.mapType}: node labels appear in the description`, labelled.every((n) => result.includes(n.label.slice(0, 20))));
  if (r.edges.length > 0) check(`${ex.graph.mapType}: connections listed as "#a -> #b" (or <-, <->, --)`, /#\d+ (->|<-|<->|--) #\d+/.test(result));
}

// Containment and labelled connections, built by hand so both are certain to be present.
{
  const container = { id: "zone", type: "container", x: 0, y: 0, width: 800, height: 600, zIndex: 0, label: "Risks" } as unknown as CanvasElement;
  const [a, b] = cardsAsElements([{ title: "Cost overrun", body: "" }, { title: "Late delivery", body: "" }])
    .map((e, i) => ({ ...e, x: 40 + i * 300, y: 80, containerId: i === 0 ? "zone" : undefined }) as CanvasElement);
  const text = describeRendered([container, a, b], [{
    id: "e", fromNodeId: a.id, toNodeId: b.id, fromAnchor: "right", toAnchor: "left", label: { text: "causes" },
  }]);
  check("declared containment is described", /#2 card "Cost overrun".* in #1/.test(text));
  check("geometric containment is described when containerId is missing", /#3 card "Late delivery".* in #1/.test(text));
  check("labelled connection is described", text.includes("#2 -> #3 [causes]"));
  check("container text comes from its label", text.includes('#1 container "Risks"'));
}

// A baseline cell (no graph) is described in exactly the same format.
{
  const els = cardsAsElements([{ title: "Budget", body: "tight" }, { title: "Scope", body: "" }]);
  const prompt = judgePrompt(input, { graph: null, elements: els, edges: [] });
  check("baseline is described from its elements with the same headings",
    prompt.includes("RESULT (the map as drawn on the canvas):") && prompt.includes("Elements (2), top to bottom:") && prompt.includes("Connections (0):"));
  check("note card text includes title and body", elementText(els[0]).includes("Budget") && elementText(els[0]).includes("tight"));
}

// The judge schema is unchanged in shape and still passes the Anthropic audit.
{
  const a = auditSchemaForAnthropic(judgeSchema);
  check("judge schema: no array bounds, unions or optionals", a.arrayBounds === 0 && a.unions === 0 && a.optionals === 0);
  check("judge schema adds elementFit to its fields", Object.keys(judgeSchema.shape).sort().join(",") ===
    "actionability,balance,clarity,elementFit,faithfulness,notes,relations,typeFit");
  check("the prompt defines elementFit and penalises variety for its own sake",
    JUDGE_SYSTEM.includes("elementFit: did each idea get the element that best suits it") && /variety for its own sake scores low/i.test(JUDGE_SYSTEM));
}

// I6: the prompt version is a short hex hash, the same in every process.
{
  check(`prompt version is a 10-char hex hash (${PROMPT_VERSION})`, /^[0-9a-f]{10}$/.test(PROMPT_VERSION));
  const again = execFileSync(process.execPath, [
    ...process.execArgv, "-e", 'import("./src/lib/lab/prompts.ts").then((m) => process.stdout.write(String(m.PROMPT_VERSION ?? m.default?.PROMPT_VERSION)))',
  ], { encoding: "utf8" }).trim();
  check(`prompt version is deterministic across processes (${again})`, again === PROMPT_VERSION);
}

// The judge view carries the new fields, still without map type or arm (spec §6).
{
  const g: MapGraph = {
    mapType: "conceptMap", title: "Signals", legend: [{ tint: "rose", meaning: "Risk" }],
    nodes: [
      { id: "a", label: "Cost overrun", detail: "", role: "concept", kind: "card", parent: "", props: "{}", tint: "rose", emphasis: "strong" },
      { id: "b", label: "Late delivery", detail: "", role: "concept", kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal" },
      { id: "c", label: "New supplier", detail: "", role: "concept", kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal" },
      { id: "d", label: "Client trust", detail: "", role: "concept", kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal" },
    ],
    relations: [
      { from: "a", to: "b", label: "causes", style: "dashed", weight: "strong", direction: "forward" },
      { from: "b", to: "c", label: "pushes", style: "solid", weight: "normal", direction: "both" },
      { from: "c", to: "d", label: "near", style: "dotted", weight: "normal", direction: "none" },
    ],
  };
  const r = renderMap(g);
  const text = judgePrompt(input, { graph: g, elements: r.elements, edges: r.edges });
  const result = text.slice(text.indexOf("RESULT"));
  check("legend line lists tint = meaning", result.includes("Legend: rose = Risk"));
  check("a tinted element shows its legend meaning", /card "Cost overrun[^"]*" \[rose = Risk\]/.test(result));
  check("an untinted element beside a legend shows no tint", !/card "Late delivery[^"]*" \[/.test(result));
  check("strong emphasis shows as emphasised", /card "Cost overrun[^"]*" \[rose = Risk\] emphasised/.test(result));
  check("dashed strong one-way connection", /#\d+ -> #\d+ \[causes\] \(dashed, strong\)/.test(result));
  check("two-way connection", /#\d+ <-> #\d+ \[pushes\]/.test(result));
  check("dotted connection without an arrow", /#\d+ -- #\d+ \[near\] \(dotted\)/.test(result));
  check("legend swatches are not listed as elements", !/shape:circle "Risk"/.test(result) && !/text "Risk"/.test(result));
  check("the new fields reveal no map type", !mentionsMapType(result));
  check("element kinds name tasks and headings",
    elementKind({ type: "freeform", cardType: "task" } as unknown as CanvasElement) === "task" &&
    elementKind({ type: "text", style: { fontSize: 24 } } as unknown as CanvasElement) === "heading");
  // All four nodes are plain cards (zero real headings): with the title
  // excluded, distinctKinds is 1 (card only) and every counted element is a
  // card, not 2 / 4-of-5 as it was while the synthetic title read as a
  // phantom heading.
  const usage = elementUsage(r.elements);
  check(`element usage counts kinds and plain cards, the title excluded (${usage.distinctKinds}, ${usage.plainCardShare.toFixed(2)})`,
    usage.distinctKinds === 1 && Math.abs(usage.plainCardShare - 1) < 1e-9);
}

// Review fix: renderMap's synthetic title (28px, TITLE_FONT_PX) must not be
// mistaken for a real heading node (24px, HEADING_FONT_PX) in either the
// judge-facing text or the element-usage stats.
{
  const noHeading: MapGraph = {
    mapType: "conceptMap", title: "No heading here", legend: [],
    nodes: [
      { id: "a", label: "Root idea", detail: "", role: "concept", kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal" },
      { id: "b", label: "Child idea", detail: "", role: "concept", kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal" },
      { id: "c", label: "Another idea", detail: "", role: "concept", kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal" },
      { id: "d", label: "Fourth idea", detail: "", role: "concept", kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal" },
    ],
    relations: [
      { from: "a", to: "b", label: "leads to", style: "solid", weight: "normal", direction: "forward" },
      { from: "b", to: "c", label: "enables", style: "solid", weight: "normal", direction: "forward" },
      { from: "c", to: "d", label: "needs", style: "solid", weight: "normal", direction: "forward" },
    ],
  };
  const rNo = renderMap(noHeading);
  const textNo = describeRendered(rNo.elements, rNo.edges);
  check("no real heading node: the judge-facing text has no phantom heading line",
    !/\bheading\b/.test(textNo));
  const usageNo = elementUsage(rNo.elements);
  check(`no real heading node: distinctKinds counts only card, not the title (${usageNo.distinctKinds})`,
    usageNo.distinctKinds === 1);

  const withHeading: MapGraph = {
    mapType: "tree", title: "Has a real heading", legend: [],
    nodes: [
      { id: "r", label: "Root", detail: "", role: "root", kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal" },
      { id: "h", label: "Region A", detail: "", role: "branch", kind: "heading", parent: "r", props: "{}", tint: "", emphasis: "normal" },
      { id: "c", label: "Inside A", detail: "", role: "leaf", kind: "card", parent: "h", props: "{}", tint: "", emphasis: "normal" },
    ],
    relations: [],
  };
  const rYes = renderMap(withHeading);
  const textYes = describeRendered(rYes.elements, rYes.edges);
  check("a real heading node is described as heading, exactly once (the 28px title never adds a second)",
    (textYes.match(/\bheading\b/g) || []).length === 1);
  const usageYes = elementUsage(rYes.elements);
  check(`a real heading node adds to distinctKinds but the 28px title does not (${usageYes.distinctKinds})`,
    usageYes.distinctKinds === 2);
}

// Review fix: a task's owner (render.ts's styleNodes puts it only in
// taskMetadata.assignee) must reach the judge, since elementFit explicitly
// credits "owned actions in tasks". Also proves the noteTitle/content dedupe
// (render.ts overwrites content with the task's own label, duplicating
// noteTitle) does not swallow the owner or repeat the label.
{
  const taskGraph: MapGraph = {
    mapType: "radial", title: "Task owner", legend: [],
    nodes: [
      { id: "c", label: "Goal", detail: "", role: "center", kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal" },
      { id: "t", label: "Call the venue", detail: "Before Friday", role: "branch", kind: "task", parent: "", props: '{"owner":"Sam"}', tint: "", emphasis: "normal" },
    ],
    relations: [],
  };
  const rTask = renderMap(taskGraph);
  const taskEl = rTask.elements.find((e) => e.type === "freeform" && e.cardType === "task")!;
  check("elementText surfaces a task's owner (taskMetadata.assignee)", elementText(taskEl).includes("Sam"));
  check("elementText dedupes the task's repeated label (content mirrors noteTitle)",
    (elementText(taskEl).match(/Call the venue/g) || []).length === 1);
  const textTask = describeRendered(rTask.elements, rTask.edges);
  check("describeRendered's judge-facing text includes the task's owner", textTask.includes("Sam"));
}

// The structure judge fails a legend mismatch (a hard violation).
void (async () => {
  const bad: MapGraph = {
    mapType: "radial", title: "Legend", legend: [{ tint: "emerald", meaning: "Unused" }],
    nodes: [
      { id: "c", label: "Hub", detail: "", role: "center", kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal" },
      { id: "x", label: "A", detail: "", role: "branch", kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal" },
      { id: "y", label: "B", detail: "", role: "branch", kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal" },
      { id: "z", label: "C", detail: "", role: "branch", kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal" },
    ],
    relations: [],
  };
  const score = await JUDGES.structure.judge({ input, cell: { graph: bad, elements: [], edges: [] } });
  check("structure judge fails an unused legend entry", score.pass === false && /legend/.test(score.notes));
  if (failures) { console.error(`${failures} FAILED`); process.exit(1); }
  console.log("ALL PASS");
})();
