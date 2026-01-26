# Layer Transition Logic - Hypercube Modes

## Overview
The hypercube operates in two modes that transition smoothly without breaking spatial or semantic continuity:

1. **Sensemaking Mode** (Default) - At-a-glance comprehension
2. **Exploration Mode** - Progressive focus on a specific domain

## State Machine

```
┌─────────────────┐
│  Sensemaking    │ ◄────────┐
│     Mode        │           │
└────────┬────────┘           │
         │                    │
         │ Click Face         │ ESC / Drag / 
         │                    │ Reset View
         ▼                    │
┌─────────────────┐           │
│  Exploration    │───────────┘
│     Mode        │
└─────────────────┘
```

## Sensemaking Mode

### Visual State
- All faces visible and legible
- Cube at default rotation (-25°x, -35°y)
- Default zoom level (1.0)
- Face tints clearly visible
- Glyphs communicate domain identity
- All edges visible with tinted colors
- Diagnostic panel available

### Interactions
- **Hover face button** → Highlights related diagnostics
- **Click face button** → Transition to Exploration Mode
- **Drag cube** → Manual rotation (stays in Sensemaking)
- **Click Core** → Return to centered view
- **Keyboard 1-6** → Quick face selection (transitions to Exploration)

### Purpose
Provides holistic view of experience design balance, gaps, and coherence without requiring user action.

## Exploration Mode

### Visual State
- Selected face brought to front (smooth rotation)
- Zoom increased by 15% for focus
- Non-focused elements dimmed (edges opacity: 0.7 → 0.4)
- Struts dimmed (opacity: 0.6 → 0.3)
- Related elements panel visible
- Selected face button highlighted (cyan)
- Mode indicator shows "Exploration"

### Interactions
- **Click same face again** → Opens detail panel
- **Click different face** → Transitions focus to new face
- **Hover focused face** → Shows semantic role tooltip
- **Drag cube** → Returns to Sensemaking Mode
- **ESC key** → Returns to Sensemaking Mode
- **Reset view** → Returns to Sensemaking Mode
- **Click Core** → Returns to Sensemaking Mode

### Purpose
Provides progressive focus without collapsing the cube or removing context. All domains remain visible but deprioritized.

## Transition Rules

### Sensemaking → Exploration
**Triggers:**
- Clicking a face button
- Keyboard shortcut (1-6)

**Behavior:**
1. Set mode to "exploration"
2. Animate rotation to bring face forward
3. Increase zoom by 15%
4. Dim non-focused elements (smooth opacity transition)
5. Show related elements panel
6. Highlight selected face button
7. Update mode indicator

**Duration:** 600ms cubic-bezier(0.4, 0, 0.2, 1)

**Critical:** Never hide other faces. Dimming only.

### Exploration → Sensemaking
**Triggers:**
- ESC key press
- Drag interaction
- Click reset view button
- Click Core button

**Behavior:**
1. Set mode to "sensemaking"
2. Animate rotation to default position
3. Reset zoom to 1.0
4. Restore all element opacity
5. Hide related elements panel
6. Deselect face buttons
7. Update mode indicator

**Duration:** 600ms cubic-bezier(0.4, 0, 0.2, 1)

**Critical:** Smooth return to overview without jarring snap.

### Exploration → Exploration (Face Switch)
**Triggers:**
- Clicking a different face button while in Exploration mode

**Behavior:**
1. Stay in "exploration" mode
2. Animate rotation to new face
3. Maintain zoom level
4. Smoothly transition dimming to new focus
5. Update related elements panel
6. Update selected face button

**Duration:** 600ms cubic-bezier(0.4, 0, 0.2, 1)

**Critical:** Continuous exploration without returning to overview.

## UI Constraints

### MUST
- Always keep all faces visible
- Maintain spatial relationships during transitions
- Preserve semantic meaning (tints, glyphs, diagnostics)
- Allow manual drag at any time
- Provide clear visual feedback for current mode
- Smooth animations for all transitions

### MUST NOT
- Collapse cube to single face
- Remove domains from view
- Break spatial continuity
- Auto-rotate without user intent
- Hide context when exploring
- Snap transitions without animation

## Interaction Cues

### Hover State (All Modes)
- Face buttons: Slight glow increase
- Related diagnostics: Highlighted in panel
- Tooltip: Face label and semantic role
- Cursor: Pointer

### Focus State (Exploration Mode)
- Selected face: Cyan tint, scale 1.05
- Face button: Cyan background, scale 1.05
- Element count badge: More prominent
- Related elements: Visible in bottom panel

### Drag State (All Modes)
- Cursor: Grabbing
- If in Exploration: Auto-return to Sensemaking
- All faces: Remain visible during drag
- Smooth rotation: No inertia

## Progressive Focus Principle

Exploration actions **increase visual fidelity**, they do not reduce abstraction:

| Action | Effect |
|--------|--------|
| Select face | +15% zoom, +5% scale on face, +dimming on others |
| Double-click face | Open detail panel (overlay, cube still visible) |
| Hover face | Show semantic role, highlight diagnostics |
| Drag cube | Return to full context |

**Never:**
- Hide other faces
- Remove cube structure
- Collapse to 2D view
- Break out of spatial context

## State Persistence

### Session State
- Current mode (sensemaking/exploration)
- Focused face index (null or 0-5)
- Core selected (boolean)
- Zoom level
- Rotation angles

### Navigation State
- User can manually rotate at any time
- Manual rotation preserves current mode
- Dragging from Exploration returns to Sensemaking
- Keyboard shortcuts always work

## Performance Considerations

- Smooth 60fps animations via CSS transitions
- Memoized intensity calculations (prevent re-calc on every render)
- Efficient opacity transitions (GPU-accelerated)
- No continuous animation loops (only triggered transitions)
- Diagnostic panel toggle (hide when not needed)

## Accessibility

- Keyboard shortcuts documented (1-6, 0, ESC)
- Mode indicator always visible
- Clear visual feedback for all state changes
- Focus states for screen readers
- Tooltips on all interactive elements

## Future Enhancements

- **Hover-triggered diagnostic highlights**: When hovering a face button, highlight related diagnostic cards
- **Breadcrumb navigation**: Show path from sensemaking → exploration → detail panel
- **Multi-face comparison**: Select 2-3 faces for side-by-side comparison
- **Animation speed control**: User preference for transition duration
- **Auto-tour mode**: Guided exploration of all domains

## Example User Flow

1. **User lands on hypercube** → Sensemaking Mode
   - Sees all domains at a glance
   - Notices "Sensory Domains" glowing brightly
   - Diagnostics show "High sensory load"

2. **User clicks "Sensory" face button** → Exploration Mode
   - Cube rotates to bring Sensory face forward
   - Zoom increases slightly
   - Related elements panel shows 8 tagged artifacts
   - Other faces dim but remain visible

3. **User hovers over "Presence" face button**
   - Diagnostics highlight "Low presence definition"
   - Semantic role tooltip: "Quality of being"
   - Face button glows

4. **User clicks "Presence" button** → Stays in Exploration
   - Smooth transition from Sensory to Presence
   - New related elements panel
   - Diagnostics update context

5. **User presses ESC** → Returns to Sensemaking
   - Cube returns to default view
   - Zoom resets
   - All faces visible equally
   - Mode indicator: "Sensemaking"

---

**Key Principle:** Exploration never removes context. It only shifts focus.
