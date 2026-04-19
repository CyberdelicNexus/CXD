"use client";

import { useRef, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useCXDStore } from "@/store/cxd-store";
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

  const updateCommentPosition = useCXDStore((s) => s.updateCommentPosition);

  // Drag state refs (avoid re-renders during drag)
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const startMouseRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });
  const pinRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only left button
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      isDraggingRef.current = true;
      hasDraggedRef.current = false;
      startMouseRef.current = { x: e.clientX, y: e.clientY };
      startPosRef.current = { ...thread.root.position };

      const handleMouseMove = (moveE: MouseEvent) => {
        if (!isDraggingRef.current) return;

        const dx = (moveE.clientX - startMouseRef.current.x) / canvasZoom;
        const dy = (moveE.clientY - startMouseRef.current.y) / canvasZoom;

        // Detect meaningful movement (threshold: 3px screen)
        if (!hasDraggedRef.current && (Math.abs(moveE.clientX - startMouseRef.current.x) > 3 || Math.abs(moveE.clientY - startMouseRef.current.y) > 3)) {
          hasDraggedRef.current = true;
          document.body.style.userSelect = "none";
        }

        if (hasDraggedRef.current && pinRef.current) {
          const newX = startPosRef.current.x + dx;
          const newY = startPosRef.current.y + dy;
          // Live visual update via style for smooth dragging
          pinRef.current.style.left = `${newX}px`;
          pinRef.current.style.top = `${newY}px`;
        }
      };

      const handleMouseUp = (upE: MouseEvent) => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        document.body.style.userSelect = "";

        if (hasDraggedRef.current) {
          // Commit the final position to the store
          const dx = (upE.clientX - startMouseRef.current.x) / canvasZoom;
          const dy = (upE.clientY - startMouseRef.current.y) / canvasZoom;
          const newX = startPosRef.current.x + dx;
          const newY = startPosRef.current.y + dy;
          updateCommentPosition(thread.root.id, { x: newX, y: newY });
        } else {
          // No drag movement: treat as click
          onClick();
        }

        isDraggingRef.current = false;
        hasDraggedRef.current = false;
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [canvasZoom, thread.root.id, thread.root.position, updateCommentPosition, onClick]
  );

  return (
    <div
      ref={pinRef}
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
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          // Click is handled by mouseup in the drag handler; prevent default button click
          e.stopPropagation();
        }}
        className={cn(
          "relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-200 shadow-lg cursor-pointer select-none overflow-hidden",
          isResolved
            ? "bg-gray-500/60 text-white/60 border border-gray-400/30"
            : "bg-purple-600 text-white border border-purple-400/50 hover:bg-purple-500 hover:scale-110",
          isActive && !isResolved && "ring-2 ring-purple-300 ring-offset-2 ring-offset-transparent scale-110",
          isActive && isResolved && "ring-2 ring-gray-400 ring-offset-2 ring-offset-transparent scale-110"
        )}
        title={isResolved ? "Resolved comment" : `Comment #${index + 1}`}
      >
        {thread.root.authorAvatar ? (
          <Image
            src={thread.root.authorAvatar}
            alt={thread.root.authorName}
            width={24}
            height={24}
            className="w-full h-full rounded-full object-cover"
            unoptimized
          />
        ) : (
          thread.root.authorName.charAt(0).toUpperCase()
        )}

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
