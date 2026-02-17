"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Trash2, MessageSquare, Clock, ChevronRight, X, Loader2, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "./ai-chat-markdown";

// ─── Face metadata lookup ────────────────────────────────────────────
// Maps face_key → display metadata. Matches CUBE_FACES in hypercube-3d.tsx.
const FACE_META: Record<string, { label: string; hue: number }> = {
  realityPlanes: { label: "Reality", hue: 280 },
  sensoryDomains: { label: "Sensory", hue: 45 },
  presence: { label: "Presence", hue: 195 },
  stateMapping: { label: "States", hue: 160 },
  traitMapping: { label: "Traits", hue: 260 },
  contextAndMeaning: { label: "Meaning", hue: 320 },
  core: { label: "Core", hue: 195 },
  general: { label: "General", hue: 220 },
};

function getFaceLabel(faceKey: string, storedLabel?: string | null): string {
  return FACE_META[faceKey]?.label || storedLabel || "Untagged";
}

function getFaceHue(faceKey: string, storedHue?: number | null): number {
  return FACE_META[faceKey]?.hue ?? storedHue ?? 0;
}

// ─── Types ───────────────────────────────────────────────────────────

interface ArchivedSession {
  id: string;
  title: string;
  faceKey: string;
  faceLabel: string | null;
  faceHue: number | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ArchivedMessage {
  id: string;
  role: string;
  content?: string;
  parts?: { type: string; text?: string }[];
}

interface AIChatHistoryProps {
  projectId: string;
  faceKey: string;
  accentHue: number;
  onClose: () => void;
  /** Called when user clicks a history entry from a different face */
  onNavigateToFace?: (faceKey: string) => void;
}

export function AIChatHistory({
  projectId,
  faceKey,
  accentHue,
  onClose,
  onNavigateToFace,
}: AIChatHistoryProps) {
  const [sessions, setSessions] = useState<ArchivedSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllFaces, setShowAllFaces] = useState(false);
  const [selectedThread, setSelectedThread] = useState<{
    id: string;
    title: string;
    faceKey: string;
    messages: ArchivedMessage[];
  } | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  // Fetch archived sessions
  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        projectId,
        faceKey,
        history: "true",
      });
      if (showAllFaces) params.set("allFaces", "true");

      const res = await fetch(`/api/ai/threads?${params}`);
      if (!res.ok) return;
      const { sessions: data } = await res.json();
      setSessions(data || []);
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }, [projectId, faceKey, showAllFaces]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // View a specific session (read-only)
  const viewSession = useCallback(async (session: ArchivedSession) => {
    try {
      setIsLoadingThread(true);
      const res = await fetch("/api/ai/threads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: session.id }),
      });
      if (!res.ok) return;

      const { thread } = await res.json();
      const msgs: ArchivedMessage[] =
        typeof thread.messages === "string"
          ? JSON.parse(thread.messages)
          : thread.messages;

      setSelectedThread({
        id: session.id,
        title: session.title,
        faceKey: session.faceKey,
        messages: msgs,
      });

      // Navigate hypercube to the session's face if different from current
      if (session.faceKey !== faceKey && onNavigateToFace) {
        onNavigateToFace(session.faceKey);
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoadingThread(false);
    }
  }, [faceKey, onNavigateToFace]);

  // Delete a session
  const deleteSession = useCallback(
    async (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await fetch(`/api/ai/threads?threadId=${sessionId}`, { method: "DELETE" });
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (selectedThread?.id === sessionId) setSelectedThread(null);
      } catch {
        // Silent fail
      }
    },
    [selectedThread],
  );

  function getMessageText(msg: ArchivedMessage): string {
    if (msg.content) return msg.content;
    if (msg.parts) {
      return msg.parts
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text!)
        .join("\n");
    }
    return "";
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  // ─── Thread detail view (read-only) ─────────────────────────────────

  if (selectedThread) {
    const threadHue = getFaceHue(selectedThread.faceKey);

    return (
      <div
        className="flex flex-col h-full"
        style={{ "--chat-scrollbar-hue": accentHue } as React.CSSProperties}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setSelectedThread(null)}
            className="p-1 hover:bg-white/10 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Face color dot */}
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: `hsl(${threadHue} 50% 55%)` }}
              />
              <p className="text-sm font-medium text-foreground truncate">
                {selectedThread.title}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {selectedThread.messages.length} messages &middot; {getFaceLabel(selectedThread.faceKey)} &middot; read-only
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="chat-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-3">
          {selectedThread.messages.map((msg, i) => (
            <div
              key={msg.id || i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed break-words [overflow-wrap:anywhere]",
                  msg.role === "user"
                    ? "rounded-br-sm"
                    : "bg-white/5 text-foreground/90 border border-border/40 rounded-bl-sm",
                )}
                style={
                  msg.role === "user"
                    ? { backgroundColor: `hsl(${threadHue} 30% 25% / 0.6)` }
                    : undefined
                }
              >
                {msg.role === "assistant" ? (
                  <ChatMarkdown content={getMessageText(msg)} />
                ) : (
                  getMessageText(msg)
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Session list view ──────────────────────────────────────────────

  const currentFaceLabel = getFaceLabel(faceKey);

  return (
    <div
      className="flex flex-col h-full"
      style={{ "--chat-scrollbar-hue": accentHue } as React.CSSProperties}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock
            className="w-4 h-4"
            style={{ color: `hsl(${accentHue} 50% 60%)` }}
          />
          <span className="text-sm font-medium text-foreground">Session History</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-md text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter chip */}
      <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-3 h-3 text-muted-foreground/50" />
          {showAllFaces ? (
            <span className="text-[11px] text-muted-foreground">
              All faces
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: `hsl(${accentHue} 50% 55%)` }}
              />
              {currentFaceLabel}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAllFaces(!showAllFaces)}
          className="text-[11px] text-primary/70 hover:text-primary transition-colors"
        >
          {showAllFaces ? `Show ${currentFaceLabel} only` : "Show all"}
        </button>
      </div>

      {/* Content */}
      <div className="chat-scrollbar flex-1 overflow-y-auto overflow-x-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No past sessions</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {showAllFaces
                ? "No conversations yet. Start chatting to see your history here."
                : `No archived conversations for ${currentFaceLabel}. Try "Show all" to see other faces.`}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {sessions.map((session) => {
              const sessionHue = getFaceHue(session.faceKey, session.faceHue);
              const sessionLabel = getFaceLabel(session.faceKey, session.faceLabel);
              const isOtherFace = session.faceKey !== faceKey;

              return (
                <button
                  key={session.id}
                  onClick={() => viewSession(session)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left group"
                >
                  {/* Face color dot */}
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 border border-white/10"
                    style={{ backgroundColor: `hsl(${sessionHue} 45% 50%)` }}
                    title={sessionLabel}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{session.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {/* Face tag */}
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm"
                        style={{
                          backgroundColor: `hsl(${sessionHue} 30% 25% / 0.4)`,
                          color: `hsl(${sessionHue} 50% 70%)`,
                        }}
                      >
                        {sessionLabel}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {session.messageCount} msgs &middot; {formatDate(session.updatedAt)}
                      </span>
                      {isOtherFace && onNavigateToFace && (
                        <span className="text-[9px] text-muted-foreground/40 italic">
                          &rarr; will switch face
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 rounded-md text-muted-foreground/40 transition-all"
                    title="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {isLoadingThread ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/40" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
