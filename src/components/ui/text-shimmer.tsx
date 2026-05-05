'use client';

import { useMemo } from 'react';

interface TextShimmerProps {
  children: string;
  className?: string;
  shimmerColor?: string;
  speed?: number;
  size?: number; // Size of the shimmer effect in percentage
  duration?: number; // Animation duration in seconds (alternative to speed)
}

export function TextShimmer({
  children,
  className = '',
  shimmerColor = 'rgba(132, 75, 239, 0.9)',
  speed = .5,
  size = 90,
  duration,
}: TextShimmerProps) {
  // Use a stable ID based on content if possible, or simple local counter if needed. 
  // For now, to avoid hydration mismatch with Math.random(), we'll rely on inline styles for the variable parts 
  // and a static class for the animation definition, or purely inline styles.
  // Actually, using a scoped animation with inline styles is cleanest.

  const animDuration = duration || (20 / speed);

  // Create a perfectly looping gradient
  // The trick for a perfect loop is:
  // 1. Background size e.g. 200%
  // 2. Animate background-position from 0% to -200% (or similar)
  // For text shimmer, we usually want a pass-through.

  // We'll use a linear gradient that has the shimmer in the middle.
  // Gradient: Base (Purple) -> Shine (White) -> Base (Purple)
  // To make it loop, we can create a repeating pattern or just ensure the interval is long enough.
  // user wants "perfect loop".

  return (
    <span
      className={`relative inline-block bg-clip-text text-transparent bg-gradient-to-r from-[#6d28d9] via-[${shimmerColor}] to-[#6d28d9] pb-3 -mb-3 ${className}`}
      style={{
        backgroundImage: `linear-gradient(110deg, #ffffffff 0%, #6d28d9 40%, ${shimmerColor} 50%, #fefeffff 60%, #faf7ffff 100%)`,
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        animation: `shimmer-text ${animDuration}s linear infinite`,
      }}
    >
      {children}
      <style jsx>{`
        @keyframes shimmer-text {
          0% {
            background-position: 100% 0;
          }
          100% {
            background-position: -100% 0;
          }
        }
      `}</style>
    </span>
  );
}
