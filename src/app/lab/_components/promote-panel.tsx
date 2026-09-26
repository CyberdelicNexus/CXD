"use client";

// "Make this an example": the promote panel shared by the Runs detail and
// Compare. The server decides eligibility (structure, legend, crossings) and
// what the example would add to the library's coverage.
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BookmarkPlus, CheckCircle2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import type { CoverageGain } from "@/lib/maps/exemplars/coverage";
import type { ExemplarTags } from "@/lib/maps/exemplars/types";
import { cn } from "@/lib/utils";
import { fetchJson, fieldClass, InlineError, LabButton, panelClass, postJson, Skeleton } from "./lab-ui";

interface Preview {
  eligible: boolean;
  reason: string | null;
  defaultTitle: string;
  tags: ExemplarTags | null;
  gain: CoverageGain[];
}

function Chips({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 shrink-0 text-xs text-zinc-400">{label}</span>
      {values.length === 0 ? (
        <span className="text-xs text-zinc-400">none</span>
      ) : (
        values.map((v) => (
          <span key={v} className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-px text-xs text-zinc-300">{v}</span>
        ))
      )}
    </div>
  );
}

export function PromotePanel({ cellId, onClose, onPromoted }: { cellId: string; onClose: () => void; onPromoted?: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [labels, setLabels] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setPreview(null);
    try {
      const { data } = await fetchJson<Preview>(`/api/lab/library/promote?cellId=${encodeURIComponent(cellId)}`);
      setPreview(data);
      setTitle(data.defaultTitle);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [cellId]);
  useEffect(() => { void load(); }, [load]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { status, data } = await fetchJson<{ error?: string; item?: { id: string } }>("/api/lab/library/promote", postJson({
        cellId, note: note.trim(), title: title.trim(),
        labels: labels.split(",").map((s) => s.trim()).filter(Boolean),
      }));
      if (status === 409 || !data.item) throw new Error(data.error ?? "The library refused this map.");
      toast({ title: "Added to the library as pending", description: "Publish it from the Library tab." });
      onPromoted?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const noteOk = note.trim().length > 0 && note.trim().length <= 200;

  return (
    <section data-testid="promote-panel" aria-label="Make this map an example" className={cn(panelClass, "space-y-4 p-4")}>
      <header className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <BookmarkPlus className="size-4 text-zinc-400" aria-hidden />
          Make this an example
        </h3>
        <LabButton tone="ghost" className="h-7 px-2" aria-label="Close" onClick={onClose}>
          <X aria-hidden />
        </LabButton>
      </header>

      {loadError ? (
        <InlineError message={`Could not check this map: ${loadError}`} onRetry={() => void load()} />
      ) : !preview ? (
        <div className="space-y-2" aria-busy="true" aria-label="Checking this map">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      ) : !preview.eligible ? (
        <div className="space-y-3">
          <p role="alert" className="flex items-start gap-2 text-sm text-zinc-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
            <span>This map cannot become an example. {preview.reason}</span>
          </p>
          <LabButton tone="primary" disabled title={preview.reason ?? undefined}>Promote</LabButton>
        </div>
      ) : (
        <div className="space-y-4">
          {preview.tags && (
            <div className="space-y-1.5" aria-label="Derived tags (read-only)">
              <Chips label="Map type" values={[preview.tags.mapType]} />
              <Chips label="Input" values={[preview.tags.inputType]} />
              <Chips label="Kinds" values={preview.tags.kinds} />
              <Chips label="Pairings" values={preview.tags.pairings} />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="block text-sm font-medium text-zinc-200">Title</span>
              <Input className={cn(fieldClass, "h-9")} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="block text-sm font-medium text-zinc-200">Labels</span>
              <Input className={cn(fieldClass, "h-9")} placeholder="Comma separated, optional" value={labels} onChange={(e) => setLabels(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-zinc-200">Why is this a good example? (one line)</span>
            <Input
              data-testid="promote-note"
              className={cn(fieldClass, "h-9")}
              maxLength={200}
              placeholder="e.g. Numbers went into a table instead of cards"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-zinc-400">What it adds to the library</p>
            {preview.gain.length === 0 ? (
              <p className="text-sm text-zinc-400">No new coverage: it adds another example of what the library already shows.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {preview.gain.map((g) => (
                  <li key={g.label} className="flex items-center gap-2 text-zinc-300">
                    {g.closesGap ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" aria-hidden /> : <span className="size-3.5 shrink-0" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate">{g.label}</span>
                    <span className="tabular-nums text-zinc-400">{g.before} to {g.after}{g.closesGap ? ", closes a gap" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && <InlineError message={error} />}
          <div className="flex gap-2">
            <LabButton tone="primary" data-testid="promote-submit" busy={busy} disabled={!noteOk} onClick={() => void submit()}>
              Promote
            </LabButton>
            <LabButton tone="ghost" disabled={busy} onClick={onClose}>Cancel</LabButton>
          </div>
        </div>
      )}
    </section>
  );
}
