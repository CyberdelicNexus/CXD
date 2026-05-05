---
plan: 04-01
status: complete
commit: 8bb1cfc
---

# Summary: Connector Visual Overhaul

## What was built

Per-edge z-order, edge-snapping, midpoint circle node, and visual polish for all connected edges.

## Deliverables

- **Per-edge z-index**: Each edge's SVG is now individually positioned at `max(fromEl.zIndex, toEl.zIndex) + 0.5`, placing it above its connected elements while respecting unrelated higher-z cards
- **Edge-snapping**: 2px outset on anchor positions so connector lines touch card boundaries cleanly without overlapping card bodies
- **Midpoint circle node**: Always-visible colored ring node (outer fill = stroke color, dark inner fill) at the bezier midpoint of every connected edge. Draggable to reposition bend. Grows and glows on hover. White outer ring when edge is selected.
- **Hover glow**: `drop-shadow` filter applied to visible path on hover
- **`strokeLinecap="round"` / `strokeLinejoin="round"`** for smoother curves
- **arrowhead refX** adjusted from 9 → 8 for cleaner endpoint attachment
- **`elementsById` memo**: Fast element lookup for per-edge rendering
- **`startBendDrag` helper**: Extracted from selection handle — shared by both old selected-edge handle and new always-visible midpoint node
- **`hoveredEdgeId` / `hoveredMidpointEdgeId`** state for independent hover tracking

## Deviations

None significant. `customTags` propagation removed (not on all element types — `taskMetadata` only exists on task-capable elements, not `ImageElement`). `hypercubeTags` propagation retained.

## Key decisions

- Per-edge SVGs each get their own `<div>` wrapper with computed z-index, preserving the canvas transform (translate + scale) pattern used by the elements container
- Auto-center on drag release: if bend dropped within 12px of geometric midpoint, clears explicit bend so node returns to auto-centering
