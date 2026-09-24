"use client";

import { useCallback, useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/toaster";
import type { LabModel } from "@/lib/lab/config";
import type { ArmId, JudgeId } from "@/lib/lab/types";
import type { MapType } from "@/lib/maps/types";
import { cn } from "@/lib/utils";
import { CompareView } from "./compare-view";
import { fetchJson, focusRing, InlineError, Skeleton } from "./lab-ui";
import { LeaderboardView } from "./leaderboard-view";
import { RunsView } from "./runs-view";

export interface LabMeta {
  models: LabModel[];
  arms: { id: ArmId; label: string }[];
  judges: { id: JudgeId; label: string; enabled: boolean }[];
  mapTypes: MapType[];
  confirmThresholdUsd: number;
  defaultBudgetUsd: number;
}

type Tab = "runs" | "compare" | "leaderboard";
const TABS: { id: Tab; label: string }[] = [
  { id: "runs", label: "Runs" },
  { id: "compare", label: "Compare" },
  { id: "leaderboard", label: "Leaderboard" },
];

export function LabApp() {
  const [tab, setTab] = useState<Tab>("runs");
  const [meta, setMeta] = useState<LabMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const loadMeta = useCallback(() => {
    setMetaError(null);
    fetchJson<LabMeta>("/api/lab/meta")
      .then(({ data }) => setMeta(data))
      .catch((e: Error) => setMetaError(e.message || "Could not load the lab configuration"));
  }, []);
  useEffect(loadMeta, [loadMeta]);

  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-300 antialiased">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-6">
            <div className="flex min-w-0 items-center gap-2">
              <FlaskConical className="size-4 shrink-0 text-zinc-400" aria-hidden />
              <h1 className="truncate text-sm font-semibold text-zinc-100">Structure Lab</h1>
              <span className="hidden rounded-md border border-white/10 px-1.5 py-px text-[11px] text-zinc-400 sm:inline">Dev only</span>
            </div>
            <TabsList className="ml-auto h-9 rounded-lg border border-white/10 bg-zinc-900/60 p-0.5">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  data-testid={`tab-${t.id}`}
                  className={cn(
                    "h-8 rounded-md px-3 text-sm text-zinc-400 transition-colors hover:text-zinc-200",
                    "data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-200 data-[state=active]:shadow-none",
                    focusRing,
                  )}
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-6 py-6">
          {metaError ? (
            <InlineError message={`Could not load the lab configuration: ${metaError}`} onRetry={loadMeta} />
          ) : !meta ? (
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]" aria-busy="true" aria-label="Loading">
              <Skeleton className="h-[420px] rounded-xl" />
              <Skeleton className="h-[560px] rounded-xl" />
            </div>
          ) : (
            <>
              <TabsContent value="runs" className="mt-0 focus-visible:ring-0">
                <RunsView meta={meta} />
              </TabsContent>
              <TabsContent value="compare" className="mt-0 focus-visible:ring-0">
                <CompareView meta={meta} />
              </TabsContent>
              <TabsContent value="leaderboard" className="mt-0 focus-visible:ring-0">
                <LeaderboardView meta={meta} />
              </TabsContent>
            </>
          )}
        </main>
      </Tabs>
      <Toaster />
    </div>
  );
}
