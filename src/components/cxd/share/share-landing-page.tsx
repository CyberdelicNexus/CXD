'use client';

import { CXDProject } from '@/types/cxd-schema';
import { ShimmerGrid } from '@/components/ui/shimmer-grid';
import Image from 'next/image';
import Link from 'next/link';

interface ShareLandingPageProps {
  project: CXDProject;
  onViewFraming: () => void;
  onViewCanvas: () => void;
  shareToken: string;
}

export function ShareLandingPage({
  project,
  onViewFraming,
  onViewCanvas,
  shareToken,
}: ShareLandingPageProps) {
  const coverImage = project.shareCoverImage;
  const thumbnail = project.shareThumbnail;
  const concept = project.intentionCore?.mainConcept;

  return (
    <div className="min-h-screen bg-black">
      {/* ShimmerGrid background */}
      <ShimmerGrid
        dotSize={1.5}
        dotSpacing={24}
        baseColor="rgba(110, 56, 236, 0.1)"
        hoverColor="rgba(138, 99, 255, 0.5)"
        hoverSize={400}
        className="!fixed inset-0 !z-0"
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center min-h-screen">
        {/* Cover image hero */}
        <div className="w-full relative">
          {coverImage ? (
            <div className="relative w-full h-[340px] md:h-[420px] overflow-hidden">
              <img
                src={coverImage}
                alt="Cover"
                className="w-full h-full object-cover"
              />
              {/* Gradient fade from cover into content */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
            </div>
          ) : (
            <div
              className="w-full h-[220px] md:h-[280px]"
              style={{
                background:
                  'linear-gradient(135deg, #1a0a2e, #2a1040, #0f1a3a)',
              }}
            >
              {/* Gradient fade into content */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
            </div>
          )}
        </div>

        {/* Content card */}
        <div className="w-full max-w-2xl mx-auto px-6 -mt-16 relative z-10 flex flex-col items-center gap-8 pb-16">
          {/* CXD Branding */}
          <div className="flex items-center gap-3">
            <Image
              src="/images/hypercube-logo.webp"
              alt="CXD"
              width={36}
              height={36}
              className="object-contain"
              priority
            />
            <span className="text-sm font-medium text-white/50 tracking-wide">
              Cyberdelic Experience Design
            </span>
          </div>

          {/* Project info */}
          <div className="text-center flex flex-col items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              {project.name}
            </h1>
            {concept && (
              <p className="text-base md:text-lg text-white/60 max-w-lg leading-relaxed">
                {concept}
              </p>
            )}
          </div>

          {/* Thumbnail */}
          {thumbnail && (
            <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
              <img
                src={thumbnail}
                alt="Project thumbnail"
                className="max-w-full max-h-[320px] object-contain"
              />
            </div>
          )}

          {/* View buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
            <button
              onClick={onViewFraming}
              className="w-full sm:w-auto flex-1 px-8 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-700 shadow-[0_0_24px_rgba(139,92,246,0.35)] hover:shadow-[0_0_32px_rgba(139,92,246,0.5)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              View Experience Design
            </button>
            <button
              onClick={onViewCanvas}
              className="w-full sm:w-auto flex-1 px-8 py-3 rounded-xl text-sm font-semibold text-white bg-white/[0.05] border border-white/15 backdrop-blur-md hover:bg-white/[0.08] hover:border-white/25 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              View Canvas
            </button>
          </div>

          {/* Divider */}
          <div className="w-full max-w-sm h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          {/* CTA section */}
          <div className="flex flex-col items-center gap-4">
            {/* Request to Collaborate */}
            <div className="rounded-xl p-px bg-gradient-to-r from-purple-500/20 via-pink-500/30 to-purple-500/20">
              <Link
                href={`/sign-up?returnTo=/cxd/share/${shareToken}&join=true`}
                className="block px-8 py-3 rounded-[11px] bg-black/80 backdrop-blur-md text-sm font-medium text-white/80 hover:text-white hover:bg-black/60 transition-all duration-300"
              >
                Request to Collaborate
              </Link>
            </div>

            {/* Create your own */}
            <Link
              href="/"
              className="text-sm font-medium bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent hover:from-purple-300 hover:to-pink-300 transition-all duration-300"
            >
              Create your own experience design &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
