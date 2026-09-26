"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Scale } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ArmId } from "@/lib/lab/types";
import type { MapType } from "@/lib/maps/types";
import type { CanvasEdge, CanvasElement } from "@/types/canvas-elements";
import { cn } from "@/lib/utils";
import type { LabMeta } from "./lab-app";
import { EmptyState, fetchJson, fieldClass, focusRing, InlineError, Kbd, LabButton, panelClass, postJson, Skeleton, usd } from "./lab-ui";
import { MapPreview } from "./map-preview";

interface Side { cellId: string; elements: CanvasElement[]; edges: CanvasEdge[] }
interface Pair { inputId: string; inputTitle: string; inputText: string; repeat: boolean; left: Side; right: Side }
interface RevealSide { arm: ArmId; modelId: string; mapType: MapType | null; costUsd: number }
type Winner = "left" | "right" | "tie";
interface Reveal { winner: Winner; left: RevealSide; right: RevealSide }

type Phase = "loading" | "ready" | "voting" | "reveal" | "error";
interface VersionMode { old: string; current: string }

/** `/lab?compare=<version>` switches Compare to old-vs-new pairs. */
const compareParam = () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("compare"));

/** How long the revealed arm/model/cost stay on screen before the next pair. */
const REVEAL_MS = 1400;
const PREVIEW_H = 540;
const LONG_INPUT = 280;

const pairKey = (p: Pair) => [p.left.cellId, p.right.cellId].sort().join("|");

export function CompareView({ meta }: { meta: LabMeta }) {
  const reduce = useReducedMotion();
  const [pair, setPair] = useState<Pair | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<{ message: string; winner: Winner } | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [reason, setReason] = useState("");
  const [sessionVotes, setSessionVotes] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);
  const [inputOpen, setInputOpen] = useState(false);
  const [versionMode, setVersionMode] = useState<VersionMode | null>(null);
  const skipped = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const next = useCallback(async () => {
    setPhase("loading");
    setLoadError(null);
    setVoteError(null);
    setReveal(null);
    try {
      // Pairs are drawn at random: redraw a few times to avoid ones skipped this session.
      const compare = compareParam();
      const url = compare ? `/api/lab/pair?compare=${encodeURIComponent(compare)}` : "/api/lab/pair";
      let data: { pair: Pair | null; totalVotes: number; mode?: VersionMode | null } = { pair: null, totalVotes: 0 };
      for (let i = 0; i < 5; i++) {
        data = (await fetchJson<{ pair: Pair | null; totalVotes: number; mode?: VersionMode | null }>(url)).data;
        if (!data.pair || !skipped.current.has(pairKey(data.pair))) break;
      }
      setVersionMode(data.mode ?? null);
      setPair(data.pair);
      setTotalVotes(data.totalVotes ?? 0);
      setReason("");
      setInputOpen(false);
      setPhase("ready");
    } catch (e) {
      setLoadError((e as Error).message);
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void next();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [next]);

  const vote = useCallback(async (winner: Winner) => {
    if (!pair || phase !== "ready") return;
    setPhase("voting");
    setVoteError(null);
    try {
      const { data } = await fetchJson<{ reveal?: { left: RevealSide; right: RevealSide } }>("/api/lab/votes", postJson({
        leftCellId: pair.left.cellId, rightCellId: pair.right.cellId, winner, reason: reason.trim(), repeat: pair.repeat,
      }));
      setSessionVotes((n) => n + 1);
      setTotalVotes((n) => n + 1);
      if (data.reveal) {
        setReveal({ winner, ...data.reveal });
        setPhase("reveal");
        timer.current = setTimeout(() => void next(), REVEAL_MS);
      } else {
        void next();
      }
    } catch (e) {
      setVoteError({ message: (e as Error).message || "Could not save the vote", winner });
      setPhase("ready");
    }
  }, [pair, phase, reason, next]);

  const skip = useCallback(() => {
    if (!pair || phase !== "ready") return;
    skipped.current.add(pairKey(pair));
    void next();
  }, [pair, phase, next]);

  // Keyboard-first voting. Ignored while typing and when a modifier is held.
  const handlers = useRef({ vote, skip });
  handlers.current = { vote, skip };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === "a") void handlers.current.vote("left");
      else if (key === "l") void handlers.current.vote("right");
      else if (key === "t") void handlers.current.vote("tie");
      else if (key === "s") handlers.current.skip();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const armLabel = (id: ArmId) => meta.arms.find((a) => a.id === id)?.label ?? id;
  const modelLabel = (id: string) => meta.models.find((m) => m.id === id)?.label ?? id;

  if (phase === "error" && !pair) {
    return <InlineError message={`Could not load a pair: ${loadError}`} onRetry={() => void next()} />;
  }
  if (phase === "loading" && !pair) return <CompareSkeleton />;
  if (!pair && versionMode) {
    return (
      <EmptyState
        testId="no-pairs"
        icon={Scale}
        title="No old-vs-new pairs left to judge."
        detail={`Comparing prompt version ${versionMode.old} with the current ${versionMode.current}. Pairs need a clean map from each version for the same input, arm and model.`}
        action={<LabButton tone="ghost" onClick={() => void next()}>Check again</LabButton>}
      />
    );
  }
  if (!pair) {
    return (
      <EmptyState
        testId="no-pairs"
        icon={Scale}
        title="Nothing to compare yet. Finish a run first."
        detail={
          (totalVotes > 0 ? `Every pair has been judged (${totalVotes} votes). Run more arms or models to create new pairs. ` : "") +
          "Only clean maps made with the current prompts are offered; runs from older prompt versions need re-running."
        }
        action={<LabButton tone="ghost" onClick={() => void next()}>Check again</LabButton>}
      />
    );
  }

  const long = pair.inputText.length > LONG_INPUT || pair.inputText.split("\n").length > 4;
  const canVote = phase === "ready";
  const fade = reduce ? { initial: false, animate: { opacity: 1 } } : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="space-y-4">
      {versionMode && (
        <p data-testid="version-mode" className={cn(panelClass, "px-4 py-2 text-xs text-zinc-300")}>
          Old vs new prompts: version <span className="tabular-nums">{versionMode.old}</span> against the current{" "}
          <span className="tabular-nums">{versionMode.current}</span>. Both maps come from the same input, arm and model.
        </p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="min-w-0 text-base font-semibold text-zinc-100">{pair.inputTitle}</h2>
        <p className="text-sm tabular-nums text-zinc-400">{sessionVotes} this session · {totalVotes} total</p>
      </div>

      <div className={cn(panelClass, "px-4 py-3")}>
        <p id="compare-input" className={cn("whitespace-pre-wrap text-sm leading-relaxed text-zinc-300", long && !inputOpen && "line-clamp-3")}>
          {pair.inputText || "No input text."}
        </p>
        {long && (
          <button type="button" aria-expanded={inputOpen} aria-controls="compare-input" onClick={() => setInputOpen(!inputOpen)}
            className={cn("mt-1.5 inline-flex items-center gap-1 rounded text-xs text-zinc-400 hover:text-zinc-200", focusRing)}>
            <ChevronDown className={cn("size-3.5 transition-transform motion-reduce:transition-none", inputOpen && "rotate-180")} aria-hidden />
            {inputOpen ? "Show less" : "Show all"}
          </button>
        )}
      </div>

      <motion.div
        key={pairKey(pair)}
        {...fade}
        transition={{ duration: reduce ? 0 : 0.2, ease: "easeOut" }}
        className="grid gap-4 md:grid-cols-2"
        aria-busy={phase === "loading"}
      >
        {(["left", "right"] as const).map((side) => {
          const letter = side === "left" ? "A" : "B";
          const r = reveal?.[side];
          const won = reveal && reveal.winner === side;
          return (
            <div key={side} data-testid={side === "left" ? "compare-left" : "compare-right"} className="min-w-0 space-y-2">
              <div className="flex h-6 items-center justify-between gap-3">
                <span className={cn("text-sm font-semibold", won ? "text-violet-300" : "text-zinc-200")}>
                  Map {letter}{won ? " · preferred" : reveal?.winner === "tie" ? " · tie" : ""}
                </span>
                <AnimatePresence>
                  {r && (
                    <motion.span
                      data-testid={`reveal-${side}`}
                      initial={reduce ? false : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduce ? 0 : 0.18 }}
                      className="truncate text-xs tabular-nums text-zinc-300"
                    >
                      {armLabel(r.arm)} · {modelLabel(r.modelId)}{r.mapType ? ` · ${r.mapType}` : ""} · {usd(r.costUsd, 4)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className={cn("rounded-xl transition-shadow", won && "ring-2 ring-violet-400/70 ring-offset-2 ring-offset-zinc-950")}>
                <MapPreview elements={pair[side].elements} edges={pair[side].edges} height={PREVIEW_H} label={`Map ${letter}`} />
              </div>
            </div>
          );
        })}
      </motion.div>

      <div className={cn(panelClass, "flex flex-col gap-3 p-3 lg:flex-row lg:items-center")}>
        <Input
          aria-label="Reason for your vote (optional)"
          placeholder="Why? One line, optional"
          className={cn(fieldClass, "h-9 lg:flex-1")}
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <LabButton data-testid="vote-left" disabled={!canVote} busy={phase === "voting"} className="h-9" aria-keyshortcuts="A" onClick={() => void vote("left")}>
            A is better <Kbd>A</Kbd>
          </LabButton>
          <LabButton data-testid="vote-right" disabled={!canVote} className="h-9" aria-keyshortcuts="L" onClick={() => void vote("right")}>
            B is better <Kbd>L</Kbd>
          </LabButton>
          <LabButton data-testid="vote-tie" disabled={!canVote} className="h-9" aria-keyshortcuts="T" onClick={() => void vote("tie")}>
            Tie <Kbd>T</Kbd>
          </LabButton>
          <LabButton data-testid="vote-skip" tone="ghost" disabled={!canVote} className="h-9" aria-keyshortcuts="S" onClick={skip}>
            Skip <Kbd>S</Kbd>
          </LabButton>
        </div>
      </div>
      {voteError && <InlineError message={`Vote not saved: ${voteError.message}`} onRetry={() => void vote(voteError.winner)} />}
      {loadError && pair && <InlineError message={`Could not load the next pair: ${loadError}`} onRetry={() => void next()} />}
    </div>
  );
}

function CompareSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading pair">
      <div className="flex justify-between"><Skeleton className="h-5 w-64" /><Skeleton className="h-4 w-36" /></div>
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="rounded-xl" style={{ height: PREVIEW_H }} />
          </div>
        ))}
      </div>
      <Skeleton className="h-[60px] rounded-xl" />
    </div>
  );
}
