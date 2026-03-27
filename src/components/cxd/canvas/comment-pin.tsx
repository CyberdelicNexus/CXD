"use client";

import { cn } from "@/lib/utils";
import type { CommentThread } from "@/types/comment-types";

interface CommentPinProps {
  thread: CommentThread;
  index: number;
  isActive: boolean;
  isResolved: boolean;
  onClick: () => void;
  canvasZoom: number;
}

export function CommentPin({
  thread,
  index,
  isActive,
  isResolved,
  onClick,
  canvasZoom,
}: CommentPinProps) {
  const replyCount = thread.replies.length;
  // Inverse scale so pins stay a consistent screen size regardless of zoom
  const pinScale = 1 / canvasZoom;

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: thread.root.position.x,
        top: thread.root.position.y,
        transform: `scale(${pinScale})`,
        transformOrigin: "0 0",
        zIndex: isActive ? 9990 : 9980,
      }}
      data-comment-pin={thread.root.id}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-200 shadow-lg cursor-pointer select-none",
          isResolved
            ? "bg-gray-500/60 text-white/60 border border-gray-400/30"
            : "bg-purple-600 text-white border border-purple-400/50 hover:bg-purple-500 hover:scale-110",
          isActive && !isResolved && "ring-2 ring-purple-300 ring-offset-2 ring-offset-transparent scale-110",
          isActive && isResolved && "ring-2 ring-gray-400 ring-offset-2 ring-offset-transparent scale-110"
        )}
        title={isResolved ? "Resolved comment" : `Comment #${index + 1}`}
      >
        {index + 1}

        {/* Reply count badge */}
        {replyCount > 0 && (
          <span
            className={cn(
              "absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold",
              isResolved
                ? "bg-gray-400/80 text-white/80"
                : "bg-white text-purple-700"
            )}
          >
            {replyCount}
          </span>
        )}
      </button>
    </div>
  );
}
