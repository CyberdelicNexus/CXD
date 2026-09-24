// Every prompt the generation arms send, and PROMPT_VERSION: a short stable
// hash of all of them. Each cell is stamped with the version it was generated
// under, so a vote traces back to the exact prompts, and the leaderboard can
// count only cells made with the prompts in force now. Server-only (node:crypto).
import { createHash } from "node:crypto";
import { CANVAS_OPERATIONS_GUIDE } from "@/lib/ai/canvas-operations";
import { EXEMPLARS } from "@/lib/maps/exemplars";
import { buildMapGuide } from "@/lib/maps/prompt";
import { formatInput } from "./format-input";

export const TASK = "Organise this into the clearest thinking map for the canvas.";

export const BASELINE_SYSTEM = "You are the CXD canvas assistant.\n" + CANVAS_OPERATIONS_GUIDE;

export function baselinePrompt(totalCount: number, inventoryJson: string, inputText: string): string {
  return `Canvas inventory (${totalCount} elements total):\n${inventoryJson}` +
    `\n\nSelected element ids: []\n\nInstruction:\n${TASK}\n\n${inputText}`;
}

export function exemplarBlock(): string {
  return "\n\nEXAMPLES of well-formed graphs:\n" +
    EXEMPLARS.map((e) => `${e.note}\n${JSON.stringify(e.graph)}`).join("\n\n");
}

const CRITIQUE_INSTRUCTION = "Critique the draft, then return a complete improved graph. Check: Is this the best map type for what the input needs? Are siblings distinct, and do they cover the topic together? Are branches balanced? Are labels short and specific? Are relations labelled where they carry meaning? Is anything unfaithful to the input, invented or dropped? Fix every problem.";

export function critiquePrompt(inputText: string, draftJson: string, violations: string[]): string {
  return `${TASK}

${inputText}

YOUR DRAFT:
${draftJson}

${violations.length ? `STRUCTURAL PROBLEMS FOUND:\n- ${violations.join("\n- ")}\n\n` : ""}${CRITIQUE_INSTRUCTION}`;
}

/**
 * Hash of every generation prompt with placeholders for the variable parts.
 * A forced map type only adds one line to the guide; it is stamped on cells
 * separately (Cell.forcedType), so the unforced guide stands for both.
 */
function computePromptVersion(): string {
  const sampleInput = formatInput({
    id: "", type: "topic", title: "{{TITLE}}", text: "{{TEXT}}", cards: [{ title: "{{CARD}}", body: "{{BODY}}" }], expectedTypes: [],
  });
  const parts = [
    ["task", TASK],
    ["input", sampleInput],
    ["mapGuide", buildMapGuide(null)],
    ["exemplars", exemplarBlock()],
    ["critique", critiquePrompt("{{INPUT}}", "{{DRAFT}}", ["{{VIOLATION}}"])],
    ["baselineSystem", BASELINE_SYSTEM],
    ["baselinePrompt", baselinePrompt(0, "{{INVENTORY}}", "{{INPUT}}")],
  ];
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 10);
}

export const PROMPT_VERSION = computePromptVersion();
