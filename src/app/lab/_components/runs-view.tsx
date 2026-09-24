"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Plus, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { estimateRunCost } from "@/lib/lab/lab-math";
import type { ArmId, Cell, InputType, JudgeId, LabInput, Run, RunConfig, RunSummary } from "@/lib/lab/types";
import type { MapType } from "@/lib/maps/types";
import { cn } from "@/lib/utils";
import type { LabMeta } from "./lab-app";
import {
  checkboxClass, fetchJson, fieldClass, focusRing, InlineError, LabButton, panelClass, postJson,
  shortTime, Skeleton, StatusLabel, usd,
} from "./lab-ui";
import { MapPreview } from "./map-preview";

const TYPE_LABELS: Record<InputType, string> = {
  brainDump: "Brain dumps",
  canvasCards: "Canvas cards",
  topic: "Topics",
  comparison: "Comparisons",
};
const INPUT_TYPES = Object.keys(TYPE_LABELS) as InputType[];
const POLL_MS = 2000;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

type View = { kind: "new" } | { kind: "run"; id: string };

export function RunsView({ meta }: { meta: LabMeta }) {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<LabInput[] | null>(null);
  const [inputsError, setInputsError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "new" });

  const loadRuns = useCallback(async () => {
    try {
      const { data } = await fetchJson<{ runs: RunSummary[] }>("/api/lab/runs");
      setRuns(data.runs ?? []);
      setRunsError(null);
    } catch (e) {
      setRunsError((e as Error).message);
    }
  }, []);

  const loadInputs = useCallback(async () => {
    try {
      const { data } = await fetchJson<{ inputs: LabInput[] }>("/api/lab/inputs");
      setInputs(data.inputs ?? []);
      setInputsError(null);
    } catch (e) {
      setInputsError((e as Error).message);
    }
  }, []);

  useEffect(() => { void loadRuns(); void loadInputs(); }, [loadRuns, loadInputs]);

  // Poll the list only while something is running; each response re-arms the timer.
  const anyRunning = !!runs?.some((r) => r.status === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const t = setTimeout(() => void loadRuns(), POLL_MS);
    return () => clearTimeout(t);
  }, [runs, anyRunning, loadRuns]);

  const inputsById = useMemo(() => new Map((inputs ?? []).map((i) => [i.id, i])), [inputs]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className={cn(panelClass, "lg:sticky lg:top-20")} aria-label="Runs">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">Runs</h2>
          <LabButton tone={view.kind === "new" ? "secondary" : "primary"} data-testid="new-run" className="h-8" onClick={() => setView({ kind: "new" })}>
            <Plus aria-hidden />
            New run
          </LabButton>
        </div>
        <RunList
          runs={runs}
          error={runsError}
          onRetry={() => void loadRuns()}
          selectedId={view.kind === "run" ? view.id : null}
          onSelect={(id) => setView({ kind: "run", id })}
          onNew={() => setView({ kind: "new" })}
        />
      </aside>

      <section className="min-w-0">
        {view.kind === "new" ? (
          <NewRunForm
            meta={meta}
            inputs={inputs}
            inputsError={inputsError}
            onReloadInputs={loadInputs}
            onStarted={(id) => { setView({ kind: "run", id }); void loadRuns(); }}
          />
        ) : (
          <RunDetail key={view.id} runId={view.id} meta={meta} inputsById={inputsById} onChanged={() => void loadRuns()} />
        )}
      </section>
    </div>
  );
}

// ─── Runs list ───────────────────────────────────────────────────────

function RunList({ runs, error, onRetry, selectedId, onSelect, onNew }: {
  runs: RunSummary[] | null; error: string | null; onRetry: () => void;
  selectedId: string | null; onSelect: (id: string) => void; onNew: () => void;
}) {
  if (error && !runs) return <div className="p-3"><InlineError message={`Could not load runs: ${error}`} onRetry={onRetry} /></div>;
  if (!runs) {
    return (
      <ul className="divide-y divide-white/5" aria-busy="true" aria-label="Loading runs">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="space-y-2 px-4 py-3">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-48" />
          </li>
        ))}
      </ul>
    );
  }
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="text-sm text-zinc-300">No runs yet</p>
        <LabButton tone="primary" onClick={onNew}><Plus aria-hidden />New run</LabButton>
      </div>
    );
  }
  return (
    <ul className="max-h-[calc(100vh-10rem)] divide-y divide-white/5 overflow-y-auto">
      {error && <li className="p-3"><InlineError message={`Refresh failed: ${error}`} onRetry={onRetry} /></li>}
      {runs.map((r) => {
        const selected = r.id === selectedId;
        return (
          <li key={r.id}>
            <button
              type="button"
              data-testid="run-row"
              aria-current={selected ? "true" : undefined}
              onClick={() => onSelect(r.id)}
              className={cn(
                "flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors",
                selected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
                focusRing, "focus-visible:ring-inset",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm text-zinc-200">{shortTime(r.createdAt)}</span>
                <StatusLabel status={r.status} />
              </span>
              <span className="flex items-center justify-between gap-2 text-xs tabular-nums text-zinc-400">
                <span>{r.doneCount}/{r.cellCount} done</span>
                <span>{usd(r.spentUsd)} of {usd(r.config.budgetUsd)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── New run ─────────────────────────────────────────────────────────

function Fieldset({ legend, children, aside }: { legend: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <div className="flex items-center justify-between">
        <legend className="text-sm font-medium text-zinc-200">{legend}</legend>
        {aside}
      </div>
      {children}
    </fieldset>
  );
}

function CheckRow({ checked, onChange, disabled, testId, children, detail }: {
  checked: boolean; onChange: () => void; disabled?: boolean; testId?: string; children: React.ReactNode; detail?: React.ReactNode;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03]", disabled && "cursor-not-allowed opacity-60")}>
      <input type="checkbox" className={checkboxClass} data-testid={testId} checked={checked} disabled={disabled} onChange={onChange} />
      <span className="min-w-0 flex-1 truncate text-zinc-300">{children}</span>
      {detail && <span className="shrink-0 text-xs tabular-nums text-zinc-400">{detail}</span>}
    </label>
  );
}

function TypeGroup({ type, items, selected, onChange }: {
  type: InputType; items: LabInput[]; selected: string[]; onChange: (ids: string[]) => void;
}) {
  const ids = items.map((i) => i.id);
  const count = ids.filter((id) => selected.includes(id)).length;
  const all = items.length > 0 && count === items.length;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = count > 0 && !all; }, [count, all]);

  return (
    <div>
      <label className="flex cursor-pointer items-center gap-2.5 px-2 py-1.5">
        <input
          ref={ref}
          type="checkbox"
          className={checkboxClass}
          data-testid={`select-all-${type}`}
          aria-label={`Select all ${TYPE_LABELS[type]}`}
          checked={all}
          disabled={items.length === 0}
          onChange={() => onChange(all ? selected.filter((id) => !ids.includes(id)) : Array.from(new Set([...selected, ...ids])))}
        />
        <span className="flex-1 text-xs font-medium text-zinc-400">{TYPE_LABELS[type]}</span>
        <span className="text-xs tabular-nums text-zinc-400">{count}/{items.length}</span>
      </label>
      <div className="ml-4 border-l border-white/5 pl-2">
        {items.map((i) => (
          <CheckRow key={i.id} testId={`input-option-${i.id}`} checked={selected.includes(i.id)} onChange={() => onChange(toggle(selected, i.id))}
            detail={i.custom ? "custom" : undefined}>
            <span title={i.title}>{i.title}</span>
          </CheckRow>
        ))}
      </div>
    </div>
  );
}

function AddInput({ onAdded }: { onAdded: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", type: "brainDump" as InputType, text: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = draft.title.trim() && draft.text.trim();

  async function add() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await fetchJson("/api/lab/inputs", postJson(draft));
      setDraft({ title: "", type: draft.type, text: "" });
      await onAdded();
      toast({ title: "Input added" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-white/10">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
        className={cn("flex w-full items-center gap-2 px-3 py-2.5 text-sm text-zinc-400 hover:text-zinc-200", focusRing, "focus-visible:ring-inset")}>
        <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", open ? "rotate-0" : "-rotate-90")} aria-hidden />
        Add an input
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          <div className="flex gap-2">
            <Input aria-label="Input title" placeholder="Title" className={cn(fieldClass, "h-9")} value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <select aria-label="Input type" className={cn(fieldClass, "h-9 border px-2 text-sm")} value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as InputType })}>
              {INPUT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <Textarea aria-label="Input text" placeholder="Paste the messy input" className={cn(fieldClass, "h-28")} value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          {error && <InlineError message={error} onRetry={() => void add()} />}
          <LabButton tone="secondary" busy={busy} disabled={!valid} onClick={() => void add()}>Add input</LabButton>
        </div>
      )}
    </div>
  );
}

function NewRunForm({ meta, inputs, inputsError, onReloadInputs, onStarted }: {
  meta: LabMeta; inputs: LabInput[] | null; inputsError: string | null;
  onReloadInputs: () => Promise<void>; onStarted: (runId: string) => void;
}) {
  const [inputIds, setInputIds] = useState<string[]>([]);
  const [arms, setArms] = useState<ArmId[]>(["graph"]);
  const [modelIds, setModelIds] = useState<string[]>(["claude-sonnet-5"]);
  const [judges, setJudges] = useState<JudgeId[]>(["rubric", "structure"]);
  const [forcedType, setForcedType] = useState<MapType | null>(null);
  const [budgetText, setBudgetText] = useState(String(meta.defaultBudgetUsd));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmUsd, setConfirmUsd] = useState<number | null>(null);

  const budgetUsd = Number(budgetText);
  const budgetValid = Number.isFinite(budgetUsd) && budgetUsd > 0 && budgetUsd <= 200;
  const config: RunConfig = useMemo(
    () => ({ inputIds, arms, modelIds, forcedType, judges, budgetUsd }),
    [inputIds, arms, modelIds, forcedType, judges, budgetUsd],
  );
  const cellCount = inputIds.length * arms.length * modelIds.length;
  const estimate = cellCount > 0 ? estimateRunCost(config) : 0;
  const overBudget = budgetValid && estimate > budgetUsd;
  const needsConfirm = estimate > meta.confirmThresholdUsd;

  // Any change to the config invalidates a pending confirmation.
  useEffect(() => { setConfirmUsd(null); }, [config]);

  async function start(confirmed = false) {
    setBusy(true);
    setError(null);
    try {
      const { status, data } = await fetchJson<{ run?: RunSummary; needsConfirmation?: boolean; estimateUsd?: number }>(
        "/api/lab/runs", postJson({ config, confirmed }),
      );
      if (status === 409 && data.needsConfirmation) {
        setConfirmUsd(data.estimateUsd ?? estimate);
        return;
      }
      if (!data.run) throw new Error("The server did not return a run");
      setConfirmUsd(null);
      toast({ title: "Run started", description: `${data.run.cellCount} cells` });
      onStarted(data.run.id);
    } catch (e) {
      setError((e as Error).message || "Could not start the run");
    } finally {
      setBusy(false);
    }
  }

  const grouped = INPUT_TYPES.map((type) => ({ type, items: (inputs ?? []).filter((i) => i.type === type) }));

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className={panelClass}>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">Inputs</h2>
          <span className="text-xs tabular-nums text-zinc-400">{inputIds.length} selected</span>
        </div>
        {inputsError && !inputs ? (
          <div className="p-3"><InlineError message={`Could not load inputs: ${inputsError}`} onRetry={() => void onReloadInputs()} /></div>
        ) : !inputs ? (
          <div className="grid gap-2 p-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading inputs">
            {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-7" />)}
          </div>
        ) : (
          <div className="grid gap-x-4 gap-y-3 p-2 sm:grid-cols-2">
            {grouped.map(({ type, items }) => (
              <TypeGroup key={type} type={type} items={items} selected={inputIds} onChange={setInputIds} />
            ))}
          </div>
        )}
        <AddInput onAdded={onReloadInputs} />
      </div>

      <div className="space-y-4 xl:sticky xl:top-20">
        <div className={cn(panelClass, "space-y-5 p-4")}>
          <Fieldset legend="Arms">
            <div>
              {meta.arms.map((a) => (
                <CheckRow key={a.id} testId={`arm-${a.id}`} checked={arms.includes(a.id)} onChange={() => setArms(toggle(arms, a.id))}>
                  {a.label}
                </CheckRow>
              ))}
            </div>
          </Fieldset>
          <Fieldset legend="Models">
            <div>
              {meta.models.map((m) => (
                <CheckRow key={m.id} testId={`model-${m.id}`} checked={modelIds.includes(m.id)} onChange={() => setModelIds(toggle(modelIds, m.id))}
                  detail={`${usd(m.inputPerMTok)} / ${usd(m.outputPerMTok)}`}>
                  {m.label} <span className="text-zinc-400">{m.tier}</span>
                </CheckRow>
              ))}
            </div>
          </Fieldset>
          <Fieldset legend="Judges">
            <div>
              {meta.judges.map((j) => (
                <CheckRow key={j.id} testId={`judge-${j.id}`} disabled={!j.enabled} checked={judges.includes(j.id)} onChange={() => setJudges(toggle(judges, j.id))}
                  detail={j.enabled ? undefined : "unavailable"}>
                  {j.label}
                </CheckRow>
              ))}
            </div>
          </Fieldset>
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
            <label className="space-y-1.5">
              <span className="block text-sm font-medium text-zinc-200">Map type</span>
              <select className={cn(fieldClass, "h-9 w-full border px-2 text-sm")} value={forcedType ?? ""}
                onChange={(e) => setForcedType((e.target.value || null) as MapType | null)}>
                <option value="">Model chooses</option>
                {meta.mapTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="block text-sm font-medium text-zinc-200">Budget ($)</span>
              <Input type="number" min={0.5} max={200} step={0.5} data-testid="budget" aria-invalid={!budgetValid}
                className={cn(fieldClass, "h-9 tabular-nums", !budgetValid && "border-rose-400/50")}
                value={budgetText} onChange={(e) => setBudgetText(e.target.value)} />
            </label>
          </div>
        </div>

        <div className={cn(panelClass, "space-y-3 p-4")}>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-zinc-400">Cells</dt><dd className="tabular-nums text-zinc-200">{cellCount}</dd></div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Estimated cost</dt>
              <dd data-testid="estimate" className="tabular-nums text-zinc-100">{usd(estimate)}</dd>
            </div>
            <div className="flex justify-between"><dt className="text-zinc-400">Budget</dt><dd className="tabular-nums text-zinc-200">{budgetValid ? usd(budgetUsd) : "-"}</dd></div>
          </dl>
          {overBudget && (
            <p className="flex items-start gap-2 text-xs text-amber-400">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              The estimate is over budget: the run stops once the budget is spent.
            </p>
          )}
          {!budgetValid && <p className="text-xs text-rose-400">Budget must be between $0.50 and $200.</p>}

          {confirmUsd !== null ? (
            <div role="alertdialog" aria-label="Confirm run cost" className="space-y-3 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3">
              <p className="text-sm text-zinc-200">
                This run is estimated at <span className="font-semibold tabular-nums">{usd(confirmUsd)}</span> for {cellCount} cells,
                over the {usd(meta.confirmThresholdUsd)} check. Start it?
              </p>
              <div className="flex gap-2">
                <LabButton tone="primary" data-testid="confirm-run" busy={busy} autoFocus onClick={() => void start(true)}>Start anyway</LabButton>
                <LabButton tone="ghost" disabled={busy} onClick={() => setConfirmUsd(null)}>Cancel</LabButton>
              </div>
            </div>
          ) : (
            <LabButton tone="primary" size="default" data-testid="start-run" className="w-full" busy={busy}
              disabled={cellCount === 0 || !budgetValid} onClick={() => void start()}>
              {busy ? "Starting" : needsConfirm ? "Review and start" : "Start run"}
            </LabButton>
          )}
          {error && <InlineError message={error} onRetry={() => void start(confirmUsd !== null)} />}
        </div>
      </div>
    </div>
  );
}

// ─── Run detail ──────────────────────────────────────────────────────

function RunDetail({ runId, meta, inputsById, onChanged }: {
  runId: string; meta: LabMeta; inputsById: Map<string, LabInput>; onChanged: () => void;
}) {
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const { data } = await fetchJson<{ run: Run }>(`/api/lab/runs/${encodeURIComponent(runId)}`);
      setRun(data.run);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [runId]);

  useEffect(() => { void load(); }, [load]);

  // Poll while the run (or a retried cell) is in flight; stop once it settles.
  const active = run?.status === "running" || retrying.size > 0;
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => void load(), POLL_MS);
    return () => clearTimeout(t);
  }, [run, active, load]);

  const wasRunning = useRef(false);
  useEffect(() => {
    if (!run) return;
    if (wasRunning.current && run.status !== "running") onChanged();
    wasRunning.current = run.status === "running";
  }, [run, onChanged]);

  async function retry(cellId: string) {
    setRetrying((s) => new Set(s).add(cellId));
    setRetryErrors((m) => { const n = { ...m }; delete n[cellId]; return n; });
    setRun((r) => r && { ...r, cells: r.cells.map((c) => (c.id === cellId ? { ...c, status: "running", error: null } : c)) });
    try {
      const { data } = await fetchJson<{ run: Run }>(`/api/lab/runs/${encodeURIComponent(runId)}/retry`, postJson({ cellId }));
      setRun(data.run);
      onChanged();
    } catch (e) {
      setRetryErrors((m) => ({ ...m, [cellId]: (e as Error).message }));
      void load();
    } finally {
      setRetrying((s) => { const n = new Set(s); n.delete(cellId); return n; });
    }
  }

  if (error && !run) return <InlineError message={`Could not load this run: ${error}`} onRetry={() => void load()} />;
  if (!run) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading run">
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[292px] rounded-xl" />)}
        </div>
      </div>
    );
  }

  const done = run.cells.filter((c) => c.status === "done").length;
  const bad = run.cells.filter((c) => c.status === "failed" || c.status === "error").length;
  const armLabel = (id: ArmId) => meta.arms.find((a) => a.id === id)?.label ?? id;
  const modelLabel = (id: string) => meta.models.find((m) => m.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      <div className={cn(panelClass, "flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3")}>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100">Run from {shortTime(run.createdAt)}</h2>
          <p className="truncate text-xs text-zinc-400">
            {run.config.arms.map(armLabel).join(", ")} × {run.config.modelIds.map(modelLabel).join(", ")}
            {run.config.forcedType ? ` · ${run.config.forcedType}` : ""}
          </p>
        </div>
        <StatusLabel status={run.status} testId="run-status" className="text-sm" />
        <dl className="ml-auto flex gap-6 text-sm tabular-nums">
          <div><dt className="text-xs text-zinc-400">Progress</dt><dd className="text-zinc-200">{done}/{run.cells.length} done</dd></div>
          <div><dt className="text-xs text-zinc-400">Spend</dt><dd className="text-zinc-200">{usd(run.spentUsd, 3)} of {usd(run.config.budgetUsd)}</dd></div>
          <div><dt className="text-xs text-zinc-400">Estimate</dt><dd className="text-zinc-200">{usd(run.estimateUsd)}</dd></div>
          {bad > 0 && <div><dt className="text-xs text-zinc-400">Failed</dt><dd className="text-amber-400">{bad}</dd></div>}
        </dl>
      </div>
      {error && <InlineError message={`Refresh failed: ${error}`} onRetry={() => void load()} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {run.cells.map((c) => (
          <CellTile
            key={c.id}
            cell={c}
            title={inputsById.get(c.inputId)?.title ?? c.inputId}
            armLabel={armLabel(c.arm)}
            modelLabel={modelLabel(c.modelId)}
            retrying={retrying.has(c.id)}
            retryError={retryErrors[c.id]}
            onRetry={() => void retry(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

const PREVIEW_H = 200;

function CellTile({ cell: c, title, armLabel, modelLabel, retrying, retryError, onRetry }: {
  cell: Cell; title: string; armLabel: string; modelLabel: string; retrying: boolean; retryError?: string; onRetry: () => void;
}) {
  const failed = c.status === "failed" || c.status === "error";
  const problems = [c.error, ...c.structureViolations].filter(Boolean) as string[];
  return (
    <article data-testid="cell-tile" className={cn(panelClass, "flex flex-col gap-3 p-3")}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-zinc-200" title={title}>{title}</h3>
          <p className="truncate text-xs text-zinc-400" title={`${armLabel} · ${modelLabel}`}>
            {armLabel} · {modelLabel}{c.mapType ? ` · ${c.mapType}` : ""}
          </p>
        </div>
        <StatusLabel status={c.status} testId="cell-status" />
      </header>

      {c.status === "pending" || c.status === "running" ? (
        <Skeleton className="rounded-xl" style={{ height: PREVIEW_H }} />
      ) : c.elements.length > 0 ? (
        <MapPreview elements={c.elements} edges={c.edges} height={PREVIEW_H} label={`${title}, ${armLabel}, ${modelLabel}`} />
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-400" style={{ height: PREVIEW_H }}>
          {c.status === "skipped" ? "Skipped: budget reached" : "No map produced"}
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-zinc-400">
        {c.latencyMs > 0 && <span>{(c.latencyMs / 1000).toFixed(1)}s</span>}
        {c.costUsd > 0 && <span>{usd(c.costUsd, 4)}</span>}
        {c.judges.map((j) => (
          <span key={j.judgeId} title={j.notes || undefined}>{j.judgeId} {j.overall === null ? "-" : j.overall.toFixed(1)}</span>
        ))}
      </div>

      {problems.length > 0 && failed && (
        <p className="line-clamp-2 text-xs text-zinc-400" title={problems.join("\n")}>{problems.join("; ")}</p>
      )}
      {retryError && <InlineError message={`Retry failed: ${retryError}`} />}
      {(failed || retrying) && (
        <LabButton tone="secondary" className="h-8 self-start" busy={retrying} onClick={onRetry}>
          {!retrying && <RotateCcw aria-hidden />}
          Retry
        </LabButton>
      )}
    </article>
  );
}
