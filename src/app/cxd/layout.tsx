import { Poppins } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';

// Poppins powers the Hypercube's on-face perspective labels (Edge Resonance).
// Exposed as the --font-poppins CSS variable, scoped to /cxd/* so non-canvas
// routes don't pay the font cost. display=swap keeps rendering unblocked.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-poppins',
  display: 'swap',
});

export default function CXDLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Canvas text elements can use any of these display fonts (see
          FONT_FAMILIES in src/types/canvas-elements.ts). Loaded only under
          /cxd/* so non-canvas routes don't pay the font-swap CLS cost.
          display=swap keeps rendering unblocked while fonts stream in. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Syne:wght@400;500;600;700;800&family=Unbounded:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Raleway:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <div className={`${poppins.variable} min-h-screen bg-background`}>
        {children}
        <Toaster />
      </div>
    </>
  );
}
