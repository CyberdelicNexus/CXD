// Browser-side Sentry initialization. Loaded automatically by @sentry/nextjs.
// Replaces the deprecated sentry.client.config.ts (required for Turbopack).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

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
      }),
    ],

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
