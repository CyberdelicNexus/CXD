"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Face colors from FACE_IDENTITY mapping
const FACE_COLORS: Record<string, string> = {
  realityPlanes: "hsl(286 72% 52%)",
  sensoryDomains: "hsl(45 84% 54%)",
  presence: "hsl(195 78% 55%)",
  stateMapping: "hsl(160 70% 48%)",
  traitMapping: "hsl(260 72% 58%)",
  contextAndMeaning: "hsl(320 72% 56%)"
};

// Same hues as FACE_COLORS, decomposed so we can build a glossy two-stop
// gradient (lighter highlight -> deeper shade) per face instead of a flat fill.
const FACE_HSL: Record<string, { h: number; s: number; l: number }> = {
  realityPlanes: { h: 286, s: 72, l: 52 },
  sensoryDomains: { h: 45, s: 84, l: 54 },
  presence: { h: 195, s: 78, l: 55 },
  stateMapping: { h: 160, s: 70, l: 48 },
  traitMapping: { h: 260, s: 72, l: 58 },
  contextAndMeaning: { h: 320, s: 72, l: 56 }
};

function getFaceGradient(faceId: string): string {
  const c = FACE_HSL[faceId];
  if (!c) return FACE_COLORS[faceId];
  const light = `hsl(${c.h} ${Math.min(c.s + 8, 100)}% ${Math.min(c.l + 16, 88)}%)`;
  const mid = `hsl(${c.h} ${c.s}% ${c.l}%)`;
  const dark = `hsl(${c.h} ${Math.min(c.s + 6, 100)}% ${Math.max(c.l - 22, 8)}%)`;
  return `linear-gradient(135deg, ${light} 0%, ${mid} 45%, ${dark} 100%)`;
}

interface FaceCompletion {
  faceId: string;
  completion: number;
  isActive: boolean; // completion > 0.25
}

interface DesignOverviewCardProps {
  faceCompletions: Record<string, number>; // { realityPlanes: 0.78, ... }
  onRefresh: () => void;
  lastRefreshTime: number;
  className?: string;
}

function getOverviewText(activeFaces: FaceCompletion[], allFaces: FaceCompletion[]): string {
  const activeCount = activeFaces.length;
  const strongestFace = activeFaces.reduce((max, face) =>
    face.completion > max.completion ? face : max
  , activeFaces[0] || { faceId: '', completion: 0 });

  const weakCount = allFaces.filter(f => !f.isActive).length;
  const strongFaceName = getFaceName(strongestFace.faceId);
  const strongPct = Math.round(strongestFace.completion * 100);

  if (activeCount === 0 || activeCount === 1) {
    return "Your experience is just getting started. Focus on one face to build a foundation.";
  } else if (activeCount === 2 || activeCount === 3) {
    return `Your experience covers ${activeCount} of 6 faces. ${strongFaceName} is your strongest at ${strongPct}%. ${weakCount} ${weakCount === 1 ? 'face needs' : 'faces need'} attention.`;
  } else if (activeCount === 4 || activeCount === 5) {
    const weakestActive = activeFaces.reduce((min, face) =>
      face.completion < min.completion ? face : min
    , activeFaces[0]);
    const weakestName = getFaceName(weakestActive.faceId);
    const weakestPct = Math.round(weakestActive.completion * 100);
    return `Strong progress: ${activeCount} of 6 faces are active. Consider deepening ${weakestName} (${weakestPct}%) to round out your design.`;
  } else {
    return "All 6 faces are active! Focus on coherence and cross-face connections to elevate your design.";
  }
}

function getFaceName(faceId: string): string {
  const names: Record<string, string> = {
    realityPlanes: "Reality Planes",
    sensoryDomains: "Sensory Domains",
    presence: "Presence",
    stateMapping: "State Mapping",
    traitMapping: "Trait Mapping",
    contextAndMeaning: "Meaning Architecture"
  };
  return names[faceId] || faceId;
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin === 1) return "1m ago";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours === 1) return "1h ago";
  if (diffHours < 24) return `${diffHours}h ago`;

  return "1d+ ago";
}

export function DesignOverviewCard({
  faceCompletions,
  onRefresh,
  lastRefreshTime,
  className
}: DesignOverviewCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [relativeTime, setRelativeTime] = useState(getRelativeTime(lastRefreshTime));

  // Update relative time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRelativeTime(getRelativeTime(lastRefreshTime));
    }, 30000);
    return () => clearInterval(interval);
  }, [lastRefreshTime]);

  const faces: FaceCompletion[] = Object.entries(faceCompletions).map(([faceId, completion]) => ({
    faceId,
    completion,
    isActive: completion > 0.25
  }));

  const activeFaces = faces.filter(f => f.isActive);
  const overviewText = getOverviewText(activeFaces, faces);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    onRefresh();
    // Spin animation duration
    setTimeout(() => setIsRefreshing(false), 200);
  };

  return (
    <div className={cn(
      "rounded-lg p-4 border border-white/6",
      "bg-white/[0.02]",
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔮</span>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Design Overview
        </h3>
      </div>

      {/* Overview text */}
      <p className="text-sm text-foreground/80 leading-relaxed mb-4">
        {overviewText}
      </p>

      {/* Progress bar with direct face colors */}
      <div className="mb-4">
        <div className="flex items-center gap-2 h-8">
          {faces.map((face) => (
            <div
              key={face.faceId}
              className="relative flex-1 h-8 rounded border overflow-hidden transition-all duration-400"
              title={`${getFaceName(face.faceId)}: ${Math.round(face.completion * 100)}%`}
              style={{
                background: face.isActive
                  ? getFaceGradient(face.faceId)
                  : "rgba(255,255,255,0.04)",
                borderColor: face.isActive
                  ? `${FACE_COLORS[face.faceId]}AA`
                  : "rgba(255,255,255,0.08)",
                boxShadow: face.isActive
                  ? `0 1px 0 0 rgba(255,255,255,0.25) inset, 0 -6px 10px -4px rgba(0,0,0,0.35) inset, 0 0 10px ${FACE_COLORS[face.faceId]}40`
                  : "inset 0 0 0 1px rgba(255,255,255,0.05)",
              }}
            >
              {face.isActive && (
                <div
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0) 55%, rgba(0,0,0,0.18) 100%)"
                  }}
                />
              )}
              {face.isActive && (
                <div
                  className="absolute -top-1 left-1 right-1 h-2 rounded-full blur-[3px]"
                  style={{ background: "rgba(255,255,255,0.4)" }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-muted-foreground text-right">
          {activeFaces.length}/6 faces
        </div>
      </div>

      {/* Footer with Refresh button */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleRefresh}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium",
            "bg-white/5 hover:bg-white/10 border border-white/10",
            "text-foreground/80 hover:text-foreground transition-all",
            "min-h-[44px] min-w-[44px]"
          )}
        >
          <RefreshCw className={cn(
            "w-3.5 h-3.5 transition-transform",
            isRefreshing && "animate-spin"
          )} />
          <span>Refresh</span>
        </button>
        <span className="text-xs text-muted-foreground">
          Last: {relativeTime}
        </span>
      </div>
    </div>
  );
}
