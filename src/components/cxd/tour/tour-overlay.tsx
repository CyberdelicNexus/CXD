"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useCXDStore } from "@/store/cxd-store";
import { TOUR_STEPS } from "@/lib/tour-steps";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_MAX_WIDTH = 320;
const CUTOUT_PADDING = 8;
const GLOW_SPREAD = 6;
const TOOLTIP_OFFSET = 16;

export function TourOverlay() {
  const tourActive = useCXDStore((s) => s.tourActive);
  const tourId = useCXDStore((s) => s.tourId);
  const tourStep = useCXDStore((s) => s.tourStep);
  const nextTourStep = useCXDStore((s) => s.nextTourStep);
  const prevTourStep = useCXDStore((s) => s.prevTourStep);
  const skipTour = useCXDStore((s) => s.skipTour);

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prevStepRef = useRef(tourStep);
  const measureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track mount for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const steps = tourId ? TOUR_STEPS[tourId] : [];
  const currentStep = steps[tourStep] ?? null;

  // Track how long we've been polling for a missing/zero-size target
  const missingTargetCountRef = useRef(0);

  // Execute preAction before measuring
  const preActionExecutedRef = useRef<string | null>(null);

  // Measure target element position
  const measureTarget = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    // Execute preAction once per step
    if (currentStep.preAction && preActionExecutedRef.current !== `${tourStep}-${currentStep.preAction}`) {
      preActionExecutedRef.current = `${tourStep}-${currentStep.preAction}`;
      if (currentStep.preAction === 'expandNavbar') {
        document.dispatchEvent(new CustomEvent('tour-expand-navbar'));
      }
    }
    const el = document.querySelector(`[data-tour-id="${currentStep.targetId}"]`);
    if (el) {
      // Debug: log what we found and where it is
      const r = el.getBoundingClientRect();
      console.log(`[Tour] Step ${tourStep}/${steps.length} "${currentStep.title}" target="${currentStep.targetId}" rect:`, {
        top: Math.round(r.top), left: Math.round(r.left),
        width: Math.round(r.width), height: Math.round(r.height),
        tagName: el.tagName, id: (el as HTMLElement).id,
      });
      // Scroll element into view if it's outside the viewport (skip for
      // canvas elements that are positioned via CSS transforms)
      const isOffscreen =
        r.bottom < 0 ||
        r.top > window.innerHeight ||
        r.right < 0 ||
        r.left > window.innerWidth;
      if (isOffscreen) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }

      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        missingTargetCountRef.current = 0;
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      } else {
        // Element found but zero-size
        missingTargetCountRef.current++;
        if (!currentStep.waitForTarget && missingTargetCountRef.current > 4) {
          missingTargetCountRef.current = 0;
          nextTourStep();
        }
        // If waitForTarget, keep polling — element might appear later
      }
    } else {
      // Element not found
      missingTargetCountRef.current++;
      if (!currentStep.waitForTarget && missingTargetCountRef.current > 4) {
        missingTargetCountRef.current = 0;
        nextTourStep();
      }
      // If waitForTarget, keep polling with null rect (shows wait message)
      setTargetRect(null);
    }
  }, [currentStep, nextTourStep, tourStep]);

  // Re-measure on step change, resize, scroll
  useEffect(() => {
    if (!tourActive || !currentStep) return;

    // Reset missing-target counter on step change
    missingTargetCountRef.current = 0;

    // Transition animation between steps
    const isNewStep = prevStepRef.current !== tourStep;
    if (isNewStep) {
      setIsTransitioning(true);
      prevStepRef.current = tourStep;
    }

    // Measure after brief fade for new steps, immediately for same step
    const delay = isNewStep ? 200 : 0;
    const startTimer = setTimeout(() => {
      if (isNewStep) setIsTransitioning(false);
      measureTarget();
      // Start polling — needed for waitForTarget steps and dynamic elements
      measureIntervalRef.current = setInterval(measureTarget, 500);
    }, delay);

    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);

    return () => {
      clearTimeout(startTimer);
      if (measureIntervalRef.current) {
        clearInterval(measureIntervalRef.current);
      }
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [tourActive, currentStep, tourStep, measureTarget]);

  // Keyboard support
  useEffect(() => {
    if (!tourActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        skipTour();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        nextTourStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        prevTourStep();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [tourActive, nextTourStep, prevTourStep, skipTour]);

  if (!mounted || !tourActive || !tourId || !currentStep) return null;

  // Calculate clip-path polygon for the overlay with transparent cutout
  const getClipPath = () => {
    if (!targetRect) return "none";
    const p = CUTOUT_PADDING;
    const t = targetRect.top - p;
    const l = targetRect.left - p;
    const r = targetRect.left + targetRect.width + p;
    const b = targetRect.top + targetRect.height + p;
    // Polygon that covers the full viewport except for the cutout rectangle
    return `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${l}px ${t}px, ${l}px ${b}px, ${r}px ${b}px, ${r}px ${t}px, ${l}px ${t}px
    )`;
  };

  // Resolve final tooltip position — with auto-flip and viewport clamping
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      // Center of screen if no target found
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: TOOLTIP_MAX_WIDTH,
      };
    }

    const margin = 16; // minimum distance from viewport edges
    const estimatedTooltipHeight = 200; // conservative estimate for clamping
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Determine effective position — flip if preferred side has no room
    let pos = currentStep.position;
    const spaceTop = targetRect.top;
    const spaceBottom = vh - targetRect.top - targetRect.height;
    const spaceLeft = targetRect.left;
    const spaceRight = vw - targetRect.left - targetRect.width;
    const neededHoriz = TOOLTIP_MAX_WIDTH + TOOLTIP_OFFSET + margin;
    const neededVert = estimatedTooltipHeight + TOOLTIP_OFFSET + margin;

    if (pos === "right" && spaceRight < neededHoriz) pos = spaceLeft >= neededHoriz ? "left" : "bottom";
    else if (pos === "left" && spaceLeft < neededHoriz) pos = spaceRight >= neededHoriz ? "right" : "bottom";
    else if (pos === "bottom" && spaceBottom < neededVert) pos = spaceTop >= neededVert ? "top" : "right";
    else if (pos === "top" && spaceTop < neededVert) pos = spaceBottom >= neededVert ? "bottom" : "right";

    const style: React.CSSProperties = {
      position: "fixed",
      maxWidth: TOOLTIP_MAX_WIDTH,
    };

    switch (pos) {
      case "top": {
        style.bottom = vh - targetRect.top + TOOLTIP_OFFSET;
        // Center on target, then clamp so tooltip doesn't go off-screen
        const topCenterX = targetRect.left + targetRect.width / 2 - TOOLTIP_MAX_WIDTH / 2;
        style.left = Math.max(margin, Math.min(topCenterX, vw - TOOLTIP_MAX_WIDTH - margin));
        break;
      }
      case "bottom": {
        style.top = targetRect.top + targetRect.height + TOOLTIP_OFFSET;
        const bottomCenterX = targetRect.left + targetRect.width / 2 - TOOLTIP_MAX_WIDTH / 2;
        style.left = Math.max(margin, Math.min(bottomCenterX, vw - TOOLTIP_MAX_WIDTH - margin));
        break;
      }
      case "left": {
        const leftCenterY = targetRect.top + targetRect.height / 2 - estimatedTooltipHeight / 2;
        style.top = Math.max(margin, Math.min(leftCenterY, vh - estimatedTooltipHeight - margin));
        style.right = vw - targetRect.left + TOOLTIP_OFFSET;
        break;
      }
      case "right": {
        const rightCenterY = targetRect.top + targetRect.height / 2 - estimatedTooltipHeight / 2;
        style.top = Math.max(margin, Math.min(rightCenterY, vh - estimatedTooltipHeight - margin));
        style.left = Math.min(targetRect.left + targetRect.width + TOOLTIP_OFFSET, vw - TOOLTIP_MAX_WIDTH - margin);
        break;
      }
    }

    return style;
  };

  // Glow ring style around the cutout
  const getGlowStyle = (): React.CSSProperties | null => {
    if (!targetRect) return null;
    const p = CUTOUT_PADDING + GLOW_SPREAD;
    return {
      position: "fixed",
      top: targetRect.top - p,
      left: targetRect.left - p,
      width: targetRect.width + p * 2,
      height: targetRect.height + p * 2,
      borderRadius: 8,
      boxShadow: "0 0 0 3px rgba(139,92,246,0.4), 0 0 20px rgba(139,92,246,0.3), 0 0 40px rgba(139,92,246,0.15)",
      pointerEvents: "none" as const,
      zIndex: 100001,
    };
  };

  const glowStyle = getGlowStyle();

  const overlay = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        fontFamily: "Inter, system-ui, sans-serif",
        transition: "opacity 300ms ease",
        opacity: isTransitioning ? 0.6 : 1,
        pointerEvents: "none",
      }}
    >
      {/* Dark overlay with cutout — visual only, does NOT block pointer events */}
      {!(currentStep.waitForTarget && !targetRect) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            clipPath: getClipPath(),
            transition: "clip-path 300ms ease",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Purple gradient glow around cutout with rounded corners */}
      {targetRect && (
        <div
          style={{
            position: "fixed",
            top: targetRect.top - CUTOUT_PADDING - GLOW_SPREAD,
            left: targetRect.left - CUTOUT_PADDING - GLOW_SPREAD,
            width: targetRect.width + (CUTOUT_PADDING + GLOW_SPREAD) * 2,
            height: targetRect.height + (CUTOUT_PADDING + GLOW_SPREAD) * 2,
            borderRadius: 12,
            border: "1.5px solid rgba(139,92,246,0.4)",
            background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(168,85,247,0.04))",
            boxShadow: "0 0 20px rgba(139,92,246,0.25), 0 0 40px rgba(139,92,246,0.1), inset 0 0 20px rgba(139,92,246,0.05)",
            pointerEvents: "none",
            zIndex: 100001,
            transition: "all 300ms ease",
          }}
        />
      )}

      {/* Clickable pass-through area over the highlighted element */}
      {targetRect && (
        <div
          style={{
            position: "fixed",
            top: targetRect.top - CUTOUT_PADDING,
            left: targetRect.left - CUTOUT_PADDING,
            width: targetRect.width + CUTOUT_PADDING * 2,
            height: targetRect.height + CUTOUT_PADDING * 2,
            borderRadius: 12,
            zIndex: 100001,
            // Let clicks pass through to the actual UI element beneath
            pointerEvents: "none",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        style={{
          ...getTooltipStyle(),
          zIndex: 100002,
          pointerEvents: "auto",
          transition: "all 300ms ease",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #0a0412 0%, #1a0f2e 50%, #1e1040 100%)",
            border: "1px solid rgba(139,92,246,0.3)",
            borderRadius: 12,
            padding: "20px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(139,92,246,0.15)",
            color: "white",
          }}
        >
          {/* Title */}
          <h3
            style={{
              margin: 0,
              marginBottom: 8,
              fontSize: 15,
              fontWeight: 600,
              color: "rgba(255,255,255,0.95)",
            }}
          >
            {currentStep.title}
          </h3>

          {/* Content — show wait message if target not found and waitForTarget is set */}
          <p
            style={{
              margin: 0,
              marginBottom: 16,
              fontSize: 13,
              lineHeight: 1.5,
              color: !targetRect && currentStep.waitForTarget ? "rgba(192,132,252,0.9)" : "rgba(255,255,255,0.7)",
            }}
          >
            {!targetRect && currentStep.waitForTarget && currentStep.waitMessage
              ? currentStep.waitMessage
              : currentStep.content}
          </p>

          {/* Step dots and buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Step dots */}
            <div style={{ display: "flex", gap: 5 }}>
              {steps.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor:
                      i === tourStep
                        ? "rgb(139,92,246)"
                        : "rgba(255,255,255,0.2)",
                    transition: "background-color 300ms ease",
                  }}
                />
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              {tourStep > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    prevTourStep();
                  }}
                  style={{
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "transparent",
                    color: "rgba(255,255,255,0.7)",
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  skipTour();
                }}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                }}
              >
                Skip
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('[Tour] NEXT clicked, advancing from step', tourStep);
                  nextTourStep();
                }}
                style={{
                  padding: "5px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "none",
                  background: "linear-gradient(135deg, rgb(139,92,246), rgb(109,40,217))",
                  color: "white",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(139,92,246,0.4)",
                }}
              >
                {tourStep === steps.length - 1 ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
