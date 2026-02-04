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

  // Smooth cursor following animation
  const animate = useCallback(() => {
    const ease = (100 - smoothing) / 100 * 0.3 + 0.05;

    currentPos.current.x += (targetPos.current.x - currentPos.current.x) * ease;
    currentPos.current.y += (targetPos.current.y - currentPos.current.y) * ease;

    setMousePos({ x: currentPos.current.x, y: currentPos.current.y });

    animationRef.current = requestAnimationFrame(animate);
  }, [smoothing]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    targetPos.current = {
      x: e.clientX,
      y: e.clientY,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    targetPos.current = { x: -1000, y: -1000 };
  }, []);

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
