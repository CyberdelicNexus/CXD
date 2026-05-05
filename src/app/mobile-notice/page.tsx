'use client';

import Image from 'next/image';
import { Monitor, Smartphone, ArrowLeft } from 'lucide-react';

export default function MobileNoticePage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-black via-purple-950/20 to-black" />
      <div className="fixed inset-0 hero-gradient pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <div className="mb-8">
          <Image
            src="/images/CXD Logo 2.png"
            alt="CXD"
            width={80}
            height={80}
            className="opacity-90"
          />
        </div>

        {/* Icon comparison */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-red-400" />
          </div>
          <ArrowLeft className="w-6 h-6 text-white/30" />
          <div className="w-16 h-16 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Monitor className="w-8 h-8 text-violet-400" />
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-4">
          Desktop Experience Required
        </h1>

        <p className="text-white/60 text-center max-w-md mb-8 leading-relaxed">
          The CXD Canvas is designed for larger screens to provide the best experience design workflow.
          Please access this page from a laptop or desktop computer.
        </p>

        {/* Feature highlights */}
        <div className="glass-card p-6 rounded-xl max-w-sm w-full mb-8">
          <h3 className="text-sm font-medium text-white/80 mb-4">Why desktop?</h3>
          <ul className="space-y-3">
            {[
              'Infinite canvas with precise zoom & pan',
              'Multi-element selection and arrangement',
              'Complex experience flow timelines',
              'Real-time collaboration features',
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/50">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <a
            href="/dashboard"
            className="btn-primary-glow text-center py-3 rounded-full"
          >
            Go to Dashboard
          </a>
          <a
            href="/"
            className="btn-secondary text-center py-3 rounded-full"
          >
            Back to Home
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 py-6 text-center">
        <p className="text-white/30 text-xs">
          CXD Canvas — Design Meaningful Experiences
        </p>
      </div>

      <style jsx global>{`
        .hero-gradient {
          background: radial-gradient(
            ellipse 80% 50% at 50% 120%,
            rgba(139, 92, 246, 0.25) 0%,
            rgba(76, 29, 149, 0.15) 40%,
            transparent 70%
          );
        }
        .glass-card {
          background: linear-gradient(
            225deg,
            rgba(0, 0, 0, 0.3) 0%,
            rgba(0, 0, 0, 0.5) 100%
          );
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .btn-primary-glow {
          background: linear-gradient(135deg, rgb(167, 139, 250) 0%, rgb(99, 52, 199) 100%);
          color: white;
          font-weight: 500;
          box-shadow: 0 0 30px rgba(139, 92, 246, 0.4);
        }
        .btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: white;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
