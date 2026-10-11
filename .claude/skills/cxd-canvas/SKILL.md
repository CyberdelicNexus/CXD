---
name: cxd-canvas
description: Compose, generate or restyle CXD canvas content (diagrams, flows, loops, mind maps, tables, frames, notes, templates) and change what the Canvas Assistant produces. Use when authoring canvas elements or templates by hand, tuning the assistant's output or prompts, adding an element kind or style prop to the AI pipeline, or debugging a layout the assistant drew badly.
---

# CXD Canvas

The canvas is a near-black surface. Good output reads as a **diagram**: nodes,
connectors, floating typography and the occasional outline frame. Colour lives
in thin gradient rings, gradient headings and connectors, never in large bright
fills. A wall of note cards is a failed layout.

The model-facing version of these rules is `src/lib/ai/canvas-skill.ts`
(`CANVAS_COMPOSITION_SKILL`), which both AI guides embed. **Change the rules
there**; this file explains how to use and extend them.

## 1. Pick the form from the content

| Content | Form | Built from |
|---|---|---|
| Process, journey, pipeline, stages | Flow | pill nodes + connectors, left to right |
| Cycle, feedback loop, flywheel | Loop | 3-6 pills in a closed ring, name as floating text in the middle |
| One idea with branches | Mind map | hub node + branch nodes |
| Stages that each need explaining | Spine | small stage nodes chained, each connected to a wide detail node |
| Decision logic | Flow | diamond per decision, labelled connector per outcome |
| Comparison, matrix, before/after | Table | one `table` element, never frames faking a grid |
| Positioning, 2x2, segments | Quadrants | outline frames in a grid, heading + small pills in each |
| Parallel themes | Frames | outline frames side by side, heading + nodes or body text |
| Long-form writing to keep editing | Note | `freeform` card. The only job of a note; 1-2 per layout |
| Deep material | Portal | `board` hexagon |
| Mirrors a framing section | Anchor | `experienceBlock` at the start of the structure |

Combine forms when content has parts (title + flow + table). Aim for 8-30 elements.

## 2. Building blocks

All elements are `CanvasElement` (`src/types/canvas-elements.ts`): absolute
coordinates even inside a container, children nest via `containerId`, snap to a
20px grid.

**Node** = `shape`. Text in `content`, 1-6 words.

| shapeType | Meaning | Size |
|---|---|---|
| `pill` | stage, step, start/end | 260x100 |
| `rectangle` | statement; detail (wraps ~140 chars) | 160x80; 320x120 |
| `diamond` | decision | 160x160 |
| `hexagon` | concept, principle | 200x180 |
| `circle` | hub, waypoint | 100x100 |
| `parallelogram` / `cylinder` / `document` / `callout` | I/O / data / artifact / annotation | ~240x90 / 160x140 / 180x130 / 240x100 |

Look (`props.look`): `outline` (default: dark body `#0B0E17`, two-hue ring,
bold white text), `filled` (the single most important node), `ghost`
(optional or future). `props.fontSize` 10-40 overrides the size-based default.

**Floating text** = `text` with `props.role`:

| role | Style | Use |
|---|---|---|
| `title` | 30px bold gradient | one per layout |
| `heading` | 20px bold gradient | names a frame, lane or section |
| `label` | 12px bold, muted white | axis ends, small tags (write it UPPERCASE) |
| `caption` | 13px, 55% white | one-line explanation |
| `body` | 14px, 85% white | short paragraph |

`props.align` centres or right-aligns the text in its box. Height is computed
from content; width is about `0.6 x fontSize` px per character per line.

**Frame** = `container`. Only ever an outline around related elements, with
`props.titled: false` (stored as `hideLabel: true`). Name it with a floating
`heading` text as its first child. If a frame has a label and no heading child,
the generator shows the title bar so the name is never lost. Don't frame
everything: flows, loops and mind maps usually need none.

**Connector** = `CanvasEdge` (the generators build it with `buildConnectorEdge`).
Style props: `gradientName` (tint family), `thickness` 1-8, `lineStyle`
solid/dashed/dotted, `arrowStyle` none/start/end/both. Anchors are automatic.
A `line` element is a horizontal divider, never a connection.

**Also**: `table` (`props.cells` row-major, `headerRow`), `freeform` note
(`emoji`, `noteTitle`, `noteBody`, `cardType`), `image` storyboard seed,
`link` bookmark (`props.url`), `board` portal, `experienceBlock`
(`props.componentKey`).

## 3. Colour

Six families: `violet ocean emerald sunset rose glacier`. One tint colours
whatever it is set on. Tables in `src/lib/ai/element-generation.ts`:

| Table | Used for |
|---|---|
| `TINT_GRADIENTS` | note fills. Near-black on purpose; keep every channel <= 0x45 |
| `TINT_RINGS` | node outline gradient |
| `TINT_TEXT_GRADIENTS` | title and heading gradient text |
| `BOARD_HEX_COLORS` | portal hexagon fill |

A simple diagram uses **one** family for all nodes and connectors. A second
family must mean something: sunset/rose = problem or risk, emerald = solution
or growth, ocean = process, violet = core or default, glacier = neutral.
Untinted nodes share one batch family and children inherit their frame's.

## 4. Geometry

Sizes are real: a node occupies its `width x height`, a note paints at least
200x300 and a portal 170x230 whatever is stored (`RENDER_FLOORS` in
`src/lib/canvas-layout-rules.ts`), text grows to its content.

- Gaps: 120px+ between connected nodes along the flow, 60px between stacked nodes, 140px between frames.
- Loop of four: pills at (0,0) (400,0) (400,240) (0,240); name centred at (130,130) width 400.
- Flow: pills at x = 0, 380, 760 on one y; a diamond sits 30px higher so centres align.
- Spine: stages 160x80 every 180px down; details 320x120 at x+280, y-20.
- Frame: 32px padding, heading at (x+32, y+28), content from y+84.

## 5. The two AI paths

| | Draft diagram (`/api/ai/generate-elements`) | Apply to canvas / typed instruction (`/api/ai/canvas-operations`) |
|---|---|---|
| Guide | `CANVAS_GENERATION_GUIDE` | `CANVAS_OPERATIONS_GUIDE` |
| Schema | `generateElementsSchema` (elements + edges) | `canvasOperationsSchema` (flat op rows) |
| Tint / shapeType | typed fields | inside `props` |
| Coordinates | **discarded**; `layoutDraftElements` re-lays out from structure | **kept**; `repairLayout` only fixes collisions and escapes |
| Conversion | `generatedToCanvas` | `sanitizeCanvasOperations` -> `generatedToCanvas`, applied by `translateForApply` |

**One draw action per chat.** The Canvas Assistant shows only "Apply to canvas"
(the operations path, which also draws diagrams); "Draft diagram" appears only
in chats without the review pipeline. Offering both produced two different
layouts of the same answer.

Draft layout (`src/lib/ai/draft-layout.ts`) arranges by the shape of the graph:
a closed ring -> loop; one node joined to at least half the others -> radial
mind map; anything else -> layered flow. The flow breaks cycles first, keeps
the longest path straight as the spine, hangs leaves off their parent as
satellites, and snakes into rows past 6 columns. Unconnected text
becomes the title block (or a loop's centre); other unconnected groups shelf
below.

## 6. The assistant experience

What happens around the model call, all of it model-free:

| Step | Where | Notes |
|---|---|---|
| Route a message | `isActionableMessage` (edits) or `isDrawRequest` (draw commands) in the chat panel | Anything else is conversation |
| Offer a form | `needsFormChoice` + `suggestForms` (`src/lib/ai/assistant-forms.ts`), `AssistantFormChooser` | Only when the request leaves the form open. The pick is appended to the instruction as `FORMS[id].directive`. "Don't ask in this project" is a per-project localStorage preference |
| Suggest a form | `fetchFormOptions` -> `/api/ai/suggest-form` -> `rankFormsWithJev` (`src/lib/ai/jev.ts`) | Jev (TypeSafe) ranks the 12 forms when `TYPESAFE_API_KEY` is set; no key, an error or >2.5s falls back to the rules. Its "dataset" is `FORM_CRITERIA` + `EXAMPLES` in `jev.ts`; grow `EXAMPLES` from `scripts/export-assistant-feedback.ts` |
| Rework a selection | `reworksSelection` + `routeCanvasText` (chat panel) | "Rearrange these into a better diagram" is built FROM the selected elements and replaces them; tags are carried over by matching text |
| What the model sees | `buildCanvasInventory` / `getElementTitle` / `getElementBody` (`src/utils/ai-context-aggregator.ts`) | Every element type must return its visible text. A type that falls through to a generic word makes the assistant blind to it |
| Review | `CanvasOperationsPreview` draws the proposal with `MapPreview` (`src/components/cxd/canvas/map-preview.tsx`, shared with the lab) | Extra and destructive changes are toggle chips, never a checklist |
| Place | `placeBatch` in `canvas-operations-executor.ts` | A revision takes the place of what it replaces; a standalone diagram is built where the user is looking; an addition wired to existing work keeps the model's position |
| Build | `src/lib/ai/assistant-build.ts` | One committed batch, then a camera glide (`pendingCanvasFitBounds.animate`) and a staged reveal done with CSS `animation-delay` (`.assistant-reveal`). View state only, never in the Y.Doc |
| Refine | chips on an applied card -> `propose(..., { targetIds, replaceIds })` | The delete of the old version is added by the client as a visible red row; the model is only asked to draw |
| Free tools | `tidyLayout`, `connectInOrder` (`src/lib/ai/canvas-tools.ts`) | Instant, no credits, one undo |
| Style memory | `describeStyle` -> `AssistantPrefs.style` | Appended to every draw request for the project |
| Starters | `projectStarters(context, selectionCount)` | Built from framing, map completion and the canvas |
| New-chat menu | `AssistantHome` (`assistant-home.tsx`) | Six quick actions (canvas / chat / compose modes), project starters, and the can / can't list. Update the lists there when capabilities change |
| Beta feedback | `logAssistantEvent` (`src/lib/ai/assistant-feedback.ts`) -> `/api/ai/canvas-feedback` -> table `canvas_assistant_feedback` | Events: `form_picked`, `built`, `discarded`, `refined`, `rated` (thumbs + reason), joined by `entry_id`; built and rated carry a compact snapshot. In dev a thumbs-down also becomes a Structure Lab input |
| Credits | `refundAICredits` (`src/lib/ai/credit-refund.ts`) | A build that fails, or returns nothing to approve, is refunded (service-role RPC `refund_ai_credits`) |

Check with `npx tsx src/lib/ai/__verify__/assistant-tools.verify.ts`.

## 7. Extending it

Adding a style prop or element kind:

1. Whitelist it in `generatedToCanvas` (`element-generation.ts`). Unknown props are ignored, so the prompt alone does nothing.
2. For op=update support, add it to `UpdatePatch` (`src/types/ai-operations.ts`), the `update` case in `sanitizeCanvasOperations`, and the per-type guard in `translateForApply`.
3. Teach it in `canvas-skill.ts` (shared) or the schema-specific section of one guide.
4. If it changes an element's footprint, update `naturalSize` in `draft-layout.ts` and `realBounds` in `canvas-layout-rules.ts`.
5. Add a check to `src/lib/ai/__verify__/diagram-vocabulary.verify.ts`.

Hand-authored templates (`src/lib/templates.ts`) follow the same vocabulary;
insert with `remapTemplateIds` then `addCanvasElements`. Never loop
`addCanvasElement` for a batch.

## 8. Verify

```
npx tsx src/lib/ai/__verify__/diagram-vocabulary.verify.ts   # vocabulary, both paths, draft layout
npx tsx src/lib/ai/__verify__/canvas-operations.verify.ts
npx tsx src/lib/ai/__verify__/canvas-operations-executor.verify.ts
npx tsx src/lib/__verify__/draft-layout.verify.ts
npx tsx src/lib/maps/__verify__/render.verify.ts             # the lab reuses generatedToCanvas
npm run build                                                # the real gate
```

`npx tsx src/lib/ai/__evals__/canvas-eval.ts [provider] [filter] [repeats]`
runs live instructions through the real propose path and scores them. It
spends credits, so run it deliberately after a prompt or sanitizer change.

## 9. Traps

- **Connectors are straight strokes.** The canvas cannot route a connector around anything, so one that reaches across a diagram is drawn through every node in between. Both paths drop connectors that would cut through two or more unrelated elements (`connectorsThroughNodes`); the guides tell the model to connect neighbours only and never put more than 6 nodes in a row.
- **Tag badges** show on hover; the "Show tags" toggle in the left toolbar pins them (`src/lib/tag-visibility.ts`, a per-user localStorage preference, not project data). Do not stamp chat-detected faces on every generated node: the draft path only carries `sourceFaces` when it is one or two faces.
- **Font weight**: `ShapeCard` and `TextCard` pass `style.fontWeight` straight to CSS. Use `bold` or `normal`; `semibold` and `medium` are silently dropped.
- **Gradient text** on a `text` element is stored in `style.bgColor`, not `textColor`. On a shape it is `style.textColor`.
- **Text height** is only written back by the client while the element is selected, so compute it (`estimateTextHeight`) instead of trusting a model's guess.
- **Schema limits** (Anthropic structured output): no `minItems`/`maxItems`, at most 16 union-typed parameters, and many optional fields trip "schema too complex". Put new extras in the `props` JSON string, not new schema fields.
- **Gemini** rejects empty-string enum values; use a `"none"` sentinel.
- The guides must never mention a connector "bend" (`no-bend-guidance.verify.ts`): the canvas does not draw `edge.bend`.
- `src/lib/maps/element-style.ts` recovers a card's tint by exact match on `TINT_GRADIENTS`, so cards created before a palette change read as untinted in the lab.
- The assistant is propose-only: everything goes through a review card before `applyCanvasBatch`.
