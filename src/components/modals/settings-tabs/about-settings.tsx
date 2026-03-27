"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Info, ExternalLink, Heart } from "lucide-react";

export function AboutSettings() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">About CXD Canvas</h3>
        <p className="text-sm text-muted-foreground">
          Version information, changelog, and credits
        </p>
      </div>

      {/* Version */}
      <div className="p-6 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-2xl font-bold text-white">
            CX
          </div>
          <div className="flex-1">
            <h4 className="text-xl font-bold text-foreground">CXD Canvas</h4>
            <p className="text-sm text-muted-foreground mt-0.5">Experience Design Platform</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
                v1.0.0
              </span>
              <span className="text-xs text-muted-foreground">Built with Next.js 14</span>
            </div>
          </div>
        </div>
      </div>

      {/* Changelog */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Recent Updates</h4>

        <div className="space-y-4">
          {/* v1.0.0 */}
          <div className="p-4 bg-white/5 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-foreground">v1.0.0 - February 2026</span>
              <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 rounded">
                Latest
              </span>
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>New weighted credit system with per-model pricing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Comprehensive Settings modal with 5 tabs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>BYOK (Bring Your Own Keys) for Lifetime users</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Updated pricing: Pro $20/mo, Lifetime $399 one-time</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Support for 8 AI models across 4 providers</span>
              </li>
            </ul>
          </div>

          {/* v0.9.0 */}
          <div className="p-4 bg-white/5 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-foreground">v0.9.0 - January 2026</span>
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Plan View with Kanban boards and timelines</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Hypercube Map visualization</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Real-time collaboration with cursor tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Task inbox and notes system</span>
              </li>
            </ul>
          </div>
        </div>

        <button
          onClick={() => router.push('/changelog')}
          className="w-full px-4 py-2 border border-border text-foreground hover:bg-white/5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          View Full Changelog <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Links */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Resources</h4>

        <a
          href="https://docs.cyberdelic.design"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full px-4 py-2 border border-border text-foreground hover:bg-white/5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <Info className="w-4 h-4" />
          Documentation
        </a>
      </div>

      {/* Credits */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Credits</h4>

        <div className="p-4 bg-white/5 border border-border rounded-lg space-y-2 text-sm text-muted-foreground">
          <p>
            Built with <Heart className="w-4 h-4 inline text-red-500" /> by the Cyberdelic team
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span>Frontend Framework:</span>
              <span className="text-foreground">Next.js 14</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>UI Components:</span>
              <span className="text-foreground">Radix UI + Tailwind CSS</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Database:</span>
              <span className="text-foreground">Supabase</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>AI Providers:</span>
              <span className="text-foreground">Anthropic, Google, Moonshot</span>
            </div>
          </div>
        </div>
      </div>

      {/* License */}
      <div className="pt-4 border-t border-border">
        <p className="text-xs text-center text-muted-foreground">
          © 2026 Cyberdelic. All rights reserved.
          <br />
          Licensed under the MIT License.
        </p>
      </div>
    </div>
  );
}
