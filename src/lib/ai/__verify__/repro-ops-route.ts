// Reproduction harness (not a verify script — makes a real API call).
// Run: npx tsx src/lib/ai/__verify__/repro-ops-route.ts
// Exercises the exact generateObject call the canvas-operations route makes.
import fs from "node:fs";
import path from "node:path";

// Simulate a REAL canvas: `npx tsx ... 5` (small) vs `... 120` (realistic).
const BULK = Number(process.argv[2] || 5);

const selected = [
  { id: "a1", type: "freeform", title: "Sensory Layer", x: 100, y: 100, width: 300, height: 140, selected: true },
  { id: "a2", type: "freeform", title: "Peak Moment", x: 440, y: 100, width: 300, height: 140, selected: true },
  { id: "a3", type: "freeform", title: "Onboarding", x: 780, y: 100, width: 300, height: 140, selected: true },
  { id: "a4", type: "text", title: "Tech requirements", x: 100, y: 300, width: 300, height: 80, selected: true },
  { id: "a5", type: "shape", title: "Decision", x: 440, y: 300, width: 80, height: 80, selected: true },
];
const filler = Array.from({ length: Math.max(0, BULK - 5) }, (_, i) => ({
  id: `f${i}`,
  type: i % 3 === 0 ? "container" : i % 3 === 1 ? "freeform" : "text",
  title: `Existing element ${i} — a realistic multi-word card title about the experience`,
  x: 100 + (i % 8) * 340,
  y: 500 + Math.floor(i / 8) * 200,
  width: 300,
  height: 140,
  ...(i % 5 === 0 ? { tags: ["Sensory Domains"] } : {}),
}));

const inventory = {
  totalCount: 5 + filler.length,
  truncated: false,
  selectedIds: ["a1", "a2", "a3", "a4", "a5"],
  elements: [...selected, ...filler],
};

async function main() {
  // Load .env.local BEFORE importing anything that reads process.env at module scope.
  const envPath = path.resolve(process.cwd(), ".env.local");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }

  const { generateObject } = await import("ai");
  const { getModelInstance, getModelConfig } = await import("../provider-registry");
  const { canvasOperationsSchema, sanitizeCanvasOperations, CANVAS_OPERATIONS_GUIDE } =
    await import("../canvas-operations");

  const providerArg = (process.argv[3] || "gemini") as "gemini" | "claude" | "kimi";
  const modelConfig = getModelConfig(providerArg, "analysis");
  const model = getModelInstance(providerArg, "analysis");
  console.log(`provider=${providerArg} tierModel=${modelConfig.modelId} maxTokens=${modelConfig.maxTokens} isReasoning=${modelConfig.isReasoning}`);

  const systemPrompt = "You are the CXD canvas assistant.\n" + CANVAS_OPERATIONS_GUIDE;
  const userPrompt =
    `Canvas inventory (${inventory.totalCount} elements total):\n` +
    JSON.stringify(inventory.elements) +
    `\n\nSelected element ids: ${JSON.stringify(inventory.selectedIds)}` +
    `\n\nInstruction:\n${process.argv[4] || 'put the selected elements into a container called "Experience Core"'}`;

  try {
    const result = await generateObject({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      schema: canvasOperationsSchema,
      maxOutputTokens: modelConfig.maxTokens,
      temperature: 0.3,
    });
    console.log("\nRAW OBJECT:\n", JSON.stringify(result.object, null, 2).slice(0, 2500));
    const proposal = sanitizeCanvasOperations(result.object, inventory as never);
    console.log("\nSANITIZED rows:", proposal.rows.length, "ops:", proposal.ops.length, "dropped:", proposal.droppedCount);
    console.log(JSON.stringify(proposal.rows, null, 2));
  } catch (e) {
    const err = e as Error & { cause?: unknown; text?: string };
    console.error("\n*** THREW ***");
    console.error("name:", err.name);
    console.error("message:", String(err.message).slice(0, 1500));
    if (err.text) console.error("model text:", String(err.text).slice(0, 1200));
    if (err.cause) console.error("cause:", String((err.cause as Error)?.message ?? err.cause).slice(0, 1500));
  }
}

main();
