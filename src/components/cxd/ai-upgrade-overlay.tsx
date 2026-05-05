"use client";

import { Sparkles, Lock } from "lucide-react";

interface AIUpgradeOverlayProps {
  onUpgrade?: () => void;
}

export function AIUpgradeOverlay({ onUpgrade }: AIUpgradeOverlayProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl">
      <div className="text-center px-8 py-6 max-w-sm">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-primary/60" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          AI Intelligence Layer
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Get AI-powered reasoning across all six dimensions, deep analysis,
          and automated Experience Requirement Documents.
        </p>
        <button
          onClick={onUpgrade}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm inline-flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
}
