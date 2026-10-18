"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, RotateCcw, Trash2, Undo2, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { LibraryItem, LibraryStatus, LibraryView as LibraryData } from "@/lib/lab/library-store";
import type { CoverageItem } from "@/lib/maps/exemplars/coverage";
import { MAP_TYPES, NODE_KINDS } from "@/lib/maps/types";
import { cn } from "@/lib/utils";
import { EmptyState, fetchJson, fieldClass, InlineError, LabButton, panelClass, postJson, Skeleton } from "./lab-ui";
import { MapPreview } from "./map-preview";

const STATUS_LABEL: Record<LibraryStatus, string> = { authored: "Authored", published: "Published", pending: "Pending", retiring: "Retiring" };
const STATUS_TONE: Record<LibraryStatus, string> = {
  authored: "text-zinc-400", published: "text-emerald-400", pending: "text-violet-300", retiring: "text-amber-400",
};
const INPUT_TYPES = ["brainDump", "canvasCards", "topic", "comparison"] as const;
const PREVIEW_H = 180;
const th = "px-2 pb-2 text-xs font-medium text-zinc-400";

type Filters = { mapType: string; inputType: string; kind: string; status: string };
const NO_FILTERS: Filters = { mapType: "", inputType: "", kind: "", status: "" };

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-xs font-medium text-zinc-400">{label}</span>
      <select className={cn(fieldClass, "h-9 w-full border px-2 text-sm")} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function LibraryView() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data: body } = await fetchJson<LibraryData>("/api/lab/library");
      setData(body);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const items = useMemo(() => (data?.items ?? []).filter((i) =>
    (!filters.mapType || i.tags.mapType === filters.mapType) &&
    (!filters.inputType || i.tags.inputType === filters.inputType) &&
    (!filters.kind || (i.tags.kinds as string[]).includes(filters.kind)) &&
    (!filters.status || i.status === filters.status)), [data, filters]);

  // Kinds by map type over the library as it stands (pending examples not yet counted).
  const matrix = useMemo(() => {
    const live = (data?.items ?? []).filter((i) => i.status !== "pending");
    return NODE_KINDS.map((kind) => ({
      kind,
      counts: MAP_TYPES.map((t) => live.filter((i) => i.tags.mapType === t && (i.tags.kinds as string[]).includes(kind)).length),
    }));
  }, [data]);

  async function retire(item: LibraryItem, undo: boolean) {
    setBusyId(item.id);
    setActionError(null);
    try {
      const { status, data: body } = await fetchJson<{ error?: string }>("/api/lab/library/retire", postJson({ id: item.id, undo }));
      if (status === 409) throw new Error(body.error ?? "Refused");
      await load();
    } catch (e) {
      setActionError(`${item.title}: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function publish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const { status, data: body } = await fetchJson<{
        error?: string; written?: string[]; removed?: string[]; promptVersion?: { before: string; after: string };
      }>("/api/lab/library/publish", postJson({}));
      if (status === 409 || !body.promptVersion) throw new Error(body.error ?? "Publish refused");
      toast({
        title: "Library published",
        description: `${body.written?.length ?? 0} added, ${body.removed?.length ?? 0} removed. Prompt version ${body.promptVersion.before} is now ${body.promptVersion.after}. Commit src/lib/maps/exemplars/promoted/ with git.`,
      });
      setConfirming(false);
      await load();
    } catch (e) {
      setPublishError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  if (error && !data) return <InlineError message={`Could not load the library: ${error}`} onRetry={() => void load()} />;
  if (!data) return <LibrarySkeleton />;

  const changes = data.pendingCount + data.retiringCount;
  const counts = (s: LibraryStatus) => data.items.filter((i) => i.status === s).length;
  const afterByLabel = new Map<string, CoverageItem>(data.coverage.afterPublish.map((c): [string, CoverageItem] => [c.label, c]));
  const reloadNeeded = data.promptVersion.running !== data.promptVersion.onDisk;

  return (
    <div className="space-y-4">
      <div className={cn(panelClass, "flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3")}>
        <dl className="flex flex-wrap gap-6 text-sm tabular-nums">
          {(["authored", "published", "pending", "retiring"] as const).map((s) => (
            <div key={s}><dt className="text-xs text-zinc-400">{STATUS_LABEL[s]}</dt><dd className="text-zinc-200">{counts(s)}</dd></div>
          ))}
          <div>
            <dt className="text-xs text-zinc-400">Prompt version</dt>
            <dd className="text-zinc-200">{data.promptVersion.running}{changes ? ` (after publish: ${data.promptVersion.afterPublish})` : ""}</dd>
          </div>
        </dl>
        <div className="ml-auto">
          {confirming ? (
            <div role="alertdialog" aria-label="Confirm publish" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2">
              <p className="text-sm text-zinc-200">
                Write {data.pendingCount} example{data.pendingCount === 1 ? "" : "s"} and remove {data.retiringCount} in src/lib/maps/exemplars/promoted/? The prompt version changes once.
              </p>
              <LabButton tone="primary" data-testid="confirm-publish" busy={publishing} autoFocus onClick={() => void publish()}>Publish</LabButton>
              <LabButton tone="ghost" disabled={publishing} onClick={() => setConfirming(false)}>Cancel</LabButton>
            </div>
          ) : (
            <LabButton
              tone="primary"
              data-testid="publish-library"
              disabled={changes === 0}
              title={changes === 0 ? "Nothing to publish: promote or retire an example first" : undefined}
              onClick={() => setConfirming(true)}
            >
              <Upload aria-hidden />
              Publish library update
            </LabButton>
          )}
        </div>
      </div>
      {reloadNeeded && (
        <p className="flex items-start gap-2 text-xs text-amber-400">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          The published library on disk ({data.promptVersion.onDisk}) differs from the one this server runs ({data.promptVersion.running}). Save any file or restart the dev server to reload it.
        </p>
      )}
      {publishError && <InlineError message={publishError} onRetry={() => void publish()} />}
      {actionError && <InlineError message={actionError} />}
      {error && <InlineError message={`Refresh failed: ${error}`} onRetry={() => void load()} />}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className={cn(panelClass, "grid gap-3 p-3 sm:grid-cols-4")}>
            <FilterSelect label="Map type" value={filters.mapType} options={MAP_TYPES.map((t) => ({ value: t, label: t }))} onChange={(v) => setFilters({ ...filters, mapType: v })} />
            <FilterSelect label="Input type" value={filters.inputType} options={INPUT_TYPES.map((t) => ({ value: t, label: t }))} onChange={(v) => setFilters({ ...filters, inputType: v })} />
            <FilterSelect label="Kind" value={filters.kind} options={NODE_KINDS.map((k) => ({ value: k, label: k }))} onChange={(v) => setFilters({ ...filters, kind: v })} />
            <FilterSelect label="Status" value={filters.status}
              options={(["authored", "published", "pending", "retiring"] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              onChange={(v) => setFilters({ ...filters, status: v })} />
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No examples match these filters."
              action={<LabButton tone="ghost" onClick={() => setFilters(NO_FILTERS)}>Clear filters</LabButton>}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((item) => (
                <article key={item.id} data-testid="library-item" className={cn(panelClass, "flex flex-col gap-3 p-3")}>
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-zinc-200" title={item.title}>{item.title}</h3>
                      <p className="truncate text-xs text-zinc-400">{item.tags.mapType} · {item.tags.inputType}{item.provenance.modelId ? ` · ${item.provenance.modelId}` : ""}</p>
                    </div>
                    <span className={cn("whitespace-nowrap text-xs font-medium", STATUS_TONE[item.status])}>{STATUS_LABEL[item.status]}</span>
                  </header>
                  <MapPreview elements={item.elements} edges={item.edges} height={PREVIEW_H} label={item.title} />
                  <p className="line-clamp-2 text-xs text-zinc-300" title={item.note}>{item.note}</p>
                  <div className="flex flex-wrap gap-1">
                    {item.tags.kinds.map((k) => (
                      <span key={k} className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-px text-[11px] text-zinc-300">{k}</span>
                    ))}
                    {item.tags.pairings.map((p) => (
                      <span key={p} className="rounded-md border border-violet-400/20 bg-violet-400/[0.06] px-1.5 py-px text-[11px] text-violet-200">{p}</span>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center gap-2">
                    {item.status === "retiring" ? (
                      <LabButton tone="ghost" className="h-8" busy={busyId === item.id} onClick={() => void retire(item, true)}>
                        <Undo2 aria-hidden />
                        Restore
                      </LabButton>
                    ) : (
                      <LabButton
                        tone="ghost"
                        className="h-8"
                        busy={busyId === item.id}
                        disabled={item.retireBlocked !== null}
                        title={item.retireBlocked ?? undefined}
                        onClick={() => void retire(item, false)}
                      >
                        <Trash2 aria-hidden />
                        {item.status === "pending" ? "Remove" : "Retire"}
                      </LabButton>
                    )}
                    {item.retireBlocked && <span className="truncate text-xs text-zinc-400">{item.retireBlocked}</span>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <section className={cn(panelClass, "overflow-x-auto pt-3")} aria-labelledby="lib-matrix">
            <h2 id="lib-matrix" className="px-3 text-sm font-semibold text-zinc-100">Kinds by map type</h2>
            <p className="px-3 pb-2 pt-1 text-xs text-zinc-400">Examples using each kind, per map type (published and authored).</p>
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr>
                  <th className={cn(th, "text-left")}>Kind</th>
                  {MAP_TYPES.map((t) => <th key={t} className={cn(th, "text-right")} title={t}>{t.slice(0, 3)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {matrix.map((row) => (
                  <tr key={row.kind} className="text-zinc-300">
                    <td className="px-2 py-1.5 text-zinc-200">{row.kind}</td>
                    {row.counts.map((n, i) => (
                      <td key={MAP_TYPES[i]} className={cn("px-2 py-1.5 text-right", n === 0 && "text-zinc-600")}>{n || "·"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={cn(panelClass, "overflow-x-auto pt-3")} aria-labelledby="lib-coverage">
            <h2 id="lib-coverage" className="px-3 pb-2 text-sm font-semibold text-zinc-100">Coverage requirements</h2>
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr>
                  <th className={cn(th, "text-left")}>Requirement</th>
                  <th className={cn(th, "text-right")}>Now</th>
                  <th className={cn(th, "text-right")}>After publish</th>
                  <th className={cn(th, "text-right")}>Min</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.coverage.current.map((c) => {
                  const after = afterByLabel.get(c.label)?.count ?? c.count;
                  const met = after >= c.min;
                  return (
                    <tr key={c.label} className="text-zinc-300">
                      <td className="px-2 py-1.5">
                        <span className="inline-flex items-center gap-1.5">
                          {met
                            ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" aria-label="met" />
                            : <AlertTriangle className="size-3.5 shrink-0 text-amber-400" aria-label="below minimum" />}
                          {c.label}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right">{c.count}</td>
                      <td className={cn("px-2 py-1.5 text-right", after !== c.count && "text-violet-300")}>{after}</td>
                      <td className="px-2 py-1.5 text-right text-zinc-400">{c.min}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
          <LabButton tone="ghost" onClick={() => void load()}>
            <RotateCcw aria-hidden />
            Refresh
          </LabButton>
        </aside>
      </div>
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading library">
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[300px] rounded-xl" />)}
        </div>
        <Skeleton className="h-[520px] rounded-xl" />
      </div>
    </div>
  );
}
