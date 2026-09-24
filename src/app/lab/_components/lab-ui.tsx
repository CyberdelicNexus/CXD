"use client";

// Shared chrome for the dev-only Structure Lab: zinc surfaces, one violet
// accent, status as icon + text. Kept here so the three views stay consistent.
import { forwardRef, type ReactNode } from "react";
import {
  AlertTriangle, CheckCircle2, CircleDashed, Clock, Loader2, MinusCircle, OctagonX, RotateCcw, XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Fetch ───────────────────────────────────────────────────────────

/** fetch + JSON with the server's `error` message surfaced on non-2xx. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && res.status !== 409) throw new Error(data?.error || `Request failed (${res.status})`);
  return { status: res.status, data };
}

export const postJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// ─── Formatting ──────────────────────────────────────────────────────

export const usd = (v: number, digits = 2) => `$${v.toFixed(digits)}`;
export const pct = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`);

export function shortTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Controls ────────────────────────────────────────────────────────

export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 focus-visible:ring-offset-0";

const TONES = {
  primary: "bg-violet-500 text-zinc-50 hover:bg-violet-400",
  secondary: "border border-white/10 bg-white/[0.06] text-zinc-200 hover:bg-white/10",
  ghost: "text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-100",
} as const;

export interface LabButtonProps extends Omit<ButtonProps, "variant"> {
  tone?: keyof typeof TONES;
  busy?: boolean;
}

/** The app Button, restyled for the lab: rounded-lg, violet focus ring, pressed scale. */
export const LabButton = forwardRef<HTMLButtonElement, LabButtonProps>(
  ({ tone = "secondary", busy = false, className, children, disabled, size = "sm", ...props }, ref) => (
    <Button
      ref={ref}
      size={size}
      disabled={disabled || busy}
      className={cn(
        "rounded-lg transition-[background-color,color,transform] active:scale-[0.98] motion-reduce:active:scale-100",
        focusRing,
        TONES[tone],
        className,
      )}
      {...props}
    >
      {busy && <Loader2 className="motion-safe:animate-spin" aria-hidden />}
      {children}
    </Button>
  ),
);
LabButton.displayName = "LabButton";

export const fieldClass = cn(
  "rounded-lg border-white/10 bg-zinc-900/80 text-zinc-200 placeholder:text-zinc-400",
  focusRing,
);

export const checkboxClass = cn("size-4 shrink-0 cursor-pointer rounded accent-violet-500 disabled:cursor-not-allowed", focusRing);

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="ml-1 rounded border border-white/15 bg-white/[0.06] px-1.5 py-px font-sans text-[11px] font-medium leading-4 text-zinc-300">
      {children}
    </kbd>
  );
}

// ─── Surfaces ────────────────────────────────────────────────────────

export const panelClass = "rounded-xl border border-white/10 bg-zinc-900/60";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cn("rounded-lg bg-white/[0.06] motion-safe:animate-pulse", className)} style={style} />;
}

export function EmptyState({ icon: Icon, title, detail, action, testId }: {
  icon: LucideIcon; title: string; detail?: string; action?: ReactNode; testId?: string;
}) {
  return (
    <div data-testid={testId} className={cn(panelClass, "flex flex-col items-center gap-3 px-6 py-14 text-center")}>
      <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
        <Icon className="size-5 text-zinc-400" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        {detail && <p className="max-w-sm text-sm text-zinc-400">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function InlineError({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-sm", className)}>
      <XCircle className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden />
      <p className="min-w-0 flex-1 break-words text-zinc-300">{message}</p>
      {onRetry && (
        <LabButton tone="ghost" className="-my-1 h-7 px-2 text-xs" onClick={onRetry}>
          <RotateCcw aria-hidden />
          Retry
        </LabButton>
      )}
    </div>
  );
}

// ─── Status ──────────────────────────────────────────────────────────

type AnyStatus = "pending" | "running" | "done" | "failed" | "error" | "skipped" | "stopped";

const STATUS: Record<AnyStatus, { icon: LucideIcon; tone: string; spin?: boolean }> = {
  pending: { icon: Clock, tone: "text-zinc-400" },
  running: { icon: Loader2, tone: "text-zinc-300", spin: true },
  done: { icon: CheckCircle2, tone: "text-emerald-400" },
  failed: { icon: AlertTriangle, tone: "text-amber-400" },
  error: { icon: XCircle, tone: "text-rose-400" },
  skipped: { icon: MinusCircle, tone: "text-zinc-400" },
  stopped: { icon: OctagonX, tone: "text-zinc-400" },
};

/** Icon + the raw status word (the E2E check reads the text), capitalised by CSS only. */
export function StatusLabel({ status, testId, className }: { status: AnyStatus; testId?: string; className?: string }) {
  const s = STATUS[status] ?? { icon: CircleDashed, tone: "text-zinc-400" };
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium", s.tone, className)}>
      <Icon className={cn("size-3.5", s.spin && "motion-safe:animate-spin")} aria-hidden />
      <span data-testid={testId} className="capitalize">{status}</span>
    </span>
  );
}
