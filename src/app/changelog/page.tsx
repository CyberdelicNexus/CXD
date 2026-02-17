"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Package, Sparkles } from "lucide-react";
import { CHANGELOG, getCategoryColor, getCategoryLabel } from "@/data/changelog";
import { cn } from "@/lib/utils";

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-purple-950/20">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Changelog</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Track updates, new features, and improvements to CXD Canvas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Changelog Entries */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-12">
          {CHANGELOG.map((entry, index) => (
            <div
              key={entry.version}
              className={cn(
                "relative",
                index !== CHANGELOG.length - 1 && "pb-12 border-l-2 border-purple-500/20 ml-6"
              )}
            >
              {/* Version Badge */}
              <div className="absolute -left-[29px] top-0">
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center border-4 border-background",
                  entry.isLatest
                    ? "bg-gradient-to-br from-purple-600 to-pink-600"
                    : "bg-purple-500/20"
                )}>
                  {entry.isLatest ? (
                    <Sparkles className="w-6 h-6 text-white" />
                  ) : (
                    <Package className="w-5 h-5 text-purple-400" />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="ml-12">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-2xl font-bold text-foreground">
                    v{entry.version}
                  </h2>
                  {entry.isLatest && (
                    <span className="px-2.5 py-1 text-xs font-bold bg-purple-500 text-white rounded-full">
                      LATEST
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    • {entry.date}
                  </span>
                </div>

                <div className="space-y-2">
                  {entry.changes.map((change, changeIndex) => (
                    <div
                      key={changeIndex}
                      className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-border/50 hover:bg-white/10 transition-colors"
                    >
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-bold rounded-md border uppercase flex-shrink-0 mt-0.5",
                        getCategoryColor(change.category)
                      )}>
                        {getCategoryLabel(change.category)}
                      </span>
                      <p className="text-sm text-foreground flex-1">
                        {change.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border/50 text-center">
          <p className="text-sm text-muted-foreground">
            Want to stay updated? Follow our progress on{" "}
            <Link
              href="/dashboard"
              className="text-purple-400 hover:text-purple-300 font-medium"
            >
              the dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
