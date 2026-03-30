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

        {/* 2-column content — thumbnail left, info+buttons right */}
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-8 relative z-10 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 lg:gap-10 items-center">
            {/* Left column — thumbnail */}
            <div className="max-w-[280px] mx-auto lg:max-w-none lg:mx-0">
              {thumbnail ? (
                <div className="w-full aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
                  <img src={thumbnail} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-full aspect-square rounded-2xl border border-white/10 bg-gradient-to-br from-violet-950/50 to-purple-900/30 flex items-center justify-center">
                  <Image src="/images/hypercube-logo.webp" alt="CXD" width={80} height={80} className="opacity-30" />
                </div>
              )}
            </div>

            {/* Right column — info + buttons */}
            <div className="space-y-5 text-center lg:text-left">
              <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight">
                {project.name}
              </h1>

              {/* Author */}
              <div className="flex items-center gap-3 justify-center lg:justify-start">
                {ownerAvatar ? (
                  <img src={ownerAvatar} alt={ownerName} className="w-10 h-10 rounded-full object-cover border-2 border-violet-500/30" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                    {initials}
                  </div>
                )}
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider">Experience by</p>
                  <p className="text-sm font-semibold text-white/90">{ownerName}</p>
                </div>
              </div>

              {/* Description */}
              {(project.shareDescription || project.description) && (
                <p className="text-sm text-white/50 leading-relaxed">{project.shareDescription || project.description}</p>
              )}

              {/* Buttons */}
              <div className="space-y-3 pt-2 w-full lg:w-[85%]">
                <div className="rounded-xl p-px bg-gradient-to-r from-violet-500/30 via-purple-400/40 to-violet-500/30 hover:from-violet-500/40 hover:via-purple-400/50 hover:to-violet-500/40 transition-all duration-300">
                  <button onClick={onViewFraming} className="w-full px-5 py-3.5 rounded-[11px] bg-black/80 backdrop-blur-md text-sm font-semibold text-white/90 hover:text-white hover:bg-black/60 transition-all duration-300 flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    View Experience Design
                  </button>
                </div>
                <div className="rounded-xl p-px bg-gradient-to-r from-emerald-500/25 via-teal-400/35 to-emerald-500/25 hover:from-emerald-500/35 hover:via-teal-400/45 hover:to-emerald-500/35 transition-all duration-300">
                  <button onClick={onViewCanvas} className="w-full px-5 py-3.5 rounded-[11px] bg-black/80 backdrop-blur-md text-sm font-semibold text-white/90 hover:text-white hover:bg-black/60 transition-all duration-300 flex items-center justify-center gap-2">
                    <LayoutGrid className="w-4 h-4" />
                    View Canvas
                  </button>
                </div>
                <div className="rounded-xl p-px bg-gradient-to-r from-purple-500/20 via-violet-400/30 to-purple-500/20 hover:from-purple-500/30 hover:via-violet-400/40 hover:to-purple-500/30 transition-all duration-300">
                  <Link href={`/sign-up?returnTo=/cxd/share/${shareToken}&join=true`} className="w-full px-5 py-3.5 rounded-[11px] bg-black/80 backdrop-blur-md text-sm font-semibold text-white/90 hover:text-white hover:bg-black/60 transition-all duration-300 flex items-center justify-center gap-2">
                    <Users className="w-4 h-4" />
                    Request to Collaborate
                  </Link>
                </div>
                <div className="text-center pt-1">
                  <Link href="/" className="text-xs font-medium text-violet-400/70 hover:text-violet-300 transition-colors">
                    Create your own experience design &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer — CXD Branding */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 py-10 relative z-10">
          <Image
            src="/images/hypercube-logo.webp"
            alt="CXD"
            width={28}
            height={28}
            className="object-contain opacity-40"
            priority
          />
          <span className="text-xs font-medium text-white/25 tracking-wide">
            Cyberdelic Experience Design
          </span>
        </div>
      </div>
    </div>
  );
}
