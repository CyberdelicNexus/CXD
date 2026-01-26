# Hypercube Face Identity System & Sensemaking Mode

## 1. Sensemaking Mode Definition

### Overview
Sensemaking Mode is the **default state** of the hypercube, prioritizing at-a-glance comprehension over interaction. It communicates balance, gaps, and coherence without requiring user exploration.

### Core Principles
- **Visual-first comprehension**: Meaning is immediately apparent without hovering or clicking
- **Non-intrusive interaction**: Rotation and clicking remain available but are secondary
- **Analytical dashboard feel**: The cube is a reflection, not a workspace
- **Calm, intentional aesthetics**: Slow transitions, no physics, no playfulness

### Visual Communication Hierarchy
1. **Tint** (Domain color) → What domain is this?
2. **Glyph** (Symbolic icon) → What role does this domain play?
3. **Glow intensity** → How developed is this domain?
4. **Glow pattern** → What state is this domain in?
5. **Text labels** → Secondary, appears on focus/hover

### Behavioral Specifications

#### Default State (No Focus)
- All faces visible with unique domain tints
- Glyphs clearly visible as primary identifiers
- Glow intensity reflects completion level
- Cube rotates slowly for ambient awareness (optional)
- Text labels hidden or minimal

#### Hover State
- Face slightly highlights
- Text label fades in
- Semantic role tooltip appears
- Glyph remains primary identifier
- No automatic rotation

#### Focus State (Face Selected)
- Selected face rotates to front
- Face enlarges slightly (1.1x scale)
- Glow intensifies
- Non-selected faces dim to 30% opacity
- Related elements panel appears below
- Text label fully visible
- Semantic role description shown

#### Core State
- All faces visible equally
- Central "CORE" label highlighted
- No face prioritization
- Neutral rotation angle

### UI Constraints

**MUST NOT:**
- Remove rotation capability
- Remove clicking capability
- Block manual interaction
- Auto-rotate without user intent
- Hide glyphs at any state
- Make text the primary identifier

**MUST:**
- Show all faces in default view
- Make tint immediately visible
- Render glyphs clearly at all zoom levels
- Maintain smooth, slow transitions (0.5-0.8s)
- Keep interactions predictable and calm

---

## 2. Face Identity System

### Visual Language Rules

#### Tint (Domain Color)
Each face has a **unique persistent hue** (0-360°) that never changes and is never reused:

| Face | Hue | Color Name | Semantic Domain |
|------|-----|------------|-----------------|
| Reality Planes | 280° | Purple | Technical/Digital substrate |
| Sensory Domains | 45° | Amber | Warm/Physical embodiment |
| Presence Types | 195° | Cyan | Awareness/Being quality |
| State Mapping | 160° | Teal | Transient/Momentary |
| Trait Mapping | 260° | Violet | Enduring/Structural |
| Meaning Architecture | 320° | Magenta | Narrative/Story |

**Color Modulation Rules:**
- **Saturation**: Base (35-45%) + completion bonus (0-20%)
- **Lightness**: Base (28-32%) + glow intensity (0-15%)
- **Never** change hue based on state
- **Never** reuse hue for another face

#### Glyph (Symbolic Icon)
Simple SVG path defining the role:

- **Reality Planes**: Layered squares (stacked realities)
- **Sensory Domains**: Wave pattern (sensory input)
- **Presence**: Eye shape (awareness/being)
- **State Mapping**: Filled circle (momentary state)
- **Trait Mapping**: Diamond lattice (enduring structure)
- **Meaning Architecture**: Spiral (narrative/meaning)

**Glyph Rendering Rules:**
- Always visible, never hidden
- Consistent stroke weight (2px)
- Size: 40x40px viewport
- Position: Center of face panel
- Filter applied based on glow pattern
- Color: Domain tint + lightness boost

#### Glow Intensity (Completion Level)
Reflects how developed the domain is:

| Intensity | Meaning | Visual |
|-----------|---------|--------|
| 0.1 | Undeveloped | Dim, barely visible |
| 0.2-0.4 | Emerging | Faint glow, domain exists but minimal |
| 0.5-0.7 | Active | Moderate glow, populated |
| 0.8-1.0 | Coherent | Strong, stable glow |

**Calculation Logic:**
```
completion = (active elements / total possible) 
coherence = (well-defined / active) or (balanced distribution)
glowIntensity = f(completion, coherence)

if completion == 0:
  glowIntensity = 0.1  // Dim
else if completion < 0.5:
  glowIntensity = 0.2 + completion * 0.3  // Faint
else if coherence > 0.7:
  glowIntensity = 0.5 + completion * 0.3  // Strong
else:
  glowIntensity = 0.3 + completion * 0.2  // Moderate
```

#### Glow Pattern (State Signal)

| Pattern | Meaning | Visual Effect |
|---------|---------|---------------|
| **Stable** | Coherent & well-populated | Steady glow, no animation |
| **Pulsing** | Active but incomplete | Slow opacity pulse (2.5s cycle) |
| **Fractured** | Conflicting or overloaded | Turbulence displacement filter |

**Pattern Logic:**
- **Stable**: completion > 0.5 AND coherence > 0.7
- **Pulsing**: completion > 0 AND (coherence < 0.7 OR missing artifacts)
- **Fractured**: overloaded inputs (e.g., >4 active planes, >70% sensory avg)

#### Text Labels (Secondary)
Appear only on:
- Hover
- Focus
- Side panel open
- Tooltip context

**Label Hierarchy:**
1. **Primary**: Glyph (always visible)
2. **Secondary**: Short label (hover/focus)
3. **Tertiary**: Full label (side panel)
4. **Context**: Semantic role (tooltip)

#### Element Count Badge
- Position: Top-right of face panel
- Shows number of tagged canvas elements
- Color: Domain tint + 80% opacity
- Border: Glow color
- Font: 10px bold

#### State Indicator Dot
- Position: Bottom-center of face panel
- Size: 2px dot
- Color based on state:
  - **Coherent**: Bright glow color
  - **Active**: Base tint color
  - **Emerging**: 80% opacity base
  - **Undeveloped**: 40% opacity base

---

## 3. Domain-Specific Sensemaking Logic

### Reality Planes
**Completion**: Active planes / 7  
**Coherence**: Planes with defined interface/modality / active planes

**States:**
- Fractured: >4 active planes
- Stable: >30% complete AND >70% coherent
- Pulsing: Any active planes without full definition

**Constraints:**
- Cognitive Reality active without Meaning Architecture → warning

### Sensory Domains
**Completion**: Active domains / 5  
**Coherence**: 1 - (variance / 1000) — balanced distribution is coherent

**States:**
- Fractured: Average value >70
- Stable: >40% complete AND >60% coherent
- Pulsing: Any active domains

### Presence Types
**Completion**: Active types / 6  
**Coherence**: avgValue / maxValue — balanced presence is coherent

**States:**
- Stable: >4 active types (rich presence)
- Pulsing: 1-4 active types

### State Mapping
**Completion**: 0.7 if any states defined, else 0  
**Coherence**: 1 if tagged elements exist, else 0.5

**States:**
- Pulsing: States defined but no tagged artifacts
- Stable: States + artifacts present

### Trait Mapping
**Completion**: 0.7 if any traits defined, else 0  
**Coherence**: 1 if tagged elements exist, else 0.5

**States:**
- Pulsing: Traits defined but no tagged artifacts
- Stable: Traits + artifacts present

### Meaning Architecture
**Completion**: Structured components (world, story, magic) / 3  
**Coherence**: 1 if tagged elements exist, else 0.5

**States:**
- Stable: >1 component defined AND >2 tagged elements
- Pulsing: Any component defined

---

## 4. Implementation Notes

### Rendering Order
1. SVG wireframe (cube edges + struts)
2. Face panels with glyphs (z-ordered by 3D depth)
3. Text labels (HTML overlay, always on top)
4. Controls + panels (fixed UI layer)

### Animation Timing
- Face selection rotation: 600ms cubic-bezier(0.4, 0, 0.2, 1)
- Opacity transitions: 500ms ease
- Glow pulse: 2.5s ease-in-out infinite
- Hover states: 200ms ease

### Accessibility
- Glyphs have semantic meaning without text
- Tooltips provide full context on hover
- Keyboard shortcuts (1-6) for face selection
- Escape always resets to default view

### Performance
- SVG filters cached
- Memoized intensity calculations
- Minimal re-renders on rotation
- No continuous animation loops (except pulsing)

---

## 5. User Experience Flow

### First Impression (0-3 seconds)
User sees:
- Six colored panels with unique glyphs
- Some faces glowing brighter than others
- Some faces pulsing, others stable
- Element count badges on populated faces
→ **Immediate understanding of experiential structure**

### Exploration (3-30 seconds)
User hovers:
- Text labels appear
- Semantic roles explained
- Constraint tooltips visible
→ **Deeper understanding without clicking**

### Investigation (30+ seconds)
User clicks:
- Face rotates to front
- Related elements panel shows artifacts
- Can open detail panel for editing
→ **Full context and editing capability**

### Return to Overview
User presses Escape or clicks reset:
- Cube returns to default rotation
- All faces visible again
- Sensemaking mode restored
→ **Back to analytical dashboard**

---

## Acceptance Criteria

✅ User can understand experiential balance at a glance  
✅ Faces communicate identity without readable text  
✅ Glow patterns reveal domain state (stable/pulsing/fractured)  
✅ Completion and coherence visually obvious  
✅ Rotation and clicking remain available but not required  
✅ Hypercube feels analytical, calm, and legible  
✅ No automatic navigation or surprising behavior  
✅ Text labels are secondary, not primary identifiers  
