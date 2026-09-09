// Client service for the Canvas Assistant operations path: build context from
// the LIVE store and call the propose route. Applying lives in
// use-canvas-operations, which needs React context for collaboration sync.

import { useCXDStore } from "@/store/cxd-store";
import { getFullProjectContext, buildCanvasInventory } from "@/utils/ai-context-aggregator";
import type { SanitizedProposal } from "@/types/ai-operations";

export interface ProposeResult {
  success: boolean;
  proposal?: SanitizedProposal;
  error?: string;
}

export async function proposeCanvasOperations(
  instruction: string,
  options: { provider?: string; selectedElementIds?: string[]; groundingText?: string } = {},
): Promise<ProposeResult> {
  try {
    if (!instruction || !instruction.trim()) {
      return { success: false, error: "Instruction is required" };
    }

    // Read through getState() rather than a subscription: this runs on submit,
    // and a stale projection would propose against elements that moved on.
    const state = useCXDStore.getState();
    const project = state.getCurrentProject();
    if (!project) return { success: false, error: "No active project" };

    const elements = project.canvasLayout?.elements || [];
    const edges = project.canvasLayout?.edges || [];
    const projectContext = getFullProjectContext(project, elements, edges);
    const inventory = buildCanvasInventory(elements, options.selectedElementIds || []);

    const fullInstruction = options.groundingText
      ? `${instruction.trim()}\n\nGround the changes on this assistant answer:\n${options.groundingText.slice(0, 6000)}`
      : instruction.trim();

    const response = await fetch("/api/ai/canvas-operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instruction: fullInstruction,
        projectContext,
        inventory,
        provider: options.provider,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || `Request failed (${response.status})` };
    }

    const data = await response.json();
    // Same event the chat path dispatches, so the credit meter refreshes.
    window.dispatchEvent(new CustomEvent("ai-credits-changed"));
    return { success: true, proposal: data.proposal as SanitizedProposal };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}
