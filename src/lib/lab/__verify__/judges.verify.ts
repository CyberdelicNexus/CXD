// Run: npx tsx src/lib/lab/__verify__/judges.verify.ts
// Offline. I7: the LLM judges see every arm the same way, described from the
// rendered elements and edges, with no mapType or arm metadata. I6: the prompt
// version is a short, deterministic hash.
import { execFileSync } from "node:child_process";
import { auditSchemaForAnthropic } from "@/lib/ai/schema-guards";
import { EXEMPLARS } from "@/lib/maps/exemplars";
import { MAP_TYPES } from "@/lib/maps/types";
import { renderMap } from "@/lib/maps/render";
import type { CanvasElement } from "@/types/canvas-elements";
import { CORPUS } from "../corpus";
import { describeRendered, elementText } from "../describe";
import { cardsAsElements } from "../format-input";
import { judgePrompt, judgeSchema } from "../judges";
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
  if (r.edges.length > 0) check(`${ex.graph.mapType}: connections listed as "#a -> #b"`, /#\d+ -> #\d+/.test(result));
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
  check("judge schema keeps its fields", Object.keys(judgeSchema.shape).sort().join(",") ===
    "actionability,balance,clarity,faithfulness,notes,relations,typeFit");
}

// I6: the prompt version is a short hex hash, the same in every process.
{
  check(`prompt version is a 10-char hex hash (${PROMPT_VERSION})`, /^[0-9a-f]{10}$/.test(PROMPT_VERSION));
  const again = execFileSync(process.execPath, [
    ...process.execArgv, "-e", 'import("./src/lib/lab/prompts.ts").then((m) => process.stdout.write(String(m.PROMPT_VERSION ?? m.default?.PROMPT_VERSION)))',
  ], { encoding: "utf8" }).trim();
  check(`prompt version is deterministic across processes (${again})`, again === PROMPT_VERSION);
}

if (failures) { console.error(`${failures} FAILED`); process.exit(1); }
console.log("ALL PASS");
