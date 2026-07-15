# Polish Sprint — July 2026 (user-dictated backlog)

## Export & Deliverables (approved, add to pipeline)
Hub reachable from navbar (next to Share) + Overview "Deliverables" section + contextual wizard-complete moment. Artifacts grouped Sell/Build/Run:
- Concept one-pager / pitch deck (intention core, desired change, personas, sensory chart, canvas imagery)
- Role-scoped briefs (filter by hypercube face tags → per-discipline export) — THE differentiator
- Production pack (task CSV, Gantt snapshot, versions/milestones)
- Run-of-show script (experience flow stages: stage/duration/engagement/notes)
- Facilitation & state-care sheet (state/trait mapping → intensity curve, consent/integration notes)
- Existing: share link + ICS feed presented in same hub
Build order: hub shell + relocate ERD (from hypercube-3d.tsx chat area) → run-of-show + production pack → role briefs → pitch deck.

## AI chat polish
- [ ] Fade-in transition on streaming text (current appearance "too brutal")
- [ ] `overflow: visible` on the map-view view-switcher div — it clips the AI chat button glow
- [ ] Rename "AI Chat" → "Wizard"

## Map view / Explore mode rethink (ideation)
Explore button must become more than a 3D rotation gimmick: ideate UI/info overlays that
incentivise cognitive connections BETWEEN faces — sense-making through the geometric metaphor.
Ideas to develop: cross-face element pairings ("this Sensory element supports this State goal"),
edge/adjacency highlights on the cube (shared elements between adjacent faces), guided
"connection prompts" when two faces are both sparse, connection-count heat on cube edges.

## "Draft on Canvas" output structure
Currently unstructured overlapping pile (see 2026-07-15 screenshot: cards stacked on top of
each other, unreadable). Needs real layout — reuse framing-to-canvas layout engine patterns
(hub+satellite, non-overlapping grid, real card sizes incl. 300px note floor).

## Container behavior fixes
- [ ] Can drag a container INSIDE itself (via boards) — exclude self/descendants from drop targets
- [ ] Click-to-place from element menu over a container selects the container instead of placing into it
- [ ] Undo sometimes doesn't apply to containers
- [ ] Hard to select elements inside container (container steals selection)
- [ ] Auto-resize unstable — jumps to unreasonable sizes; rethink algorithm

## Experience flow timeline (collapsed state redesign)
Only the button visible, rounded edges toward bottom of page, bottom edges connect to a
thin line running across the screen.

## Micro-bugs
- [ ] Space/middle-click momentarily activates a background color on the right-hand
      draggable-elements panel container div — must stay transparent
- [ ] Duplicated objects placed BELOW original (z-order) — you end up dragging the original;
      new copy should be offset + on top + become the selection

## Links & embeds
- [ ] Click outside doesn't deselect them
- [ ] Embedded websites capture clicks — need a drag handle/window chrome so the element can
      be moved without interacting with the iframe; redesign interaction model
- [ ] File-preview iframe (linkMode 'file', canvas-element.tsx ~7065) has the same drag-trap as embeds had — apply the same inert/shield pattern

## Explore mode decision (2026-07-15)
User picked Concept 1 'Geometric Resonance' (edge-resonance): cube edges lit by count of elements sharing both adjacent faces' tags; click edge -> panel with shared elements or bridge prompt. Build AFTER current regression fixes + Export hub.
