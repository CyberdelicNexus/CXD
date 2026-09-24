"use client";
import type { LabMeta } from "./lab-app";
export function CompareView({ meta }: { meta: LabMeta }) {
  return <p className="text-sm text-zinc-400">Compare view arrives in the next task ({meta.arms.length} arms configured).</p>;
}
