# CXD Template Design System

Distilled from the user's polished exemplar layouts (2026-07-22 training round:
storyboard flow, storyboard gallery, persona pipeline, World/Story/Magic portals,
Trait Mapping quadrants, States board interior, Intention Core funnel). Every new
template in `templates.ts` should be authorable from these rules alone.

## 1. Composition: every template has a spine

Pick ONE reading structure and commit to it:

- **Rail** (left→right): sequential processes. Anchor/source on the left edge,
  outputs on the right edge. Lanes are horizontal; stages are punctuated.
- **Hub** (center-out): one focal anchor, satellites radiating. Use for
  comparative/parallel content (quadrants, four states around a mapping block).
  Symmetry matters — equal offsets, mirrored corners.
- **Gallery** (top-down grid): collections. One big titled container, N×M grid of
  same-size cells, even gutters.

Branching is encouraged on rails: source → hub shape → two parallel lanes →
convergence waypoint (see §6).

## 2. Zones: a container is a job, not a box

Every container teaches what to do inside it:

- **Gradient title** (see §7) + **one-line guidance caption** in muted text
  ("Add extra details such as environment, tools, demographics…"). Caption is a
  `text` element at 12–13px, `rgba(255,255,255,0.55)`.
- Thin divider under the title: a 1–2px `line` element in the zone's accent color
  at ~40% opacity, spanning most of the container width.
- Generous padding: content starts ≥70px below the container top; ≥24px side
  padding; containers are sized so seeded content occupies ≤60% — room to grow.
- Rotate `tintColor` across zones — adjacent zones never share a tint.

## 3. Palette: one rotation, three surfaces

The same six-family rotation unifies everything:
`violet → ocean → emerald → sunset → rose → glacier`

- Container `tintColor` uses the family name.
- Edge `style.gradientName` uses the family name.
- Card fills use the matching dark gradient from `PRESET_COLORS`; titles/accents
  use the matching `TEXT_GRADIENTS` entry.
- A zone's edges, seeds and hexagons inherit the zone's family. Parallel branches
  each take their own family (that's what makes flows readable at a glance).

## 4. Seeds, never blanks

Every zone ships with at least one pre-styled starter the user EDITS rather than
an empty area they must fill from scratch:

- **Note seed**: freeform note card, `emoji` set (🔆 🔥 💡 …), noteTitle that names
  the move ("Antivision", "Design Incentives"), placeholder body, gradient bg
  from the zone family. `hideNoteTitle` stays false.
- **Storyboard seed**: image element with `storyboard: true`, empty `src` (shows
  the upload affordance), caption placeholder — already framed.
- **Table seed**: for comparative zones, a small pre-headed table (headerRow on).
- Docs: freeform with `isDocument: true` reads as a compact file icon — use rows
  of them inside a board frame for "evidence lockers".

## 5. Portals: hexagon boards are the depth mechanism

Anything deep (research, moodboard, mechanics, personas) is a `board` element:
`icon` + `hexColor` from the zone family + short title. Two placements:

- **Row of up to 3** inside a portal container (World/Story/Magic pattern).
- **Right-edge column** as the template's output library, optionally separated by
  a thin vertical divider line.

Boards may ship pre-seeded interiors (elements with `boardId = childBoardId`):
use the Hub composition inside — center anchor, symmetric satellites.

## 6. Edges: curved gradients, never bare lines

- Element-to-element connections are `CanvasEdge`s with `style.gradientName`,
  moderate thickness (2–3), and a gentle `bend`. Straight gray lines are only for
  dividers/underlines.
- Rotate gradient families per branch; label edges only when the relationship
  isn't obvious.
- **Waypoints**: small shapes as flow punctuation — filled `circle` (60–110px) as
  branch hub, outlined `diamond` as terminal/decision. Waypoints sit ON the lane
  axis; edges enter/leave through them.

## 7. Typography scale

- **Page title** (optional, one per template): 22–26px bold, gradient text
  (`TEXT_GRADIENTS` family of the template), with a 12px muted subtitle below.
- **Zone title**: 18–20px semibold gradient text + divider (see §2).
- **Caption/guidance**: 12–13px, `rgba(255,255,255,0.5–0.6)`.
- **Step cards** (process rails): small dark freeform cards, 150–200px wide —
  numbered badge in title ("1 · Gather Inputs"), 2-line instruction body, chained
  with edges alongside the zones they drive.

## 8. Spacing & rhythm

- 20px base grid; snap everything.
- Gutters: 24px between grid cells, 40px between siblings in a zone, 80–140px
  between zones, 120px+ around waypoint hubs.
- Lanes align element **centers**, not tops.
- Hub compositions are symmetric to the pixel (equal dx/dy from the anchor).

## 9. Anchors: wire templates into the pipeline

Where a template corresponds to framing data, place an `experienceBlock`
(componentKey: intentionCore, contextAndMeaning, stateMapping, traitMapping…) at
the spine's origin and run edges from it into the zones. This is the CXD moat —
templates aren't dead diagrams, they hang off live project data.

## 10. Authoring checklist

1. Spine chosen and stated in a comment.
2. Zones tinted in rotation, each with title + caption + divider + seed.
3. All connections are gradient edges; waypoints punctuate branches.
4. At least one portal (hexagon board), placed per §5.
5. Anchor block wired in when a matching framing section exists.
6. Coordinates on the 20px grid; run the layout math (no overlaps, gutters per §8).
7. Element count 15–30; every element either teaches, seeds, or connects.

## Infra notes (implementation)

- `TemplateDefinition` needs `edges?: CanvasEdge[]` — insert via `addCanvasEdges`
  after `addCanvasElements`; `remapTemplateIds` must remap edge from/to ids.
- `remapTemplateIds` must also remap `element.boardId` (pre-seeded board
  interiors reference the board's `childBoardId`).
- Storyboard seeds rely on `storyboard: true` + empty `src` upload state.
