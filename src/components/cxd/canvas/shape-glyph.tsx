"use client";

import { shapePath, SHAPE_DEFAULT_SIZES } from "@/lib/shape-geometry";
import type { ShapeType } from "@/types/canvas-elements";

/** Small outline icon of a shape, drawn from the same geometry as the canvas. */
export function ShapeGlyph({ type, className }: { type: ShapeType; className?: string }) {
  const size = SHAPE_DEFAULT_SIZES[type] ?? { width: 100, height: 100 };
  // Fit the shape's natural proportions into a 24×24 icon box.
  const scale = 20 / Math.max(size.width, size.height);
  const w = size.width * scale;
  const h = size.height * scale;
  const { d, detail } = shapePath(type, w, h, 1);
  return (
    <svg viewBox={`${-(24 - w) / 2} ${-(24 - h) / 2} 24 24`} className={className} fill="none">
      <path d={d} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" fill="currentColor" fillOpacity={0.15} />
      {detail && <path d={detail} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />}
    </svg>
  );
}
