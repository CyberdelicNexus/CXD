"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, X, Copy, Check, RefreshCw, Loader2 } from "lucide-react";
import {
  fetchCalendarFeed,
  rotateCalendarFeed,
  type CalendarFeedInfo,
} from "@/lib/exports/calendar-feed";

interface CalendarSyncDialogProps {
  open: boolean;
  onClose: () => void;
}

type CalendarFeedState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; info: CalendarFeedInfo }
  | { status: "error"; message: string };

const SUBSCRIBE_INSTRUCTIONS: { app: string; steps: string }[] = [
  { app: "Google Calendar", steps: "Settings → Add calendar → From URL" },
  { app: "Apple Calendar", steps: "File → New Calendar Subscription" },
  { app: "Outlook", steps: "Add calendar → Subscribe from web" },
];

/**
 * Self-contained "sync tasks to calendar" dialog. Fetches/rotates the ICS feed
 * URL via the shared helpers in `@/lib/exports/calendar-feed` — no fetch logic
 * of its own. Used standalone (Master Plan, Profile) and by the Export hub's
 * Calendar Feed card.
 */
export function CalendarSyncDialog({ open, onClose }: CalendarSyncDialogProps) {
  const [feed, setFeed] = useState<CalendarFeedState>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
  const [mounted, setMounted] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const loadFeed = useCallback(async () => {
    setFeed({ status: "loading" });
    try {
      const info = await fetchCalendarFeed();
      setFeed({ status: "ready", info });
    } catch (e) {
      setFeed({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." });
    }
  }, []);

  // Fetch on open — but don't re-fetch if we already have a ready feed from
  // an earlier open in this session.
  useEffect(() => {
    if (!open) return;
    setConfirmingRegenerate(false);
    setFeed((s) => {
      if (s.status === "idle" || s.status === "error") {
        void loadFeed();
        return { status: "loading" };
      }
      return s;
    });
  }, [open, loadFeed]);

  // Close on Escape while open
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleCopy = useCallback(async (feedUrl: string) => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable — the URL is still visible and selectable.
    }
  }, []);

  const handleConfirmRegenerate = useCallback(async () => {
    setConfirmingRegenerate(false);
    setFeed({ status: "loading" });
    try {
      const info = await rotateCalendarFeed();
      setFeed({ status: "ready", info });
    } catch (e) {
      setFeed({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." });
    }
  }, []);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-label="Sync tasks to your calendar"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative mx-4 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/20">
              <CalendarDays className="h-4 w-4 text-violet-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Sync tasks to your calendar</h2>
              <p className="text-xs text-white/45">Due dates &amp; milestones, live</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs leading-relaxed text-white/45">
            Subscribe with a private ICS feed URL — your calendar app checks it
            periodically, so new and updated tasks show up automatically.
          </p>

          {/* Feed URL state */}
          <div className="space-y-2">
            {feed.status === "loading" && (
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Fetching your feed URL…
              </div>
            )}

            {feed.status === "error" && (
              <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                <p className="text-xs leading-relaxed text-amber-300/80">{feed.message}</p>
                <button
                  onClick={() => void loadFeed()}
                  className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              </div>
            )}

            {feed.status === "ready" && (
              <>
                <div className="flex items-center gap-1.5">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[11px] text-white/70">
                    {feed.info.feedUrl}
                  </code>
                  <button
                    onClick={() => void handleCopy(feed.info.feedUrl)}
                    title="Copy feed URL"
                    className="flex-shrink-0 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmingRegenerate(true)}
                    title="Regenerate — the old URL stops working"
                    className="flex-shrink-0 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>

                {confirmingRegenerate && (
                  <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                    <p className="text-[11px] leading-relaxed text-amber-300/80">
                      Regenerating stops the current URL from working immediately —
                      anyone subscribed with it will need the new one.
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => void handleConfirmRegenerate()}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-amber-500"
                      >
                        Confirm Regenerate
                      </button>
                      <button
                        onClick={() => setConfirmingRegenerate(false)}
                        className="rounded-lg px-3 py-1.5 text-[11px] text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Per-app subscribe instructions */}
          <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-white/35">
              How to subscribe
            </p>
            <ul className="space-y-1.5">
              {SUBSCRIBE_INSTRUCTIONS.map(({ app, steps }) => (
                <li key={app} className="flex items-baseline gap-2 text-[11px] leading-relaxed">
                  <span className="flex-shrink-0 font-medium text-white/70">{app}</span>
                  <span className="text-white/40">{steps}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
