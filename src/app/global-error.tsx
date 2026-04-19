'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: '#000', color: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {error.message || 'An unexpected error occurred'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{ padding: '0.5rem 1.5rem', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Try Again
            </button>
            <a
              href="/"
              style={{ padding: '0.5rem 1.5rem', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.375rem', color: '#fff', textDecoration: 'none', fontSize: '0.875rem' }}
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
