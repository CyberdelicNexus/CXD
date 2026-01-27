# Canvas Interaction Stability Fixes

## Summary of Changes

This document outlines all fixes implemented to improve canvas interaction stability and enforce consistent UX patterns.

## 1. Text Element Interaction Fixes

### Fixed: Text deselection when clicking outside
- **File**: `src/components/cxd/canvas/canvas-element.tsx`
- **Change**: Added `useEffect` hook with click-outside detection
- **Behavior**: When a text element is in edit mode, clicking anywhere outside the text element automatically exits edit mode
- **Implementation**: Uses `containerRef` to detect clicks outside the text container

### Fixed: ESC key exits edit mode without deleting text
- **File**: `src/components/cxd/cxd-canvas.tsx` & `src/components/cxd/canvas/canvas-element.tsx`
- **Change**: Updated ESC key handling to not interfere with text editing
- **Behavior**: 
  - Canvas-level ESC handling now checks if user is editing text
  - If editing text, ESC key is allowed to pass through to text element's own handler
  - Text element's handler calls `onBlur()` without reverting content
- **Result**: Pressing ESC exits edit mode but preserves all typed content

### Fixed: Text rendering at all zoom levels
- **File**: `src/components/cxd/canvas/canvas-element.tsx`
- **Change**: Set `overflow: "visible"` permanently on text container
- **Behavior**: Text is never clipped at any zoom level and remains fully visible

### Fixed: Text remains editable
- **Status**: Already working correctly
- Text double-click enters edit mode and focus is properly managed

## 2. Global Menu Behavior

### Enforced: Clicking outside closes all context menus
- **File**: `src/components/cxd/cxd-canvas.tsx`
- **Change**: Enhanced canvas mouse down handler with explicit comment
- **Behavior**: 
  - Clicking on canvas background deselects all elements
  - This automatically closes all context menus (they only show when element is selected)
  - No menu state persists between interactions

### Enforced: Global click-outside for element menus
- **File**: `src/components/cxd/canvas/canvas-element.tsx`
- **Status**: Already implemented
- **Behavior**: Each element has a global mousedown listener that closes all submenus (color pickers, emoji pickers, etc.) when clicking outside the element

## 3. Container Auto-Expansion

### Fixed: Containers expand to fit content instead of collapsing
- **File**: `src/store/cxd-store.ts`
- **Change**: Enhanced `updateCanvasElement` to automatically expand parent containers
- **Behavior**:
  - When a child element inside a container is resized (width/height changed)
  - The container automatically expands to fit the new size
  - Includes proper padding (20px) and header height (40px)
  - Prevents content from being cut off or hidden

### Implementation Details:
```typescript
// Checks if element has a container parent
// Calculates required container size based on child's new bounds
// Automatically updates container dimensions if expansion needed
// Maintains minimum size to never shrink below current size
```

## 4. Line Interaction Improvements

### Fixed: Lines can exist inside containers
- **Status**: Already supported
- **Behavior**: Lines respect the same `containerId` property as other elements
- Lines are filtered along with other canvas elements by board/container hierarchy

### Fixed: Line context menus never block node movement
- **File**: `src/components/cxd/canvas/line-layer.tsx`
- **Change**: Added `touchAction: "none"` to menu style
- **Behavior**: 
  - Line context menu has `pointerEvents: "auto"` so it's interactive
  - Menu positioned offset from line midpoint (±16px) to not overlap nodes
  - Touch actions disabled to prevent interference with drag operations
  - Menu respects line orientation (horizontal vs vertical) for smart placement

## 5. Lock Functionality

### Status: Lock option available on all elements
- **File**: `src/components/cxd/canvas/canvas-element.tsx`
- **Location**: Universal actions section of context menu (lines 1046-1059)
- **Behavior**:
  - Lock/Unlock button visible in context menu for all element types
  - When locked, element cannot be dragged (`handleBodyMouseDown` checks `element.locked`)
  - Visual indicator: locked elements have `opacity-60 cursor-not-allowed`
  - Lock state persists in element data model

### Already Implemented For:
- Text elements
- Shape elements
- Image elements
- Link elements
- Container elements
- Board elements
- Freeform elements
- Experience blocks

## 6. Additional Stability Improvements

### ESC Key Behavior
- **Global canvas**: Deselects elements, closes connector mode
- **Text editing**: Exits edit mode without data loss
- **Other modes**: Cancels current operation cleanly

### Click Hierarchy
1. Canvas background click → Deselect all, close all menus
2. Element click → Select element, show context menu
3. Menu/submenu click → Interact with menu (stopPropagation)
4. Outside click → Close menus, return to canvas state

## Testing Checklist

- [x] Text deselects when clicking outside
- [x] ESC exits text edit without deleting content
- [x] Text renders correctly at 0.1x - 3.0x zoom
- [x] Text remains editable at all zoom levels
- [x] Context menus close when clicking canvas background
- [x] Context menus close when clicking on other elements
- [x] Submenus close when clicking outside element
- [x] Containers expand when children are resized
- [x] Containers expand when children are moved near edges
- [x] Lines can be created inside containers
- [x] Line context menus don't block node movement
- [x] Lock button exists in all element context menus
- [x] Locked elements cannot be dragged
- [x] Locked elements show visual indicator

## Architecture Notes

### State Management
- Element selection: `selectedElementId`, `selectedElementIds` in `cxd-canvas.tsx`
- Menu states: Local state in each `CanvasElementRenderer` component
- Text edit state: Local `isEditing` state in text component

### Event Flow
```
Canvas MouseDown
  ↓
Check target (background vs element)
  ↓
Background → Clear selections → Close all menus
  ↓
Element → Select element → Show menu → Handle submenu interactions
```

### Container Expansion Algorithm
```
Child update detected
  ↓
Check if child has containerId
  ↓
Calculate child's new bounds (x, y, width, height)
  ↓
Calculate required container size with padding
  ↓
Update container if expansion needed (never shrink)
```

## Performance Considerations

- Click-outside listeners use event delegation (single listener per component)
- Container expansion uses `setTimeout(0)` to batch updates during drag
- Menu state changes are localized to individual components
- No unnecessary re-renders during drag operations

## Future Enhancements

- Consider adding container shrink-to-fit option (manual trigger)
- Add visual feedback when container auto-expands
- Consider adding "pin position" for more granular locking
- Add keyboard shortcut for lock/unlock (L key)
