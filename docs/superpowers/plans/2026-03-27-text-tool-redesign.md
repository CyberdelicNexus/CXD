# Text Tool Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix text element interactions — add standard resize handles, redesign font-size handle, remove connector ports, improve defaults, and add new font options.

**Architecture:** Modify the canvas element renderer to give text elements the same resize handles as other elements, reposition the font-size handle to bottom-center with a better icon, exclude text elements from the floating port system, set better creation defaults, and expand the font family list.

**Tech Stack:** TypeScript, React, TailwindCSS, Lucide Icons, Google Fonts

---

### Task 1: Remove Connector Ports from Text Elements

**Files:**
- Modify: `src/components/cxd/canvas/canvas-element.tsx` (where FloatingPort is rendered for text)
- Modify: `src/components/cxd/canvas/floating-port.tsx` (add isText prop)

- [ ] **Step 1: Find where FloatingPort is rendered for elements**

Search in `src/components/cxd/canvas/canvas-element.tsx` for `FloatingPort` usage. Find the conditional that renders it and add a guard to skip text elements.

- [ ] **Step 2: Exclude text elements from FloatingPort rendering**

In the section where `FloatingPort` is rendered (in `CanvasElementRenderer`), add a condition to skip text elements:

```typescript
// Before (renders for all elements):
{!isReadOnly && !element.locked && (
  <FloatingPort
    elementId={element.id}
    elementRef={elementRef}
    isDragging={isDragging}
    isConnecting={isConnecting}
    canvasZoom={canvasZoom}
    isShape={element.type === 'shape'}
    isContainer={element.type === 'container'}
    isCollapsed={element.type === 'container' && (element as any).collapsed}
    onStartConnector={onStartConnector}
    onEndConnector={onEndConnector}
  />
)}

// After (skip text elements):
{!isReadOnly && !element.locked && element.type !== 'text' && (
  <FloatingPort
    elementId={element.id}
    elementRef={elementRef}
    isDragging={isDragging}
    isConnecting={isConnecting}
    canvasZoom={canvasZoom}
    isShape={element.type === 'shape'}
    isContainer={element.type === 'container'}
    isCollapsed={element.type === 'container' && (element as any).collapsed}
    onStartConnector={onStartConnector}
    onEndConnector={onEndConnector}
  />
)}
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/cxd/canvas/canvas-element.tsx
git commit -m "feat: remove connector ports from text elements"
```

---

### Task 2: Add Standard Resize Handles to Text Elements

**Files:**
- Modify: `src/components/cxd/canvas/canvas-element.tsx`

- [ ] **Step 1: Find the resize handle rendering condition**

Search for the `ResizeHandles` component (or individual resize handle divs) in `canvas-element.tsx`. Find the condition that determines which element types get resize handles. Text elements currently only get `TextFontSizeHandle` and `TextWrapWidthHandle` — they need the standard corner/edge handles too.

- [ ] **Step 2: Include text elements in standard resize handle rendering**

Find the conditional that renders standard resize handles (likely checking `element.type !== 'text'` or only rendering for specific types). Add `element.type === 'text'` to the condition:

```typescript
// Look for a condition like:
{isSelected && !isEditing && element.type !== 'line' && !isReadOnly && (
  <>
    <ResizeHandles
      element={element}
      onUpdate={onUpdate}
      canvasZoom={canvasZoom}
      snapToGrid={snapToGrid}
      onResizeStart={pushCanvasHistory}
    />
  </>
)}
```

If text was previously excluded from this block, include it. The key is that text elements should render the same corner/edge handles as freeform cards, images, etc.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Test manually**

Run: `npm run dev`
Create a text element, select it. Verify corner and edge resize handles appear. Drag a corner — the text element's width and height should change and text should reflow within the new bounds.

- [ ] **Step 5: Commit**

```bash
git add src/components/cxd/canvas/canvas-element.tsx
git commit -m "feat: add standard resize handles to text elements"
```

---

### Task 3: Remove TextWrapWidthHandle

**Files:**
- Modify: `src/components/cxd/canvas/canvas-element.tsx`

- [ ] **Step 1: Remove TextWrapWidthHandle rendering**

Find where `TextWrapWidthHandle` is rendered (around line 1707-1711) and remove it:

```typescript
// DELETE this block:
          <TextWrapWidthHandle
            element={element as TextElement}
            onUpdate={onUpdate}
            canvasZoom={canvasZoom}
            onResizeStart={pushCanvasHistory}
          />
```

- [ ] **Step 2: Remove TextWrapWidthHandle component definition**

Find the `TextWrapWidthHandle` component definition (around lines 2052-2128) and delete the entire component function.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/cxd/canvas/canvas-element.tsx
git commit -m "feat: remove TextWrapWidthHandle, replaced by standard resize handles"
```

---

### Task 4: Redesign Font-Size Handle

**Files:**
- Modify: `src/components/cxd/canvas/canvas-element.tsx`

- [ ] **Step 1: Change the icon from Type to ALargeSmall**

In the `TextFontSizeHandle` component (around line 1969), find the icon import and rendering. Replace the `Type` icon with `ALargeSmall` from lucide-react:

```typescript
// At the top of the file, add to lucide-react imports:
import { ALargeSmall } from "lucide-react";

// In TextFontSizeHandle render, replace:
<Type className="w-3 h-3" />
// With:
<ALargeSmall className="w-3.5 h-3.5" />
```

- [ ] **Step 2: Reposition handle to bottom-center**

The handle currently renders at bottom-right. Change positioning to bottom-center:

```typescript
// Find the handle's positioning style (look for absolute positioning in TextFontSizeHandle)
// Change from bottom-right to bottom-center:
style={{
  position: 'absolute',
  left: '50%',
  bottom: `-${handleOffset}px`,
  transform: 'translateX(-50%)',
  // ... rest of styles
}}
```

- [ ] **Step 3: Update drag behavior for vertical-only**

The current handle uses diagonal drag (deltaX + deltaY). Simplify to vertical-only since the handle is now at bottom-center — drag down = bigger, drag up = smaller:

```typescript
// In the drag handler, change from:
const delta = (deltaX + deltaY) / 2;
// To:
const delta = deltaY;
```

Keep the same scale factor (10px per font size unit) and clamping (8-180px).

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 5: Test manually**

Run: `npm run dev`
Create a text element, select it. Verify the font-size handle shows at bottom-center with the ALargeSmall icon. Drag down — font size increases. Drag up — font size decreases.

- [ ] **Step 6: Commit**

```bash
git add src/components/cxd/canvas/canvas-element.tsx
git commit -m "feat: redesign font-size handle with ALargeSmall icon at bottom-center"
```

---

### Task 5: Improve Default Text Size

**Files:**
- Modify: `src/components/cxd/canvas/canvas-element.tsx` or `src/components/cxd/canvas/canvas-toolkit.tsx` or `src/store/cxd-store.ts` (wherever text elements are created)

- [ ] **Step 1: Find where text elements are created**

Search for where new text elements are instantiated with `type: 'text'`. This could be in the toolkit click handler, the context menu, or the store's `addElement` action. Look for the default `fontSize` or `style` values.

- [ ] **Step 2: Set default font size to H1 (~32px)**

Update the default creation to use a larger font size:

```typescript
// When creating a new text element, set:
style: {
  fontSize: 32,  // H1 size (was previously smaller or undefined)
  fontWeight: 'bold',
},
width: 400,  // Wide enough for a heading
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Test manually**

Run: `npm run dev`
Create a new text element from the toolkit. Verify it appears at H1 size (~32px, bold) with a comfortable width.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: set default text element size to H1 (32px bold)"
```

---

### Task 6: Add New Font Options

**Files:**
- Modify: `src/types/canvas-elements.ts`
- Modify: `src/app/layout.tsx` or font loading configuration

- [ ] **Step 1: Add new fonts to FONT_FAMILIES array**

In `src/types/canvas-elements.ts`, expand the `FONT_FAMILIES` array (currently at lines 63-68):

```typescript
export const FONT_FAMILIES = [
  { value: 'inherit', label: 'Default' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'ui-monospace, monospace', label: 'Mono' },
  // Creative/Display
  { value: "'Space Grotesk', sans-serif", label: 'Space Grotesk' },
  { value: "'Syne', sans-serif", label: 'Syne' },
  { value: "'Unbounded', sans-serif", label: 'Unbounded' },
  // Professional/Versatile
  { value: "'Playfair Display', serif", label: 'Playfair' },
  { value: "'Raleway', sans-serif", label: 'Raleway' },
  { value: "'Outfit', sans-serif", label: 'Outfit' },
] as const;
```

- [ ] **Step 2: Add Google Font imports**

Find the font loading setup (likely in `src/app/layout.tsx` using `next/font/google` or a `<link>` tag). Add the new fonts:

```typescript
// If using next/font/google:
import { Space_Grotesk, Syne, Unbounded, Playfair_Display, Raleway, Outfit } from 'next/font/google';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const syne = Syne({ subsets: ['latin'], variable: '--font-syne' });
const unbounded = Unbounded({ subsets: ['latin'], variable: '--font-unbounded' });
const playfairDisplay = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const raleway = Raleway({ subsets: ['latin'], variable: '--font-raleway' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
```

If the project uses `<link>` tags or a different loading method, follow that pattern instead. Check the existing font loading approach before making changes.

- [ ] **Step 3: Update FONT_FAMILIES values to match CSS variables if using next/font**

If using CSS variables from `next/font`, update the `value` fields to match:

```typescript
{ value: 'var(--font-space-grotesk), sans-serif', label: 'Space Grotesk' },
// etc.
```

Or if using direct Google Fonts `<link>` import, the font family names work directly.

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 5: Test manually**

Run: `npm run dev`
Create a text element, open the font dropdown. Verify all 10 fonts appear and render correctly when selected.

- [ ] **Step 6: Commit**

```bash
git add src/types/canvas-elements.ts src/app/layout.tsx
git commit -m "feat: add 6 new font options (Space Grotesk, Syne, Unbounded, Playfair, Raleway, Outfit)"
```
