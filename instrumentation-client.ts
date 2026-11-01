// Browser-side Sentry initialization. Loaded automatically by @sentry/nextjs.
// Replaces the deprecated sentry.client.config.ts (required for Turbopack).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// The admin password-reset link carries a one-time token_hash. It travels in the
// URL fragment, but redact it anywhere it could still appear: request URLs,
// breadcrumbs, transaction names and span data.
const TOKEN_HASH = /token_hash([=:]\s*"?)[^&#"\s]+/g;

function scrub<T>(value: T, depth = 0): T {
  if (depth > 8) return value;
  if (typeof value === "string") return value.replace(TOKEN_HASH, "token_hash$1[redacted]") as unknown as T;
  if (Array.isArray(value)) return value.map((item) => scrub(item, depth + 1)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      // SDK internals: copy through so the walk does not enter them.
      out[key] = depth === 0 && key === "sdkProcessingMetadata" ? item : scrub(item, depth + 1);
    }
    return out as T;
  }
  return value;
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

    // Performance: keep low until we know production volume.
    tracesSampleRate: 0.1,

    // Error-only session replay: buffers locally, uploads only when an error
    // fires. Text is masked and media blocked (privacy). Lower the rate if
    // replay quota becomes a constraint.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        // Replay payloads can carry URLs too: scrub them the same way.
        beforeAddRecordingEvent: (event) => scrub(event),
      }),
    ],

    beforeSend: (event) => scrub(event),
    beforeSendTransaction: (event) => scrub(event),

    // Dev console noise off.
    debug: false,

    // Drop known noise that doesn't actionably matter.
    // AbortError: fires on every fetch cancelled by AbortController cleanup
    // (component unmount, navigation, StrictMode double-render). 174 events,
    // 0 actionable. Filtered here while we audit upstream usages.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications.",
      "Non-Error promise rejection captured",
      "AbortError",
    ],
  });
}

// App Router client-side navigation tracing — required when using
// instrumentation-client.ts so route transitions appear as transactions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
