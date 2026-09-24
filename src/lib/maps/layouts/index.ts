import type { MapType } from "../types";
import type { LayoutEngine } from "./shared";
import { doubleBubbleLayout } from "./double-bubble";
import { radialLayout } from "./radial";
import { spiderLayout } from "./spider";
import { treeLayout } from "./tree";

/** Engine per map type. Every entry must keep layouts.verify.ts at zero errors. */
export const LAYOUTS: Partial<Record<MapType, LayoutEngine>> = {
  radial: radialLayout,
  bubble: radialLayout,
  spider: spiderLayout,
  tree: treeLayout,
  doubleBubble: doubleBubbleLayout,
};
