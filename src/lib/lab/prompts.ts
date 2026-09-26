// Every prompt the generation arms send, and PROMPT_VERSION: a short stable
// hash of all of them, including the exemplar library's content and the
// selection algorithm. Each cell is stamped with the version it was generated
// under, so a vote traces back to the exact prompts, and the leaderboard can
// count only cells made with the prompts in force now. Server-only (node:crypto).
import { createHash } from "node:crypto";
import { CANVAS_OPERATIONS_GUIDE } from "@/lib/ai/canvas-operations";
import { EXEMPLARS, type Exemplar } from "@/lib/maps/exemplars";
import { libraryHash } from "@/lib/maps/exemplars/derive";
import { selectExemplars, SELECTION_VERSION } from "@/lib/maps/exemplars/select";
import { tooClose } from "@/lib/maps/exemplars/similarity";
import type { ExemplarInput } from "@/lib/maps/exemplars/types";
import { buildMapGuide } from "@/lib/maps/prompt";
import type { MapType } from "@/lib/maps/types";
import { formatInput } from "./format-input";

export const TASK = "Organise this into the clearest thinking map for the canvas.";

export const BASELINE_SYSTEM = "You are the CXD canvas assistant.\n" + CANVAS_OPERATIONS_GUIDE;

export function baselinePrompt(totalCount: number, inventoryJson: string, inputText: string): string {
  return `Canvas inventory (${totalCount} elements total):\n${inventoryJson}` +
    `\n\nSelected element ids: []\n\nInstruction:\n${TASK}\n\n${inputText}`;
}

const inputText = (i: ExemplarInput) => formatInput({ id: "", type: i.type, title: i.title, text: i.text, cards: i.cards, expectedTypes: [] });

/**
 * Up to three examples chosen for this input (spec §4.4), each with the input
 * it came from. An example whose input is too close to this one (same title,
 * or word 3-gram Jaccard >= 0.3) is never shown: it would hand over the answer.
 */
export function exemplarBlock(input: Pick<ExemplarInput, "type" | "title" | "text"> & { cards?: ExemplarInput["cards"] }, forcedType: MapType | null, library: Exemplar[] = EXEMPLARS): string {
  const picked = selectExemplars(library.filter((e) => !tooClose(e.input, input)), input, forcedType);
  return "\n\nEXAMPLES of well-formed graphs, chosen for this kind of input. Learn how each idea got the element that suits it; do not copy their content.\n" +
    picked.map((e) => `Example "${e.title}": ${e.note}\nINPUT:\n${inputText(e.input)}\nGRAPH:\n${JSON.stringify(e.graph)}`).join("\n\n");
}

const CRITIQUE_INSTRUCTION = "Critique the draft, then return a complete improved graph. Check: Is this the best map type for what the input needs? Did each idea get the element that suits its content (tables for numbers, links for sources, tasks for owned actions, frames for scenes)? Are siblings distinct, and do they cover the topic together? Are branches balanced? Are labels short and specific? Are relations labelled where they carry meaning? Does colour carry a meaning listed in the legend? Is anything unfaithful to the input, invented or dropped? Fix every problem.";

export function critiquePrompt(inputTextValue: string, draftJson: string, violations: string[]): string {
  return `${TASK}

${inputTextValue}

YOUR DRAFT:
${draftJson}

${violations.length ? `STRUCTURAL PROBLEMS FOUND:\n- ${violations.join("\n- ")}\n\n` : ""}${CRITIQUE_INSTRUCTION}`;
}

/**
 * Hash of every generation prompt with placeholders for the variable parts.
 * The exemplar block varies by input type, so the library's content hash and
 * the selection version stand for it, plus one sample block for its format.
 * A forced map type only adds one line to the guide; it is stamped on cells
 * separately (Cell.forcedType), so the unforced guide stands for both.
 */
export function computePromptVersion(library: Exemplar[]): string {
  const sampleInput = formatInput({
    id: "", type: "topic", title: "{{TITLE}}", text: "{{TEXT}}", cards: [{ title: "{{CARD}}", body: "{{BODY}}" }], expectedTypes: [],
  });
  const parts = [
    ["task", TASK],
    ["input", sampleInput],
    ["mapGuide", buildMapGuide(null)],
    ["exemplarLibrary", `${libraryHash(library)}|${SELECTION_VERSION}`],
    ["exemplarBlock", exemplarBlock({ type: "topic", title: "{{TITLE}}", text: "{{TEXT}}" }, null, library)],
    ["critique", critiquePrompt("{{INPUT}}", "{{DRAFT}}", ["{{VIOLATION}}"])],
    ["baselineSystem", BASELINE_SYSTEM],
    ["baselinePrompt", baselinePrompt(0, "{{INVENTORY}}", "{{INPUT}}")],
  ];
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 10);
}

export const PROMPT_VERSION = computePromptVersion(EXEMPLARS);
