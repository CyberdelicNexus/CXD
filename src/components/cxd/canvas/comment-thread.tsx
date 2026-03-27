"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Check, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCXDStore } from "@/store/cxd-store";
import type { CommentThread as CommentThreadType } from "@/types/comment-types";

interface CommentThreadProps {
  thread: CommentThreadType;
  canvasZoom: number;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function CommentThreadPanel({
  thread,
  canvasZoom,
}: CommentThreadProps) {
  const { addReply, resolveComment, unresolveComment, deleteComment, setActiveComment } = useCXDStore();
  const [replyText, setReplyText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isResolved = thread.root.resolvedAt !== null;
  const pinScale = 1 / canvasZoom;

  // Auto-focus the input when panel opens
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmitReply = useCallback(() => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    addReply(thread.root.id, trimmed);
    setReplyText("");
  }, [replyText, addReply, thread.root.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmitReply();
      }
    },
    [handleSubmitReply]
  );

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: thread.root.position.x,
        top: thread.root.position.y,
        transform: `scale(${pinScale}) translateX(40px)`,
        transformOrigin: "0 0",
        zIndex: 9991,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-72 rounded-xl border border-white/10 bg-[rgba(12,10,22,0.97)] backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <span className="text-xs font-medium text-white/50">
            {isResolved ? "Resolved" : "Comment Thread"}
          </span>
          <div className="flex items-center gap-1">
            {isResolved ? (
              <button
                onClick={() => unresolveComment(thread.root.id)}
                className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                title="Reopen thread"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => resolveComment(thread.root.id)}
                className="p-1 rounded hover:bg-green-500/20 text-white/50 hover:text-green-400 transition-colors"
                title="Resolve thread"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => deleteComment(thread.root.id)}
              className="p-1 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors"
              title="Delete thread"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveComment(null)}
              className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="max-h-64 overflow-y-auto">
          {/* Root comment */}
          <div className={cn("px-3 py-2.5", isResolved && "opacity-60")}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                {thread.root.authorName.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-medium text-white/80">
                {thread.root.authorName}
              </span>
              <span className="text-[10px] text-white/30 ml-auto">
                {formatRelativeTime(thread.root.createdAt)}
              </span>
            </div>
            <p className="text-sm text-white/70 whitespace-pre-wrap pl-7">
              {thread.root.content}
            </p>
          </div>

          {/* Replies */}
          {thread.replies.map((reply) => (
            <div
              key={reply.id}
              className={cn(
                "px-3 py-2 border-t border-white/5",
                isResolved && "opacity-60"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                  {reply.authorName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-white/80">
                  {reply.authorName}
                </span>
                <span className="text-[10px] text-white/30 ml-auto">
                  {formatRelativeTime(reply.createdAt)}
                </span>
              </div>
              <p className="text-sm text-white/70 whitespace-pre-wrap pl-7">
                {reply.content}
              </p>
            </div>
          ))}
        </div>

        {/* Reply input - hidden when resolved */}
        {!isResolved && (
          <div className="border-t border-white/10 px-3 py-2">
            <textarea
              ref={inputRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply... (Enter to send)"
              rows={1}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
            />
          </div>
        )}
      </div>
    </div>
  );
}
