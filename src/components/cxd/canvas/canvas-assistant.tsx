"use client";

// Canvas Assistant: floating launcher (bottom-right, CXD logo inside an
// animated gradient ring) plus the docked AIChatPanel in canvas mode.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AIChatPanel } from "./ai-chat-panel";
import { useCXDStore } from "@/store/cxd-store";
import { cn } from "@/lib/utils";

const CANVAS_ASSISTANT_HUE = 265;

interface CanvasAssistantProps {
  selectedElementIds: string[];
}

export function CanvasAssistant({ selectedElementIds }: CanvasAssistantProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const projectId = useCXDStore((s) => s.currentProjectId);

  // Portal target only exists in the browser; render nothing during SSR.
  useEffect(() => setMounted(true), []);

  if (!projectId || !mounted) return null;

  // Portaled to <body> on purpose. The canvas container is
  // `fixed inset-0 top-16 ... h-full`, so its box overhangs the viewport and
  // its overflow-hidden clips bottom-anchored children — and its height shifts
  // as panels open, which dragged this launcher up the screen. Anchoring to the
  // viewport from outside that subtree makes the position unconditional.
  return createPortal(
    // z sits above canvas chrome (toolkits, inbox) but below modals/expanded
    // chat (z-[120]). The layer is click-through except for its two children.
    <div className="fixed inset-0 z-[80] pointer-events-none">
      {open && (
        <div className="pointer-events-auto absolute bottom-24 right-6 w-[420px] max-w-[calc(100vw-48px)]">
          <AIChatPanel
            faceKey="canvas"
            projectId={projectId}
            accentHue={CANVAS_ASSISTANT_HUE}
            faceName="Canvas Assistant"
            semanticRole="Acts on your canvas, inbox, and plan"
            faceGlyph={null}
            sizeVariant="assistant"
            onClose={() => setOpen(false)}
            canvasOps={{ selectedElementIds }}
          />
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        data-tour-id="canvas-assistant-launcher"
        className={cn(
          "pointer-events-auto absolute bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center",
          "transition-transform hover:scale-105 active:scale-95",
        )}
        title={open ? "Close Canvas Assistant" : "Canvas Assistant"}
        style={{
          background: "hsl(var(--card) / 0.95)",
          boxShadow: open
            ? "0 0 0 2px hsl(265 70% 60% / 0.9), 0 0 24px 4px hsl(265 70% 58% / 0.35)"
            : "0 6px 20px -6px rgba(0,0,0,0.6)",
        }}
      >
        {/* Conic gradient ring, masked to an outline. Pulses only while closed
            so it reads as an invitation, not as activity during a conversation. */}
        <span
          aria-hidden
          className={cn("absolute inset-0 rounded-full", !open && "animate-pulse")}
          style={{
            padding: 2,
            background:
              "conic-gradient(from 140deg, hsl(265 75% 62%), hsl(190 80% 55%), hsl(320 70% 60%), hsl(265 75% 62%))",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
        <Image
          src="/images/CXD Logo 2.png"
          alt=""
          width={30}
          height={30}
          className="object-contain relative"
        />
      </button>
    </div>,
    document.body,
  );
}
