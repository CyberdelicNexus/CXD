// Next.js instrumentation hook — picks the right Sentry config per runtime.
// See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Re-export Sentry's request-error capture so server-side throws make it to
// the dashboard (not just unhandled exceptions).
export { captureRequestError as onRequestError } from "@sentry/nextjs";
