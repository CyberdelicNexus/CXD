'use client';

import { cn } from '@/lib/utils';

interface HypercubeLogoProps {
  className?: string;
  size?: number;
  animated?: boolean;
}

export function HypercubeLogo({ className, size = 40, animated = false }: HypercubeLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(animated && 'animate-spin-slow', className)}
      style={{ animationDuration: animated ? '20s' : undefined }}
    >
      <defs>
        <linearGradient id="hypercube-gradient-outer" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(175 70% 45%)" />
          <stop offset="50%" stopColor="hsl(280 60% 50%)" />
          <stop offset="100%" stopColor="hsl(175 70% 45%)" />
        </linearGradient>
        <linearGradient id="hypercube-gradient-inner" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(280 60% 50%)" />
          <stop offset="50%" stopColor="hsl(320 60% 55%)" />
          <stop offset="100%" stopColor="hsl(280 60% 50%)" />
        </linearGradient>
        <filter id="hypercube-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer cube */}
      <g stroke="url(#hypercube-gradient-outer)" strokeWidth="1.5" fill="none" filter="url(#hypercube-glow)">
        {/* Front face */}
        <path d="M20 25 L80 25 L80 85 L20 85 Z" opacity="0.9" />
        {/* Back face */}
        <path d="M35 10 L95 10 L95 70 L35 70 Z" opacity="0.5" />
        {/* Connecting lines */}
        <line x1="20" y1="25" x2="35" y2="10" opacity="0.7" />
        <line x1="80" y1="25" x2="95" y2="10" opacity="0.7" />
        <line x1="80" y1="85" x2="95" y2="70" opacity="0.7" />
        <line x1="20" y1="85" x2="35" y2="70" opacity="0.7" />
      </g>

      {/* Inner cube (4D projection) */}
      <g stroke="url(#hypercube-gradient-inner)" strokeWidth="1.5" fill="none" filter="url(#hypercube-glow)">
        {/* Front face */}
        <path d="M35 40 L65 40 L65 70 L35 70 Z" opacity="0.9" />
        {/* Back face */}
        <path d="M45 30 L75 30 L75 60 L45 60 Z" opacity="0.5" />
        {/* Connecting lines */}
        <line x1="35" y1="40" x2="45" y2="30" opacity="0.7" />
        <line x1="65" y1="40" x2="75" y2="30" opacity="0.7" />
        <line x1="65" y1="70" x2="75" y2="60" opacity="0.7" />
        <line x1="35" y1="70" x2="45" y2="60" opacity="0.7" />
      </g>

      {/* Connections between cubes (tesseract edges) */}
      <g stroke="hsl(175 70% 45% / 0.4)" strokeWidth="1" strokeDasharray="2 2">
        <line x1="20" y1="25" x2="35" y2="40" />
        <line x1="80" y1="25" x2="65" y2="40" />
        <line x1="80" y1="85" x2="65" y2="70" />
        <line x1="20" y1="85" x2="35" y2="70" />
        <line x1="35" y1="10" x2="45" y2="30" />
        <line x1="95" y1="10" x2="75" y2="30" />
        <line x1="95" y1="70" x2="75" y2="60" />
        <line x1="35" y1="70" x2="45" y2="60" />
      </g>

      {/* Corner vertices with glow */}
      <g fill="hsl(175 70% 55%)" filter="url(#hypercube-glow)">
        <circle cx="20" cy="25" r="2" />
        <circle cx="80" cy="25" r="2" />
        <circle cx="80" cy="85" r="2" />
        <circle cx="20" cy="85" r="2" />
      </g>
      <g fill="hsl(280 60% 60%)">
        <circle cx="35" cy="40" r="2" />
        <circle cx="65" cy="40" r="2" />
        <circle cx="65" cy="70" r="2" />
        <circle cx="35" cy="70" r="2" />
      </g>
    </svg>
  );
}
