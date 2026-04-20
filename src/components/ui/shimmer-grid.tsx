'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface ShimmerGridProps {
  dotSize?: number;
  dotSpacing?: number;
  baseColor?: string;
  hoverColor?: string;
  hoverSize?: number;
  smoothing?: number;
  className?: string;
}

export function ShimmerGrid({
  dotSize = 1.5,
  dotSpacing = 32,
  baseColor = 'rgba(139, 92, 246, 0.25)',
  hoverColor = 'rgba(167, 139, 250, 0.5)',
  hoverSize = 250,
  smoothing = 50,
  className = '',
}: ShimmerGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const targetPos = useRef({ x: -1000, y: -1000 });
  const currentPos = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number>();
  const isAnimating = useRef(false);

  // Smooth cursor following animation — stops when idle
  const animate = useCallback(() => {
    const ease = (100 - smoothing) / 100 * 0.3 + 0.05;

    const dx = targetPos.current.x - currentPos.current.x;
    const dy = targetPos.current.y - currentPos.current.y;

    currentPos.current.x += dx * ease;
    currentPos.current.y += dy * ease;

    setMousePos({ x: currentPos.current.x, y: currentPos.current.y });

    // Stop animating when close enough to target (< 0.5px)
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      isAnimating.current = false;
    }
  }, [smoothing]);

  const startAnimation = useCallback(() => {
    if (!isAnimating.current) {
      isAnimating.current = true;
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    targetPos.current = {
      x: e.clientX,
      y: e.clientY,
    };
    startAnimation();
  }, [startAnimation]);

  const handleMouseLeave = useCallback(() => {
    targetPos.current = { x: -1000, y: -1000 };
    startAnimation();
  }, [startAnimation]);

  useEffect(() => {
    // Listen on window instead of container for better tracking
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex: 0 }}
    >
      {/* Base dotted grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at center, ${baseColor} ${dotSize}px, transparent ${dotSize}px)`,
          backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
        }}
      />

      {/* Hover glow effect */}
      <div
        className="absolute rounded-full transition-opacity duration-200"
        style={{
          width: hoverSize * 2,
          height: hoverSize * 2,
          left: mousePos.x - hoverSize,
          top: mousePos.y - hoverSize,
          opacity: mousePos.x > -500 ? 1 : 0,
          background: `radial-gradient(circle, ${hoverColor} 0%, rgba(139, 92, 246, 0.3) 0%, transparent 0%)`,
          filter: 'blur(7px)',
        }}
      />

      {/* Illuminated dots overlay */}
      <div
        className="absolute"
        style={{
          width: hoverSize * 2,
          height: hoverSize * 2,
          left: mousePos.x - hoverSize,
          top: mousePos.y - hoverSize,
          opacity: mousePos.x > -500 ? 1 : 0,
          backgroundImage: `radial-gradient(circle at center, ${hoverColor} ${dotSize}px, transparent ${dotSize}px)`,
          backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
          backgroundPosition: `${-(mousePos.x - hoverSize) % dotSpacing}px ${-(mousePos.y - hoverSize) % dotSpacing}px`,
          maskImage: `radial-gradient(circle at center, white 0%, white 20%, transparent 70%)`,
          WebkitMaskImage: `radial-gradient(circle at center, white 0%, white 20%, transparent 70%)`,
        }}
      />
    </div>
  );
}
