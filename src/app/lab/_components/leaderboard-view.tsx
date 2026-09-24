"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trophy } from "lucide-react";
import type { Leaderboard } from "@/lib/lab/lab-math";
import { parseVariantKey, type ArmId } from "@/lib/lab/types";
import { cn } from "@/lib/utils";
import type { LabMeta } from "./lab-app";
import { EmptyState, fetchJson, InlineError, LabButton, panelClass, pct, Skeleton, usd } from "./lab-ui";

const th = "px-3 pb-2 text-xs font-medium text-zinc-400";
const num = "text-right tabular-nums";

export function LeaderboardView({ meta }: { meta: LabMeta }) {
  const [lb, setLb] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allVersions, setAllVersions] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data } = await fetchJson<{ leaderboard: Leaderboard; currentPromptVersion: string }>(
        `/api/lab/leaderboard${allVersions ? "?versions=all" : ""}`,
      );
      setLb(data.leaderboard);
      setCurrentVersion(data.currentPromptVersion);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [allVersions]);
  useEffect(() => { void load(); }, [load]);

  if (error && !lb) return <InlineError message={`Could not load the leaderboard: ${error}`} onRetry={() => void load()} />;
  if (!lb) return <LeaderboardSkeleton />;

  const armLabel = (id: string) => meta.arms.find((a) => a.id === (id as ArmId))?.label ?? id;
  const modelLabel = (id: string) => meta.models.find((m) => m.id === id)?.label ?? id;
  const judgeLabel = (id: string) => meta.judges.find((j) => j.id === id)?.label ?? id;
  const variantLabel = (key: string) => {
    const { arm, modelId, forcedType } = parseVariantKey(key);
    return `${armLabel(arm)} × ${modelLabel(modelId)}${forcedType ? ` (forced ${forcedType})` : ""}`;
  };
  const versionToggle = (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
      <input
        type="checkbox"
        data-testid="all-versions"
        className="accent-violet-500"
        checked={allVersions}
        onChange={(e) => setAllVersions(e.target.checked)}
      />
      All prompt versions
    </label>
  );
  const versionNote = lb.promptVersion
    ? `Counting prompt version ${lb.promptVersion} only${lb.excludedCells ? ` (${lb.excludedCells} older or legacy cells and ${lb.excludedVotes} votes hidden)` : ""}.`
    : `Counting every prompt version, legacy included${currentVersion ? ` (current: ${currentVersion})` : ""}.`;

  if (lb.totalVotes === 0 && lb.rows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">{versionNote}</p>
          {versionToggle}
        </div>
        <EmptyState icon={Trophy} title="Vote on a few pairs to build the leaderboard." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-400">
          <span className="tabular-nums text-zinc-200">{lb.totalVotes}</span> votes · your consistency{" "}
          <span className="tabular-nums text-zinc-200">{pct(lb.selfConsistency)}</span> over{" "}
          <span className="tabular-nums text-zinc-200">{lb.repeatedPairs}</span> repeated pairs
        </p>
        <div className="flex items-center gap-4">
          {versionToggle}
          <LabButton tone="ghost" busy={busy} onClick={() => void load()}>
            {!busy && <RotateCcw aria-hidden />}
            Refresh
          </LabButton>
        </div>
      </div>
      <p className="-mt-4 text-xs text-zinc-400">{versionNote}</p>
      {error && <InlineError message={`Refresh failed: ${error}`} onRetry={() => void load()} />}
      {lb.totalVotes === 0 && (
        <p className={cn(panelClass, "px-4 py-3 text-sm text-zinc-300")}>Vote on a few pairs to build the leaderboard.</p>
      )}

      <section className={cn(panelClass, "overflow-x-auto pt-3")} aria-labelledby="lb-variants">
        <h2 id="lb-variants" className="px-3 pb-3 text-sm font-semibold text-zinc-100">Variants</h2>
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left">
              <th className={cn(th, "w-10", num)}>#</th>
              <th className={th}>Variant</th>
              <th className={cn(th, num)}>Elo</th>
              <th className={cn(th, num)} title="Wins / losses / ties">W / L / T</th>
              <th className={cn(th, num)}>Failure rate</th>
              <th className={cn(th, num)} title="What generating this variant's maps cost">Gen spend</th>
              <th className={cn(th, num)} title="What the LLM judges cost to grade them">Judge spend</th>
              <th className={cn(th, num)} title="Generation spend per win (judge cost excluded)">Cost per win</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {lb.rows.map((r, i) => (
              <tr key={r.variant} data-testid="leaderboard-row" className="text-zinc-300">
                <td className={cn("px-3 py-2.5 text-zinc-400", num)}>{i + 1}</td>
                <td className="px-3 py-2.5">
                  <span className="text-zinc-200">{armLabel(r.arm)}</span>
                  <span className="text-zinc-400"> × {modelLabel(r.modelId)}</span>
                  {r.forcedType && <span className="text-zinc-400"> (forced {r.forcedType})</span>}
                </td>
                <td className={cn("px-3 py-2.5 font-semibold text-zinc-100", num)}>{r.rating}</td>
                <td className={cn("px-3 py-2.5", num)}>{r.wins} / {r.games - r.wins - r.ties} / {r.ties}</td>
                <td className={cn("px-3 py-2.5", num, r.failureRate > 0.2 && "text-amber-400")}>
                  {pct(r.failureRate)} <span className="text-zinc-400">({r.failures}/{r.cells})</span>
                </td>
                <td className={cn("px-3 py-2.5", num)}>{usd(r.genCostUsd, 3)}</td>
                <td className={cn("px-3 py-2.5", num)}>{usd(r.judgeCostUsd, 3)}</td>
                <td className={cn("px-3 py-2.5", num)}>{r.costPerWin === null ? "-" : usd(r.costPerWin, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className={cn(panelClass, "overflow-x-auto pt-3")} aria-labelledby="lb-judges">
          <h2 id="lb-judges" className="px-3 text-sm font-semibold text-zinc-100">Judge agreement</h2>
          <p className="px-3 pb-3 pt-1 text-xs text-zinc-400">
            How often each judge preferred the map you preferred. Your own consistency ({pct(lb.selfConsistency)}) is the ceiling.
            &ldquo;Excl. own model&rdquo; skips votes where either map came from the judge&rsquo;s own model.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className={th}>Judge</th>
                <th className={cn(th, num)}>Agreement</th>
                <th className={cn(th, num)} title="Agreement on votes where neither map was generated by the judge's own model">Excl. own model</th>
                <th className={cn(th, num)}>Votes compared</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {lb.judges.map((j) => (
                <tr key={j.judgeId} className="text-zinc-300">
                  <td className="px-3 py-2.5">{judgeLabel(j.judgeId)}</td>
                  <td className={cn("px-3 py-2.5 font-semibold text-zinc-100", num)}>{pct(j.agreement)}</td>
                  <td className={cn("px-3 py-2.5", num)} title={`${j.comparedExSelf} votes compared`}>
                    {pct(j.agreementExSelf)} <span className="text-zinc-400">({j.comparedExSelf})</span>
                  </td>
                  <td className={cn("px-3 py-2.5", num)}>{j.compared}</td>
                </tr>
              ))}
              <tr className="text-zinc-300">
                <td className="px-3 py-2.5 text-zinc-400">You, on repeated pairs</td>
                <td className={cn("px-3 py-2.5 font-semibold text-zinc-100", num)}>{pct(lb.selfConsistency)}</td>
                <td className={cn("px-3 py-2.5", num)}>-</td>
                <td className={cn("px-3 py-2.5", num)}>{lb.repeatedPairs}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className={cn(panelClass, "overflow-x-auto pt-3")} aria-labelledby="lb-types">
          <h2 id="lb-types" className="px-3 pb-3 text-sm font-semibold text-zinc-100">By map type</h2>
          {lb.byMapType.length === 0 ? (
            <p className="px-3 pb-4 text-sm text-zinc-400">No votes on typed maps yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className={th}>Map type</th>
                  <th className={th}>Variant</th>
                  <th className={cn(th, num)}>Wins / games</th>
                  <th className={cn(th, num)}>Win rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lb.byMapType.map((r) => (
                  <tr key={`${r.mapType}-${r.variant}`} className="text-zinc-300">
                    <td className="px-3 py-2.5 text-zinc-200">{r.mapType}</td>
                    <td className="px-3 py-2.5">{variantLabel(r.variant)}</td>
                    <td className={cn("px-3 py-2.5", num)}>{r.wins} / {r.games}</td>
                    <td className={cn("px-3 py-2.5", num)}>{pct(r.games ? r.wins / r.games : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading leaderboard">
      <Skeleton className="h-5 w-80" />
      <div className={cn(panelClass, "space-y-3 p-3")}>
        <Skeleton className="h-4 w-24" />
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}
