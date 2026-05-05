# Container Element Polish Design
_Date: 2026-03-26_

## Overview

A behavioural and visual overhaul of the canvas container element. Containers become first-class glassmorphism elements with a tinted header bar, reliable containment/detachment logic, auto-expand on drop, collapse to header, and a freeze lock — consistent with the dark canvas aesthetic.

---

## 1. Containment Model

### Attachment — drag-intent only

Containment is only assigned when the user explicitly drags an element and releases it over a container. Spatial overlap alone never triggers containment. On `mouseup`, the drop handler checks whether the dragged element's center point is inside any container's bounds; if so, `containerId` is set on the element.

This is the current intent. The fix is switching from a raw cursor-position check to an **element-center check** so the element itself must be meaningfully inside the container, not just the cursor.

### Detachment — spatial tracking during drag

When a child element (one with `containerId` set) is dragged, the system checks on every `mousemove` whether it should auto-detach. Detachment fires when the element's **center point** moves more than **30px past any of the 4 container edges**:

```
centerX < container.x - 30                        // left
centerX > container.x + container.width + 30      // right
centerY < container.y - 30                        // top
centerY > container.y + container.height + 30     // bottom
```

This fixes the current bug where only `newX < container.x - 50 || newY < container.y - 50` was checked (top-left only), causing elements dragged out from the right or bottom to never detach.

---

## 2. Container Anatomy

### Visual shell

Glassmorphism style matching the canvas aesthetic:
- **Fill:** rgba of tint color at 8% opacity
- **Border:** tint color at 35% opacity, 1px
- **Inner glow:** `box-shadow: inset 0 0 30px rgba(tint, 0.06)`
- **Border radius:** 14px

### Tint color

Six named tints matching the connector gradient palette: `violet`, `ocean`, `emerald`, `sunset`, `rose`, `glacier`. Stored as `tintColor?: GradientName` on the container. Defaults to `violet`. Changing the tint updates border, fill, and header accent simultaneously.

Color values (mid/light) match `SWATCH_COLORS` in `connector-radial-menu.tsx`:

| Name | Mid | Light |
|------|-----|-------|
| violet | `#7C3AED` | `#C4B5FD` |
| ocean | `#2563EB` | `#67E8F9` |
| emerald | `#059669` | `#6EE7B7` |
| sunset | `#EA580C` | `#FDE68A` |
| rose | `#DB2777` | `#FBCFE8` |
| glacier | `#475569` | `#E2E8F0` |

### Header bar

Always visible, even when collapsed. Height ~28px. Background: tint mid-color at 12% opacity, bottom border at 20% opacity.

Left to right:
1. **Color dot** (12px circle, radial gradient) — click to open 6-swatch picker
2. **Editable label** — click to rename, placeholder "Group"
3. **Item count badge** — e.g. "3 items", auto-updated, muted style
4. **Collapse button** ▾/▸ — toggles collapsed state
5. **Lock button** 🔒/🔓 — toggles locked state

### Resize handles

Corner handles only (4 corners) — already implemented. No change needed.

### Floating connection port

`FloatingPort` receives `isContainer={element.type === 'container'}`. Container dead zones: corners only (offset < 14% or offset > 86% on any side). No midpoint dead zone — containers have no + buttons at edge centers.

When the container is **collapsed**, the FloatingPort is hidden entirely — the element is only a header bar and connecting to it while collapsed would be confusing. Port reappears on uncollapse. When **locked**, the port still shows — you can connect to a locked container, just not move it.

---

## 3. Behaviours

### Auto-expand on drop

When an element is dropped into a container (containerId assigned):
1. Compute the bounding box of **all children** (including the newly added one):
   - `minX = min(child.x)`, `minY = min(child.y)`
   - `maxX = max(child.x + child.width)`, `maxY = max(child.y + child.height)`
2. New container bounds = bounding box expanded by **20px padding** on all sides
3. If the computed bounds are larger than the current container bounds, update `x, y, width, height`
4. Container **never auto-shrinks** — only expands on drop
5. During drag, container stays at its current size — no real-time resizing

### Collapse

Toggled by the ▾/▸ button.

**Collapsing:**
- Set `collapsed: true` on the container
- All children become invisible (`visibility: hidden` or `display: none`)
- Container's rendered height shrinks to the header bar height (~28px)
- The stored `height` value is **preserved** — it is not overwritten

**Uncollapsing:**
- Set `collapsed: false`
- Children become visible again
- Container renders at its stored `height`
- All child positions are exactly as they were — no layout shift

**Dragging a collapsed container** moves all children with it (same as normal — children always move with container).

### Lock

Toggled by the 🔒/🔓 button.

**Locking:**
- Set `locked: true` on the container element
- Set `locked: true` on **all current children** (elements with `containerId === container.id`)
- Visual: lock icon fills/glows in tint color, container gets a subtle locked indicator (e.g. a lock icon watermark at low opacity over the body)

**Unlocking:**
- Set `locked: false` on the container
- Set `locked: false` on all children
- Visual returns to normal

The existing `locked` field on `CanvasElementBase` is reused — no type changes needed for this field.

**Note:** Newly dropped elements entering a locked container are **not** automatically locked. Lock is a snapshot operation — it locks what's currently inside at the moment you click it.

---

## 4. Data Model Changes

### `ContainerElement` (`src/types/canvas-elements.ts`)

Add one field:

```ts
export interface ContainerElement extends CanvasElementBase {
  type: 'container';
  label?: string;
  collapsed?: boolean;   // already exists
  tintColor?: 'violet' | 'ocean' | 'emerald' | 'sunset' | 'rose' | 'glacier';  // NEW
}
```

No other type changes required. `locked` is on `CanvasElementBase`. `collapsed` already exists.

---

## 5. Architecture

### Files modified

| File | Changes |
|------|---------|
| `src/types/canvas-elements.ts` | Add `tintColor` to `ContainerElement` |
| `src/components/cxd/canvas/canvas-element.tsx` | Rework `ContainerCard`: glassmorphism shell, header bar with 5 controls, collapse + lock toggle handlers |
| `src/components/cxd/cxd-canvas.tsx` | Fix detachment (4-edge center-point check, 30px threshold); auto-expand on drop (bounding box + 20px pad); lock propagation (set locked on container + all children) |
| `src/components/cxd/canvas/floating-port.tsx` | Pass `isContainer` + `isCollapsed` props → corner dead zones; hide entirely when collapsed |

### Files not changed

- `cxd-store.ts` — existing `addNodeToContainer`, `removeNodeFromContainer`, `moveContainerWithChildren` are unchanged. Lock uses the existing `updateElement` action with `{ locked: true/false }`.
- Collaboration broadcast — already wired for `containerId` and `locked` field changes via `syncUpdateElement`.

---

## 6. Success Criteria

1. Dropping an element onto a container attaches it; the container expands to wrap all children with 20px padding
2. Dragging a child out past any edge (30px threshold) auto-detaches it — works from all 4 directions
3. The container renders with glassmorphism fill, tinted header bar, and the 5 header controls
4. Clicking the color dot opens a 6-swatch picker; changing tint updates border, fill, and header immediately
5. Collapse hides all children and shrinks container to header; uncollapse restores exactly
6. Lock freezes container + all current children; unlock restores movement
7. FloatingPort appears only in the 14–86% offset band on each side (corner dead zones active)
8. `tintColor` persists through save/reload
