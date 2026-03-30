'use client';

import { useState, useEffect } from 'react';
import { CXDProject } from '@/types/cxd-schema';
import { ShimmerGrid } from '@/components/ui/shimmer-grid';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, LayoutGrid, Users } from 'lucide-react';
import { createClient } from '@/supabase/client';

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

  const [ownerName, setOwnerName] = useState('CXD Creator');
  const [ownerAvatar, setOwnerAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!project.ownerId) return;
    const supabase = createClient();
    supabase.from('users').select('full_name, name, profile_picture').eq('id', project.ownerId).single()
      .then(({ data }) => {
        if (data) {
          setOwnerName(data.full_name || data.name || 'CXD Creator');
          setOwnerAvatar(data.profile_picture || null);
        }
      });
  }, [project.ownerId]);

  // Generate initials from owner name or project name as fallback
  const initials = (ownerName !== 'CXD Creator' ? ownerName : project.name || 'CX')
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
        {/* Cover image hero — full width */}
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

        {/* 2-column content */}
        <div className="w-full max-w-5xl mx-auto px-6 -mt-16 relative z-10 pb-16">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            {/* Left column */}
            <div className="flex-1 space-y-6 min-w-0">
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                {project.name}
              </h1>

              {/* Author */}
              <div className="flex items-center gap-3">
                {ownerAvatar ? (
                  <img
                    src={ownerAvatar}
                    alt={ownerName}
                    className="w-10 h-10 rounded-full object-cover border border-violet-500/20"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                    {initials}
                  </div>
                )}
                <div>
                  <p className="text-sm text-white/70">Experience by</p>
                  <p className="text-sm font-medium text-white">{ownerName}</p>
                </div>
              </div>

              {/* Description */}
              {(project.shareDescription || project.description) && (
                <p className="text-sm text-white/60 leading-relaxed">
                  {project.shareDescription || project.description}
                </p>
              )}

              {/* Thumbnail */}
              {thumbnail && (
                <div className="w-full max-w-[320px] aspect-square rounded-xl overflow-hidden border border-white/10">
                  <img src={thumbnail} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="lg:w-[320px] flex-shrink-0 space-y-4">
              {/* Buttons */}
              <div className="flex flex-col gap-3 w-full">
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
              <div className="text-center">
                <Link
                  href="/"
                  className="text-sm font-medium bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent hover:from-purple-300 hover:to-pink-300 transition-all duration-300"
                >
                  Create your own experience design &rarr;
                </Link>
              </div>

              {/* CXD Branding */}
              <div className="flex items-center gap-3 pt-6 justify-center">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
