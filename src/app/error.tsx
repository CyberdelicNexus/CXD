"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-8 text-center">
        <div className="mb-4 text-4xl text-red-400">!</div>
        <h1 className="mb-2 text-xl font-semibold text-white">
          Something went wrong
        </h1>
        <p className="mb-6 text-sm text-zinc-400">{error.message}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Try Again
          </button>
          <a
            href="/"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
