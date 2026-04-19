import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-8 text-center">
        <div className="mb-4 text-4xl text-zinc-500">404</div>
        <h1 className="mb-2 text-xl font-semibold text-white">
          Page Not Found
        </h1>
        <p className="mb-6 text-sm text-zinc-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
