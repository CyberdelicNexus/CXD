"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortcutItem {
  category: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

const SHORTCUTS: ShortcutItem[] = [
  {
    category: "Navigation",
    shortcuts: [
      { keys: ["Space + Drag"], description: "Pan canvas" },
      { keys: ["Scroll"], description: "Zoom in/out" },
      { keys: ["Esc"], description: "Cancel current action" },
    ],
  },
  {
    category: "Tool Activation",
    shortcuts: [
      { keys: ["T"], description: "Text tool" },
      { keys: ["C"], description: "Card tool" },
      { keys: ["B"], description: "Board tool" },
      { keys: ["L"], description: "Line tool" },
      { keys: ["I"], description: "Image tool" },
      { keys: ["O"], description: "Container tool" },
      { keys: ["E"], description: "Link tool" },
      { keys: ["F"], description: "Shape tool" },
    ],
  },
  {
    category: "Precision Layout",
    shortcuts: [
      { keys: ["↑", "↓", "←", "→"], description: "Move selected 1px" },
      { keys: ["Shift", "+", "↑↓←→"], description: "Move selected 10px" },
    ],
  },
  {
    category: "Editing",
    shortcuts: [
      { keys: ["Ctrl/Cmd", "Z"], description: "Undo" },
      { keys: ["Ctrl/Cmd", "Shift", "Z"], description: "Redo" },
      { keys: ["Ctrl/Cmd", "C"], description: "Copy selected" },
      { keys: ["Ctrl/Cmd", "V"], description: "Paste" },
      { keys: ["Ctrl/Cmd", "D"], description: "Duplicate selected" },
      { keys: ["Delete"], description: "Delete selected" },
    ],
  },
  {
    category: "Selection",
    shortcuts: [
      { keys: ["Click"], description: "Select element" },
      { keys: ["Shift", "+", "Click"], description: "Multi-select" },
      { keys: ["Shift", "+", "Drag"], description: "Marquee select" },
    ],
  },
];

export function ShortcutsGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="text-muted-foreground hover:text-foreground"
        title="Keyboard Shortcuts"
      >
        <Keyboard className="w-5 h-5" />
      </Button>
      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Content */}
          <div
            className="fixed left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[85vh] overflow-y-auto top-[473.6px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card border border-border rounded-lg shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Keyboard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      Keyboard Shortcuts
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Speed up your workflow
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Shortcuts List */}
              <div className="px-6 py-4 space-y-6">
                {SHORTCUTS.map((category, idx) => (
                  <div key={idx}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      {category.category}
                    </h3>
                    <div className="space-y-2">
                      {category.shortcuts.map((shortcut, shortcutIdx) => (
                        <div
                          key={shortcutIdx}
                          className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-secondary/50 transition-colors"
                        >
                          <span className="text-sm text-foreground">
                            {shortcut.description}
                          </span>
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, keyIdx) => (
                              <span key={keyIdx} className="flex items-center">
                                {keyIdx > 0 && key !== "+" && (
                                  <span className="text-muted-foreground mx-1">
                                    +
                                  </span>
                                )}
                                {key !== "+" && (
                                  <kbd
                                    className={cn(
                                      "px-2 py-1 text-xs font-mono rounded border border-border bg-muted/50 text-foreground min-w-[2rem] text-center",
                                      key.length > 1 && "min-w-[3rem]",
                                    )}
                                  >
                                    {key}
                                  </kbd>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border bg-secondary/20">
                <p className="text-xs text-muted-foreground text-center">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 text-xs font-mono rounded border border-border bg-muted/50">
                    Esc
                  </kbd>{" "}
                  to close this guide
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
