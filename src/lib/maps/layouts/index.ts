import type { MapType } from "../types";
import type { LayoutEngine } from "./shared";
import { braceLayout } from "./brace";
import { conceptMapLayout } from "./concept-map";
import { doubleBubbleLayout } from "./double-bubble";
import { flowLayout } from "./flow";
import { multiFlowLayout } from "./multi-flow";
import { radialLayout } from "./radial";
import { spiderLayout } from "./spider";
import { treeLayout } from "./tree";

/** Engine per map type. Every entry must keep layouts.verify.ts at zero errors. */
export const LAYOUTS: Record<MapType, LayoutEngine> = {
  radial: radialLayout,
  bubble: radialLayout,
  spider: spiderLayout,
  tree: treeLayout,
  doubleBubble: doubleBubbleLayout,
  flow: flowLayout,
  multiFlow: multiFlowLayout,
  brace: braceLayout,
  conceptMap: conceptMapLayout,
};
