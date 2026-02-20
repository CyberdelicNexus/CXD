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
      {/* Animated gradient background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-purple-600/10 to-purple-800/20 animate-pulse" />
        <div
          className="absolute inset-0 bg-gradient-to-tr from-purple-400/20 via-transparent to-purple-600/20"
          style={{
            animation: 'gradient-shift 8s ease-in-out infinite',
          }}
        />
      </div>

      {/* Centered loading content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Animated logo/icon area */}
        <div className="relative w-32 h-32">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 border-r-purple-400 animate-spin" />

          {/* Middle pulsing ring */}
          <div
            className="absolute inset-2 rounded-full border-4 border-transparent border-b-purple-600 border-l-purple-500"
            style={{
              animation: 'spin-reverse 3s linear infinite',
            }}
          />

          {/* Inner glowing circle */}
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 animate-pulse shadow-2xl shadow-purple-500/50" />

          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-white animate-pulse" />
          </div>
        </div>

        {/* Loading text */}
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 animate-pulse">
            Loading Canvas{dots}
          </h2>
          <p className="text-sm text-purple-300/70">
            Preparing your experience design workspace
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-64 h-1 bg-purple-950/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 via-purple-400 to-purple-500 rounded-full"
            style={{
              animation: 'loading-bar 2s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* Add custom keyframes */}
      <style jsx>{`
        @keyframes gradient-shift {
          0%, 100% {
            opacity: 0.2;
            transform: rotate(0deg) scale(1);
          }
          50% {
            opacity: 0.3;
            transform: rotate(180deg) scale(1.1);
          }
        }

        @keyframes spin-reverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }

        @keyframes loading-bar {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(400%);
          }
        }
      `}</style>
    </div>
  );
}
