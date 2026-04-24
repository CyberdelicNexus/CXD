import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "react-day-picker/dist/style.css";
import "./globals.css";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { TempoInit } from "@/components/tempo-init";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://canvas.cyberdelic.design'),
  title: {
    default: 'CXD Canvas — Cyberdelic Experience Design',
    template: '%s | CXD Canvas',
  },
  description: 'Design meaningful experiences with an AI-powered hyperreality canvas. Map sensory journeys, plan immersive events, and collaborate in real-time.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://canvas.cyberdelic.design',
    siteName: 'CXD Canvas',
    title: 'CXD Canvas — Cyberdelic Experience Design',
    description: 'Design meaningful experiences with an AI-powered hyperreality canvas. Map sensory journeys, plan immersive events, and collaborate in real-time.',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CXD Canvas — Experience Design Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CXD Canvas — Cyberdelic Experience Design',
    description: 'Design meaningful experiences with an AI-powered hyperreality canvas.',
    images: ['/images/og-image.png'],
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Canvas display fonts (Space Grotesk, Syne, Unbounded, Playfair,
            Raleway, Outfit) are only needed on canvas routes and are loaded
            in src/app/cxd/layout.tsx — keeping them off landing/dashboard/
            auth pages eliminates the font-swap CLS on those routes. */}
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
        <noscript>
          <div style={{ padding: '2rem', backgroundColor: '#000', color: '#fff', fontFamily: 'system-ui, sans-serif', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>JavaScript Required</h1>
            <p>CXD Canvas requires JavaScript to run. Please enable JavaScript in your browser settings.</p>
          </div>
        </noscript>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <TempoInit />
        <SpeedInsights />
      </body>
    </html>
  );
}
