"use client";

// Canvas Assistant: floating launcher (bottom-right, CXD logo inside an
// animated gradient ring) plus the docked AIChatPanel in canvas mode.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AIChatPanel } from "./ai-chat-panel";
import { useCXDStore } from "@/store/cxd-store";
import { useAssistantActive } from "@/lib/ai/assistant-build";
import { cn } from "@/lib/utils";

const CANVAS_ASSISTANT_HUE = 265;

interface CanvasAssistantProps {
  selectedElementIds: string[];
}

export function CanvasAssistant({ selectedElementIds }: CanvasAssistantProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const projectId = useCXDStore((s) => s.currentProjectId);

  // The icon is the app's hypercube loading animation, held still. It only
  // moves while hovered or while the assistant is answering, designing or
  // building, so motion on the canvas always means something is happening.
  const [hovered, setHovered] = useState(false);
  const working = useAssistantActive();
  const cubeRef = useRef<HTMLVideoElement>(null);
  const animate = hovered || working;
  useEffect(() => {
    const cube = cubeRef.current;
    if (!cube) return;
    if (animate && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      // play() rejects if it is interrupted by a pause; that is expected here.
      void cube.play().catch(() => {});
    } else {
      cube.pause();
    }
  }, [animate, mounted]);

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
        <div className="pointer-events-auto absolute bottom-20 right-3 w-[420px] max-w-[calc(100vw-24px)]">
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
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        data-tour-id="canvas-assistant-launcher"
        className={cn(
          // Centred on the experience-inspector rail's column: that rail is a
          // 64px-wide strip flush right (px-3 + w-10 buttons), so its centre
          // line is 32px in. A 48px button at right-2 shares that centre while
          // standing a little larger than the rail's own buttons.
          "pointer-events-auto absolute bottom-6 right-2 w-12 h-12 rounded-full flex items-center justify-center",
          "transition-transform hover:scale-105 active:scale-95",
        )}
        title={open ? "Close Canvas Assistant" : "Canvas Assistant"}
        style={{
          background: "hsl(var(--card) / 0.95)",
          boxShadow: working
            ? "0 0 0 2px hsl(190 80% 55% / 0.9), 0 0 26px 6px hsl(265 70% 58% / 0.5)"
            : open
              ? "0 0 0 2px hsl(265 70% 60% / 0.9), 0 0 24px 4px hsl(265 70% 58% / 0.35)"
              : "0 6px 20px -6px rgba(0,0,0,0.6)",
        }}
      >
        {/* Conic gradient ring, masked to an outline. Pulses only while closed
            so it reads as an invitation, not as activity during a conversation. */}
        <span
          aria-hidden
          className={cn("absolute inset-0 rounded-full", working && "animate-spin [animation-duration:2.4s]")}
          style={{
            padding: 2,
            background:
              "conic-gradient(from 140deg, hsl(265 75% 62%), hsl(190 80% 55%), hsl(320 70% 60%), hsl(265 75% 62%))",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
        {/* #t=0.1 makes the browser paint a frame while paused; without it a
            video that has never played shows nothing. Screen blending drops the
            clip's black background, as on the loading screens. */}
        <video
          ref={cubeRef}
          src="/images/loading-animation.mp4#t=0.1"
          width={40}
          height={40}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          className="pointer-events-none relative h-10 w-10 rounded-full object-contain"
          style={{ mixBlendMode: "screen" }}
        />
      </button>
    </div>,
    document.body,
  );
}
