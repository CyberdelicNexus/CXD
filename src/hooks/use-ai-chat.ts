"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCXDStore } from "@/store/cxd-store";
import { getFullProjectContext, getFaceContext } from "@/utils/ai-context-aggregator";
import type { AIProviderKey, AIChatMessage } from "@/types/ai-types";
import type { ModelId } from "@/lib/ai-credit-config";
import type { UIMessage } from "ai";

// ─── Module-level in-memory cache ───────────────────────────────────
// Survives component unmounts (face/tab switches) but not full page refresh
const messageCache = new Map<string, UIMessage[]>();

function getCacheKey(projectId: string, faceKey: string) {
  return `${projectId}::${faceKey}`;
}

// Save to API — returns promise so callers can optionally await
function saveToAPI(
  projectId: string,
  faceKey: string,
  messages: UIMessage[],
  extra?: { faceLabel?: string; faceHue?: number },
): Promise<void> {
  if (messages.length === 0) return Promise.resolve();

  const serializable = messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    parts: msg.parts,
    content: msg.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n"),
  }));

  return fetch("/api/ai/threads", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      faceKey,
      messages: serializable,
      ...(extra || {}),
    }),
  })
    .then(() => {})
    .catch(() => {
      // Silent fail
    });
}

// ─── Types ──────────────────────────────────────────────────────────

interface UseAIChatOptions {
  faceKey: string;
  projectId: string;
  provider?: AIProviderKey | ModelId;
  enabled?: boolean;
  faceLabel?: string;
  faceHue?: number;
}

interface UseAIChatReturn {
  messages: AIChatMessage[];
  sendMessage: (content: string) => void;
  isStreaming: boolean;
  error: Error | undefined;
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (e?: React.FormEvent) => void;
  starMessage: (messageId: string) => void;
  clearHistory: () => void;
  newSession: () => Promise<void>;
  isLoadingHistory: boolean;
}

export function useAIChat({
  faceKey,
  projectId,
  provider = "gpt",
  enabled = true,
  faceLabel,
  faceHue,
}: UseAIChatOptions): UseAIChatReturn {
  const [input, setInput] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCacheKeyRef = useRef<string | null>(null);
  const chatId = `${projectId}-${faceKey}`;
  const cacheKey = getCacheKey(projectId, faceKey);

  // Get project data from Zustand store
  const projects = useCXDStore((s) => s.projects);
  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );

  // Build extra body for the transport
  const extraBody = useMemo(() => {
    if (!project) return { faceKey, provider };

    const elements = project.canvasLayout?.elements || [];
    const edges = project.canvasLayout?.edges || [];
    const fullContext = getFullProjectContext(project, elements, edges);

    const body: Record<string, unknown> = {
      faceKey,
      projectContext: fullContext,
      provider,
    };

    if (faceKey !== "general" && faceKey !== "core") {
      body.faceContext = getFaceContext(project, elements, faceKey);
    }

    return body;
  }, [project, faceKey, provider]);

  // `useChat` does not recreate internal chat state when only transport changes.
  // Keep one transport instance and resolve request body dynamically per send.
  const extraBodyRef = useRef(extraBody);
  useEffect(() => {
    extraBodyRef.current = extraBody;
  }, [extraBody]);

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/ai/chat",
        body: () => extraBodyRef.current,
      }),
    [],
  );

  const {
    messages: rawMessages,
    sendMessage: sdkSendMessage,
    status,
    error,
    setMessages,
  } = useChat({
    id: chatId,
    transport,
  });

  // ─── Flush pending saves + restore cache on face/key change ───────
  useEffect(() => {
    const prevKey = prevCacheKeyRef.current;

    // If key changed, flush any pending save for the OLD key
    if (prevKey && prevKey !== cacheKey) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // Save the old key's cached messages immediately
      const oldMessages = messageCache.get(prevKey);
      if (oldMessages && oldMessages.length > 0) {
        const [oldProjectId, oldFaceKey] = prevKey.split("::");
        saveToAPI(oldProjectId, oldFaceKey, oldMessages);
      }

      // Restore from cache for new key
      const cached = messageCache.get(cacheKey);
      if (cached && cached.length > 0) {
        setMessages(cached);
      }
    }

    prevCacheKeyRef.current = cacheKey;
  }, [cacheKey, setMessages]);

  // ─── Load from API on first mount per cacheKey (if cache is empty) ─
  const loadedKeysRef = useRef(new Set<string>());

  useEffect(() => {
    if (loadedKeysRef.current.has(cacheKey)) return;
    loadedKeysRef.current.add(cacheKey);

    const cached = messageCache.get(cacheKey);
    if (cached && cached.length > 0) {
      // Cache hit — restore and skip API
      setMessages(cached);
      return;
    }

    (async () => {
      try {
        setIsLoadingHistory(true);
        const res = await fetch(
          `/api/ai/threads?projectId=${projectId}&faceKey=${faceKey}`,
        );
        if (!res.ok) return;

        const { thread } = await res.json();
        if (!thread?.messages) return;

        const msgs: unknown[] =
          typeof thread.messages === "string"
            ? JSON.parse(thread.messages)
            : thread.messages;

        if (msgs.length > 0) {
          const hydrated: UIMessage[] = msgs.map((m: unknown) => {
            const msg = m as {
              id: string;
              role: string;
              content?: string;
              parts?: { type: string; text?: string }[];
            };
            return {
              id: msg.id || crypto.randomUUID(),
              role: msg.role as UIMessage["role"],
              parts: msg.parts || [{ type: "text" as const, text: msg.content || "" }],
              metadata: {},
            } as UIMessage;
          });

          messageCache.set(cacheKey, hydrated);
          setMessages(hydrated);
        }
      } catch {
        // Silently fail - chat still works without persistence
      } finally {
        setIsLoadingHistory(false);
      }
    })();
  }, [cacheKey, projectId, faceKey, setMessages]);

  // ─── Keep cache in sync + debounced save to API ──────────────────
  const prevStatusRef = useRef(status);

  useEffect(() => {
    if (rawMessages.length === 0) return;

    // Update in-memory cache immediately
    messageCache.set(cacheKey, rawMessages);

    const wasStreaming =
      prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    const isNowReady = status === "ready" || status === "error";

    // Save immediately when streaming just finished (transition to ready)
    if (wasStreaming && isNowReady) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      saveToAPI(projectId, faceKey, rawMessages);
      // Notify credit meter that credits may have changed
      window.dispatchEvent(new CustomEvent("ai-credits-changed"));
      prevStatusRef.current = status;
      return;
    }

    prevStatusRef.current = status;

    // Don't start save timers while actively streaming
    if (status === "streaming" || status === "submitted") return;

    // Debounce API save (1.5s after last message change while ready)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToAPI(projectId, faceKey, rawMessages);
    }, 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [rawMessages, cacheKey, projectId, faceKey, status]);

  // ─── Flush on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      // Save whatever is in cache on unmount
      const cached = messageCache.get(cacheKey);
      if (cached && cached.length > 0) {
        saveToAPI(projectId, faceKey, cached);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Helpers ─────────────────────────────────────────────────────

  function getMessageText(msg: UIMessage): string {
    return msg.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n");
  }

  const messages: AIChatMessage[] = useMemo(
    () =>
      rawMessages.map((msg: UIMessage) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant" | "system",
        content: getMessageText(msg),
        timestamp: Date.now(),
        faceKey,
        isStarred: !!((msg.metadata as Record<string, unknown>)?.isStarred),
      })),
    [rawMessages, faceKey],
  );

  const sendMessage = useCallback(
    (content: string) => {
      if (!enabled || !content.trim()) return;
      setInput("");
      sdkSendMessage({ text: content });
    },
    [enabled, sdkSendMessage],
  );

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (!enabled) return;
      if (e) e.preventDefault();
      if (!input.trim()) return;
      sendMessage(input);
    },
    [enabled, input, sendMessage],
  );

  const starMessage = useCallback(
    (messageId: string) => {
      setMessages((prev: UIMessage[]) =>
        prev.map((msg: UIMessage) =>
          msg.id === messageId
            ? {
                ...msg,
                metadata: {
                  ...((msg.metadata as Record<string, unknown>) || {}),
                  isStarred: !((msg.metadata as Record<string, unknown>)?.isStarred),
                },
              }
            : msg,
        ),
      );
    },
    [setMessages],
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    messageCache.delete(cacheKey);
  }, [setMessages, cacheKey]);

  // ─── New Session: archive current, start fresh ───────────────────
  const newSession = useCallback(async () => {
    // Flush current messages before archiving — MUST await to avoid race
    const cached = messageCache.get(cacheKey);
    if (cached && cached.length > 0) {
      await saveToAPI(projectId, faceKey, cached, { faceLabel, faceHue });
    }

    try {
      await fetch("/api/ai/threads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          faceKey,
          faceLabel,
          faceHue,
          newSession: true,
        }),
      });
    } catch {
      // Silent fail
    }
    setMessages([]);
    messageCache.delete(cacheKey);
    // Allow re-loading from API if the user navigates away and back
    loadedKeysRef.current.delete(cacheKey);
    setInput("");
  }, [projectId, faceKey, faceLabel, faceHue, setMessages, cacheKey]);

  return {
    messages,
    sendMessage,
    isStreaming: status === "streaming" || status === "submitted",
    error,
    input,
    setInput,
    handleSubmit,
    starMessage,
    clearHistory,
    newSession,
    isLoadingHistory,
  };
}
