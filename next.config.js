/** @type {import('next').NextConfig} */

const path = require('path');

// Use separate build directories for dev vs production so running `next build`
// never overwrites the dev server's webpack chunks (and vice-versa). This was
// the #1 cause of "Cannot find module './XXXX.js'" and 404s on HMR chunks
// after switching between `npm run dev` and `npm run build`.
const distDir = process.env.NODE_ENV === 'production' ? '.next' : '.next-dev';

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
                    { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.stripe.com; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://generativelanguage.googleapis.com https://api.anthropic.com https://integrate.api.nvidia.com; frame-src https://js.stripe.com; object-src 'none'; base-uri 'self';" },
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

module.exports = nextConfig;
