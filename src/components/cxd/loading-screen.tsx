'use client';

import { useEffect, useState } from 'react';

export function LoadingScreen() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Centered loading content */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Loading animation */}
        <div className="w-24 h-24 relative">
          <video
            src="/images/loading-animation.mp4"
            width={96}
            height={96}
            autoPlay
            muted
            loop
            playsInline
            className="object-contain"
            style={{ mixBlendMode: 'screen' }}
          />
        </div>

        {/* Loading text */}
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600">
            Loading Canvas{dots}
          </h2>
          <p className="text-sm text-purple-300/70">
            Preparing your experience design workspace
          </p>
        </div>
      </div>
    </div>
  );
}
