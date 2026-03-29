'use client';

import { CXDProject } from '@/types/cxd-schema';
import { ShimmerGrid } from '@/components/ui/shimmer-grid';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, LayoutGrid, Users } from 'lucide-react';

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
  const description = project.shareDescription;
  const authorName = project.intentionCore?.projectName
    ? 'CXD Creator'
    : 'CXD Creator';

  // Generate initials from project name as fallback
  const initials = (project.name || 'CX')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
        {/* Cover image hero — reduced height */}
        <div className="w-full relative">
          {coverImage ? (
            <div className="relative w-full h-[200px] md:h-[260px] overflow-hidden">
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
              className="w-full h-[160px] md:h-[200px] relative"
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

        {/* Content */}
        <div className="w-full max-w-2xl mx-auto px-6 -mt-16 relative z-10 flex flex-col items-center gap-6 pb-16">
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

          {/* Project name */}
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight text-center">
            {project.name}
          </h1>

          {/* Author profile */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/40 to-purple-600/40 border border-violet-500/20 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white/70">{initials}</span>
            </div>
            <span className="text-sm text-white/50">
              Experience by <span className="text-white/70 font-medium">{authorName}</span>
            </span>
          </div>

          {/* Concept */}
          {concept && (
            <p className="text-base md:text-lg text-white/60 max-w-lg leading-relaxed text-center">
              {concept}
            </p>
          )}

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

          {/* Description */}
          {description && (
            <p className="text-sm text-white/50 max-w-md leading-relaxed text-center">
              {description}
            </p>
          )}

          {/* Buttons — all same gradient-border style, stacked vertically */}
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            {/* View Experience Design — purple gradient */}
            <div className="w-full rounded-xl p-px bg-gradient-to-r from-violet-500/30 via-purple-400/40 to-violet-500/30">
              <button
                onClick={onViewFraming}
                className="w-full px-6 py-3.5 rounded-[11px] bg-black/80 backdrop-blur-md text-sm font-semibold text-white/90 hover:text-white hover:bg-black/60 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                View Experience Design
              </button>
            </div>

            {/* View Canvas — cyan/teal gradient */}
            <div className="w-full rounded-xl p-px bg-gradient-to-r from-cyan-500/30 via-teal-400/40 to-cyan-500/30">
              <button
                onClick={onViewCanvas}
                className="w-full px-6 py-3.5 rounded-[11px] bg-black/80 backdrop-blur-md text-sm font-semibold text-white/90 hover:text-white hover:bg-black/60 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <LayoutGrid className="w-4 h-4" />
                View Canvas
              </button>
            </div>

            {/* Request to Collaborate — pink/purple gradient */}
            <div className="w-full rounded-xl p-px bg-gradient-to-r from-purple-500/20 via-pink-500/30 to-purple-500/20">
              <Link
                href={`/sign-up?returnTo=/cxd/share/${shareToken}&join=true`}
                className="w-full px-6 py-3.5 rounded-[11px] bg-black/80 backdrop-blur-md text-sm font-semibold text-white/90 hover:text-white hover:bg-black/60 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                Request to Collaborate
              </Link>
            </div>
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
  );
}
