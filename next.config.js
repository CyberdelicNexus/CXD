/** @type {import('next').NextConfig} */

const path = require('path');

const nextConfig = {
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
