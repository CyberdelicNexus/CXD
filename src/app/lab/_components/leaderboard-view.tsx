"use client";
import type { LabMeta } from "./lab-app";
export function LeaderboardView({ meta }: { meta: LabMeta }) {
  return <p className="text-sm text-zinc-400">Leaderboard arrives soon ({meta.models.length} models configured).</p>;
}
