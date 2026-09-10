/**
 * Canvas Assistant output eval.
 *
 * Runs a corpus of real instructions through the real propose path
 * (generateObject -> sanitizeCanvasOperations -> translateForApply) and scores
 * the resulting layout against the shared rubric in canvas-layout-rules.ts —
 * the same rubric the hand-authored templates must pass.
 *
 * This is a MEASUREMENT tool, not a test: it makes live API calls and costs
 * credits. Run it deliberately when changing a prompt guide or the sanitizer.
 *
 *   npx tsx src/lib/ai/__evals__/canvas-eval.ts                  # claude, full corpus
 *   npx tsx src/lib/ai/__evals__/canvas-eval.ts gemini           # another provider
 *   npx tsx src/lib/ai/__evals__/canvas-eval.ts claude group     # only matching cases
 *   npx tsx src/lib/ai/__evals__/canvas-eval.ts claude "" 3      # N repeats per case
 *
 * Interpreting output: `error` violations are broken canvases (overlaps,
 * escaped containers, dangling refs) and should be zero. `warn` violations are
 * house-style drift from templates.design.md. A rule that fails often is a
 * candidate for promotion out of the prompt and into the sanitizer, where it
 * can be repaired deterministically instead of merely requested.
 */
import fs from "node:fs";
import path from "node:path";
import type { CanvasElement } from "@/types/canvas-elements";
import type { CanvasInventory } from "@/types/ai-operations";

// ─── Fixture canvas: what the model "sees" ──────────────────────────

const el = (
  id: string,
  type: string,
  title: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Record<string, unknown> = {},
): CanvasElement =>
  ({
    id, type, x, y, width, height, zIndex: 1, locked: false,
    boardId: null, surface: "canvas", style: {},
    ...(type === "freeform" ? { cardType: "note", content: "", noteTitle: title } : { content: title }),
    ...extra,
  }) as unknown as CanvasElement;

// Must itself be rubric-clean (asserted at startup) so every violation the eval
// reports is attributable to the AI's changes and not to the fixture.
const EXISTING: CanvasElement[] = [
  el("x1", "container", "Tech Stack", 0, 0, 460, 420, { label: "Tech Stack", tintColor: "violet" }),
  el("x2", "freeform", "AI Note Taker", 40, 80, 300, 300, { containerId: "x1" }),
  el("x3", "freeform", "Mariana's Brain", 0, 480, 300, 300),
  el("x4", "freeform", "Onboarding", 560, 0, 300, 300),
  el("x5", "text", "Project Lifetime", 560, 400, 320, 60),
  el("x6", "shape", "Decision", 960, 0, 80, 80, { shapeType: "diamond" }),
];

const inventory: CanvasInventory = {
  totalCount: EXISTING.length,
  truncated: false,
  selectedIds: ["x3", "x4"],
  elements: EXISTING.map((e) => ({
    id: e.id,
    type: e.type,
    title: (e as unknown as { noteTitle?: string; label?: string; content?: string }).noteTitle
      ?? (e as unknown as { label?: string }).label
      ?? (e as unknown as { content?: string }).content
      ?? e.id,
    x: e.x, y: e.y, width: e.width, height: e.height,
    ...(e.containerId ? { containerId: e.containerId } : {}),
    ...(["x3", "x4"].includes(e.id) ? { selected: true } : {}),
  })),
};

// ─── Corpus ─────────────────────────────────────────────────────────

interface Case {
  name: string;
  instruction: string;
  /** ANY of these row kinds counts as honouring the instruction — there is
   *  usually more than one legitimate strategy (grouping can be a `group`, or
   *  a `create` container plus reparenting `update`s). An empty array asserts
   *  the opposite: this is conversation and must produce NO rows. */
  expectKinds?: string[];
}

const CORPUS: Case[] = [
  { name: "group-selected", instruction: 'put the selected elements into a container called "Experience Core"', expectKinds: ["group", "create"] },
  { name: "create-zone-seeded", instruction: "add a new zone called Peak Moment with three note cards inside it for sensory triggers", expectKinds: ["create"] },
  { name: "create-and-connect", instruction: "add a Research zone and connect it to the Onboarding card", expectKinds: ["create"] },
  { name: "create-flow", instruction: "lay out a 4-stage onboarding flow left to right, each stage a container with a starter note", expectKinds: ["create"] },
  { name: "tag-selected", instruction: "tag the selected elements to the Sensory Domains face", expectKinds: ["tag"] },
  { name: "rename", instruction: 'rename the Onboarding card to "First Contact"', expectKinds: ["update"] },
  { name: "restyle", instruction: "give the Tech Stack zone an ocean tint", expectKinds: ["update"] },
  { name: "add-tasks", instruction: "turn the Mariana's Brain card into two tasks in the Plan tab", expectKinds: ["task"] },
  { name: "add-note", instruction: "add a note to my inbox summarising today's direction", expectKinds: ["note"] },
  { name: "delete", instruction: "delete the Decision shape", expectKinds: ["delete"] },
  { name: "storyboard", instruction: "add a storyboard strip of three frames for the opening sequence", expectKinds: ["create"] },
  { name: "mindmap", instruction: "build a small mind map of five sensory ideas branching from a central hub", expectKinds: ["create"] },
  { name: "conversational", instruction: "what is missing from this canvas?", expectKinds: [] },
  // Element types the assistant used to lack — it previously claimed tables
  // did not exist and faked one out of containers and cards.
  { name: "table", instruction: "use the table element to make a 3x3 comparison table of our tech options", expectKinds: ["create"] },
  { name: "link", instruction: "add a link card pointing to https://cyberdelic.nexus for the research reference", expectKinds: ["create"] },
  { name: "board", instruction: "add a hexagon board portal called Research for deeper material", expectKinds: ["create"] },
  { name: "experience-block", instruction: "anchor an intention core block at the start of the flow", expectKinds: ["create"] },
  { name: "flow-diagram", instruction: "draw a flow diagram: intake, then a decision diamond branching to approve and reject, connected with arrows", expectKinds: ["create"] },
  { name: "review-comments", instruction: "review my canvas and leave comments on what needs work", expectKinds: ["comment"] },
];

// ─── Runner ─────────────────────────────────────────────────────────

async function main() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }

  const provider = (process.argv[2] || "claude") as "claude" | "gemini" | "kimi";
  const filter = (process.argv[3] || "").trim();
  const repeats = Number(process.argv[4] || 1);

  const { generateObject } = await import("ai");
  const { getModelInstance, getModelConfig } = await import("../provider-registry");
  const { canvasOperationsSchema, sanitizeCanvasOperations, CANVAS_OPERATIONS_GUIDE } = await import("../canvas-operations");
  const { translateForApply } = await import("../canvas-operations-executor");
  const { checkLayout, tallyByRule } = await import("@/lib/canvas-layout-rules");

  // Rubric sanity: a refactor that silently stops detecting anything would make
  // every eval look perfect. Prove the checker still bites before trusting it.
  const bad = [
    el("b1", "container", "Zone", 0, 0, 300, 300, { label: "Zone" }),
    el("b2", "freeform", "Card", 10, 10, 300, 300, { containerId: "b1" }),
    el("b3", "freeform", "Other", 20, 20, 300, 300),
  ];
  const sanity = checkLayout(bad, [], { includeDesignSystemRules: true });
  if (!sanity.some((v) => v.rule === "container-bounds") || !sanity.some((v) => v.rule === "overlap")) {
    console.error("RUBRIC SANITY FAILED — checkLayout no longer detects known-bad layouts. Aborting.");
    process.exit(1);
  }
  console.log(`rubric sanity OK (${sanity.length} violations on the known-bad fixture)`);

  const fixtureViolations = checkLayout(EXISTING, [], { includeDesignSystemRules: true });
  if (fixtureViolations.length > 0) {
    console.error("FIXTURE IS NOT CLEAN — the eval would blame the AI for these:");
    for (const v of fixtureViolations) console.error(`  [${v.rule}] ${v.message}`);
    process.exit(1);
  }
  console.log("fixture canvas is rubric-clean\n");

  const cases = CORPUS.filter((c) => !filter || c.name.includes(filter) || c.instruction.includes(filter));
  const modelConfig = getModelConfig(provider, "analysis");
  const model = getModelInstance(provider, "analysis");
  console.log(`provider=${provider} model=${modelConfig.modelId} cases=${cases.length} repeats=${repeats}\n`);

  const systemPrompt = "You are the CXD canvas assistant.\n" + CANVAS_OPERATIONS_GUIDE;
  const totals = new Map<string, number>();
  let runs = 0, apiFailures = 0, emptyProposals = 0, missedIntent = 0, errorRuns = 0;

  for (const c of cases) {
    for (let rep = 0; rep < repeats; rep++) {
      runs++;
      const userPrompt =
        `Canvas inventory (${inventory.totalCount} elements total):\n${JSON.stringify(inventory.elements)}` +
        `\n\nSelected element ids: ${JSON.stringify(inventory.selectedIds)}` +
        `\n\nInstruction:\n${c.instruction}`;

      let proposal;
      try {
        const result = await generateObject({
          model, system: systemPrompt, prompt: userPrompt,
          schema: canvasOperationsSchema,
          maxOutputTokens: modelConfig.maxTokens,
          ...(modelConfig.isReasoning ? {} : { temperature: 0.3 }),
        });
        proposal = sanitizeCanvasOperations(result.object, inventory);
      } catch (e) {
        apiFailures++;
        console.log(`✗ ${c.name}: API ERROR — ${String((e as Error).message).slice(0, 110)}`);
        continue;
      }

      const kinds = new Set<string>([...proposal.rows.map((r) => r.kind)]);
      const wanted = c.expectKinds ?? [];
      const honoured = wanted.length === 0 ? proposal.rows.length === 0 : wanted.some((k) => kinds.has(k));
      if (!honoured) missedIntent++;
      if (proposal.rows.length === 0 && wanted.length > 0) emptyProposals++;

      // Apply every row, then audit the canvas as it would ACTUALLY look after
      // Apply. Materialising matters: a `group` reparents existing elements via
      // updates, and without applying those the new container reads as
      // overlapping the very elements it wraps.
      const allRowIds = new Set(proposal.rows.map((r) => r.rowId));
      const plan = translateForApply(proposal, allRowIds, EXISTING, []);
      const removed = new Set(plan.batch.removeElementIds);
      const updateMap = new Map(plan.batch.updates.map((u) => [u.id, u.updates]));
      const after: CanvasElement[] = [
        ...EXISTING.filter((e) => !removed.has(e.id)).map((e) =>
          updateMap.has(e.id) ? ({ ...e, ...updateMap.get(e.id) } as CanvasElement) : e,
        ),
        ...plan.batch.addElements,
      ];
      const created = plan.batch.addElements;
      const violations = checkLayout(after, plan.batch.addEdges, { includeDesignSystemRules: true });
      const errors = violations.filter((v) => v.severity === "error");
      if (errors.length > 0) errorRuns++;
      for (const [rule, n] of Array.from(tallyByRule(violations))) {
        totals.set(rule, (totals.get(rule) ?? 0) + n);
      }

      const mark = !honoured ? "✗" : errors.length ? "!" : "✓";
      const detail = [
        `${proposal.rows.length} rows`,
        `${created.length} new`,
        proposal.droppedCount ? `${proposal.droppedCount} dropped` : "",
        errors.length ? `${errors.length} ERR` : "",
        violations.length - errors.length ? `${violations.length - errors.length} warn` : "",
      ].filter(Boolean).join(", ");
      console.log(`${mark} ${c.name.padEnd(20)} ${detail}`);
      for (const v of errors.slice(0, 3)) console.log(`    ERROR [${v.rule}] ${v.message.slice(0, 130)}`);
      const warnRules = Array.from(new Set(violations.filter((v) => v.severity === "warn").map((v) => v.rule)));
      if (warnRules.length) console.log(`    warn: ${warnRules.join(", ")}`);
    }
  }

  console.log(`\n${"─".repeat(64)}\nRUNS ${runs}  |  intent missed ${missedIntent}  |  empty ${emptyProposals}  |  API errors ${apiFailures}  |  runs with layout errors ${errorRuns}`);
  const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    console.log("no rule violations across the corpus");
  } else {
    console.log("\nviolations by rule (most frequent first — top entries are the best candidates\nfor promotion from prompt text into deterministic sanitizer repair):");
    for (const [rule, n] of sorted) console.log(`  ${String(n).padStart(4)}  ${rule}`);
  }
}

main();
