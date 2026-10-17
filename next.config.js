/** @type {import('next').NextConfig} */

const path = require('path');

// Use separate build directories for dev vs production so running `next build`
// never overwrites the dev server's webpack chunks (and vice-versa). This was
// the #1 cause of "Cannot find module './XXXX.js'" and 404s on HMR chunks
// after switching between `npm run dev` and `npm run build`.
const distDir = process.env.NODE_ENV === 'production' ? '.next' : '.next-dev';

// The Vercel preview toolbar (comments/feedback) only exists on preview deployments.
const isPreview = process.env.VERCEL_ENV === 'preview';
const vercelLive = isPreview ? ' https://vercel.live' : '';
const vercelLiveWs = isPreview ? ' https://vercel.live wss://ws-us3.pusher.com https://sockjs-us3.pusher.com' : '';

const nextConfig = {
    distDir,
    // Keep stale pages in memory longer during dev so rapid saves don't evict
    // chunks the browser is still trying to fetch.
    onDemandEntries: {
        maxInactiveAge: 60 * 1000,
        pagesBufferLength: 5,
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'X-DNS-Prefetch-Control', value: 'on' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    // frame-src: Stripe (checkout) + our own origin + Supabase storage
                    // (file-preview PDFs are served from *.supabase.co) + arbitrary https
                    // origins (the canvas "embed" link mode iframes user-supplied URLs).
                    // media-src: Supabase storage powers file-preview <video>/<audio>.
                    { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com" + vercelLive + "; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; media-src 'self' blob: data: https://*.supabase.co; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://generativelanguage.googleapis.com https://api.anthropic.com https://integrate.api.nvidia.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io" + vercelLiveWs + "; frame-src 'self' https:; object-src 'none'; base-uri 'self';" },
                ],
            },
        ];
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: 'sstllhsrmcvijyokykwp.supabase.co',
            },
        ],
        formats: ['image/webp', 'image/avif'],
    },
    experimental: {
        optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts'],
    },
    webpack: (config, { isServer }) => {
        // Fix Yjs duplicate import issue
        // Ensure all yjs imports resolve to the same instance
        config.resolve.alias = {
            ...config.resolve.alias,
            'yjs': path.resolve(__dirname, 'node_modules/yjs'),
        };

        return config;
    },
};

// Wrap with Sentry only when DSN is set, so dev without Sentry still works.
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      // Silence the "Sentry config is missing" warnings in build logs.
      silent: true,
      // Source maps: only upload if SENTRY_AUTH_TOKEN is present (optional).
      // Without it, you still get error reports — stack traces are just minified.
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Tunnel through /monitoring to bypass ad blockers (optional but cheap).
      tunnelRoute: '/monitoring',
      hideSourceMaps: true,
      // disableLogger replaced by webpack tree-shake config (deprecated in @sentry/nextjs 10).
      webpack: { treeshake: { removeDebugLogging: true } },
    })
  : nextConfig;
