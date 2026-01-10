"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ResizableContainerProps {
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  children?: React.ReactNode;
  className?: string;
}

export function ResizableContainer({
  initialWidth = 400,
  initialHeight = 300,
  minWidth = 100,
  minHeight = 100,
  maxWidth = 1200,
  maxHeight = 800,
  children,
  className,
}: ResizableContainerProps) {
  const [dimensions, setDimensions] = useState({
    width: initialWidth,
    height: initialHeight,
  });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeDirectionRef = useRef<string>("");

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: string) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      resizeDirectionRef.current = direction;

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = dimensions.width;
      const startHeight = dimensions.height;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;

        if (direction.includes("e")) {
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
        }
        if (direction.includes("w")) {
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
        }
        if (direction.includes("s")) {
          newHeight = Math.max(
            minHeight,
            Math.min(maxHeight, startHeight + deltaY),
          );
        }
        if (direction.includes("n")) {
          newHeight = Math.max(
            minHeight,
            Math.min(maxHeight, startHeight - deltaY),
          );
        }

        setDimensions({ width: newWidth, height: newHeight });
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        resizeDirectionRef.current = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [dimensions, minWidth, minHeight, maxWidth, maxHeight],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative border-2 border-purple-500 rounded-lg bg-gradient-to-br from-purple-950/50 via-indigo-950/50 to-purple-900/50 backdrop-blur-sm transition-shadow",
        isResizing && "shadow-[0_0_30px_rgba(168,85,247,0.6)]",
        className,
      )}
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
    >
      {/* Content */}
      <div className="w-full h-full overflow-auto p-4">{children}</div>

      {/* Resize handles */}
      {/* Corners */}
      <div
        className="absolute -top-2 -left-2 w-4 h-4 bg-purple-500 rounded-full cursor-nw-resize hover:bg-purple-400 transition-colors border-2 border-white shadow-lg z-10"
        onMouseDown={(e) => handleResizeStart(e, "nw")}
      />
      <div
        className="absolute -top-2 -right-2 w-4 h-4 bg-purple-500 rounded-full cursor-ne-resize hover:bg-purple-400 transition-colors border-2 border-white shadow-lg z-10"
        onMouseDown={(e) => handleResizeStart(e, "ne")}
      />
      <div
        className="absolute -bottom-2 -left-2 w-4 h-4 bg-purple-500 rounded-full cursor-sw-resize hover:bg-purple-400 transition-colors border-2 border-white shadow-lg z-10"
        onMouseDown={(e) => handleResizeStart(e, "sw")}
      />
      <div
        className="absolute -bottom-2 -right-2 w-4 h-4 bg-purple-500 rounded-full cursor-se-resize hover:bg-purple-400 transition-colors border-2 border-white shadow-lg z-10"
        onMouseDown={(e) => handleResizeStart(e, "se")}
      />

      {/* Edges */}
      <div
        className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-purple-500 rounded-full cursor-n-resize hover:bg-purple-400 transition-colors border border-white shadow-lg"
        onMouseDown={(e) => handleResizeStart(e, "n")}
      />
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-purple-500 rounded-full cursor-s-resize hover:bg-purple-400 transition-colors border border-white shadow-lg"
        onMouseDown={(e) => handleResizeStart(e, "s")}
      />
      <div
        className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-8 bg-purple-500 rounded-full cursor-w-resize hover:bg-purple-400 transition-colors border border-white shadow-lg"
        onMouseDown={(e) => handleResizeStart(e, "w")}
      />
      <div
        className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-8 bg-purple-500 rounded-full cursor-e-resize hover:bg-purple-400 transition-colors border border-white shadow-lg"
        onMouseDown={(e) => handleResizeStart(e, "e")}
      />

      {/* Dimension display */}
      {isResizing && (
        <div className="absolute top-2 left-2 bg-purple-500/90 text-white px-2 py-1 rounded text-xs font-mono backdrop-blur z-20">
          {dimensions.width} × {dimensions.height}
        </div>
      )}
    </div>
  );
}
