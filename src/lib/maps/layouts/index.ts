import type { MapType } from "../types";
import type { LayoutEngine } from "./shared";
import { radialLayout } from "./radial";

/** Engine per map type. Every entry must keep layouts.verify.ts at zero errors. */
export const LAYOUTS: Partial<Record<MapType, LayoutEngine>> = {
  radial: radialLayout,
  bubble: radialLayout,
};
