"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, Check, RotateCcw, Trash2, SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCXDStore } from "@/store/cxd-store";
import { useCollaborationContext } from "@/contexts/collaboration-context";
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

const REACTION_EMOJIS = ['👍', '❤️', '😊', '🎉', '🤔', '👀', '🔥', '💯'];
const INPUT_EMOJIS = ['😊', '👍', '❤️', '🎉', '🤔', '👀', '🔥', '💯', '😂', '🙌', '✅', '💡'];

function ReactionBar({ commentId, reactions }: { commentId: string; reactions?: Record<string, string[]> }) {
  const [showPicker, setShowPicker] = useState(false);
  const { syncToggleReaction } = useCollaborationContext();
  const currentProject = useCXDStore((s) => s.getCurrentProject());
  const authorId = currentProject?.ownerId || 'anonymous';

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1.5 pl-7">
      {/* Existing reactions */}
      {reactions && Object.entries(reactions).map(([emoji, users]) => (
        <button
          key={emoji}
          onClick={() => syncToggleReaction(commentId, emoji)}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-all",
            users.includes(authorId)
              ? "bg-purple-500/20 border border-purple-500/30 text-white"
              : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
          )}
        >
          <span>{emoji}</span>
          <span className="text-[10px]">{users.length}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 text-white/30 hover:text-white/60 hover:bg-white/10 text-xs transition-all"
        >
          +
        </button>

        {/* Emoji picker popup */}
        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 flex gap-0.5 p-1.5 rounded-lg bg-[rgba(12,10,22,0.97)] border border-white/10 shadow-xl z-10">
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => {
                  syncToggleReaction(commentId, emoji);
                  setShowPicker(false);
                }}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-base"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentThreadPanel({
  thread,
  canvasZoom,
}: CommentThreadProps) {
  const { setActiveComment } = useCXDStore();
  const { syncAddReply, syncResolveComment, syncUnresolveComment, syncDeleteComment } = useCollaborationContext();
  const [replyText, setReplyText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
    syncAddReply(thread.root.id, trimmed);
    setReplyText("");
  }, [replyText, syncAddReply, thread.root.id]);

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
      <div className="w-72 rounded-xl border border-white/10 bg-[rgba(12,10,22,0.97)] backdrop-blur-xl shadow-2xl overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <span className="text-xs font-medium text-white/50">
            {isResolved ? "Resolved" : "Comment Thread"}
          </span>
          <div className="flex items-center gap-1">
            {isResolved ? (
              <button
                onClick={() => syncUnresolveComment(thread.root.id)}
                className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                title="Reopen thread"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => syncResolveComment(thread.root.id)}
                className="p-1 rounded hover:bg-green-500/20 text-white/50 hover:text-green-400 transition-colors"
                title="Resolve thread"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => syncDeleteComment(thread.root.id)}
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
        <div
          className="max-h-64 overflow-y-auto comment-thread-scroll"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.1) transparent',
          }}
        >
          {/* Root comment */}
          <div className={cn("px-3 py-2.5", isResolved && "opacity-60")}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden">
                {thread.root.authorAvatar ? (
                  <Image src={thread.root.authorAvatar} alt={thread.root.authorName} width={20} height={20} className="w-full h-full rounded-full object-cover" unoptimized />
                ) : (
                  thread.root.authorName.charAt(0).toUpperCase()
                )}
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
            <ReactionBar commentId={thread.root.id} reactions={thread.root.reactions} />
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
              <ReactionBar commentId={reply.id} reactions={reply.reactions} />
            </div>
          ))}
        </div>

        {/* Reply input - hidden when resolved */}
        {!isResolved && (
          <div className="border-t border-white/10 px-3 py-2">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Reply... (Enter to send)"
                rows={1}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-8 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
              />
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute right-2 bottom-2 p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
                title="Add emoji"
              >
                <SmilePlus className="w-4 h-4" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-1 flex flex-wrap gap-0.5 p-1.5 rounded-lg bg-[rgba(12,10,22,0.97)] border border-white/10 shadow-xl z-10 max-w-[200px]">
                  {INPUT_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setReplyText(prev => prev + emoji);
                        setShowEmojiPicker(false);
                        inputRef.current?.focus();
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-base"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
