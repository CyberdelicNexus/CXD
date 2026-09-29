# CXD Canvas — Project Guide

CXD (Cyberdelic Experience Design) Canvas is a Next.js 14 (App Router) app for
designing experiences across a multi-dimensional model. Its moat is not the
canvas — it's the opinionated pipeline **intent → multi-dimensional design →
production**. Read this before making changes; it encodes the non-obvious
architecture and the traps that have caused real bugs.

## Stack & layout

- **Next.js 14.2** App Router, React 18, TypeScript (strict). Windows dev env.
- **Zustand** store: `src/store/cxd-store.ts` — the single source of UI-facing state.
- **Yjs (Y.Doc)** is the authoritative persistence + collaboration layer; a bridge
  syncs it into Zustand. See "Save architecture" below.
- **Supabase** for auth, Postgres (projects, credits, subscriptions), and Y.Doc
  state persistence. **Radix UI** + Tailwind for components. **Vercel AI SDK** (`ai`)
  for AI features. **Sentry** for errors. **Inngest** for durable email.
- Build: `npm run build`. Dev: `npm run dev`. There is **no test runner wired up** —
  a few `src/**/__tests__/*.test.ts` files reference jest but jest isn't installed,
  so a repo-wide `npx tsc --noEmit` reports errors *only* in those files. That is
  pre-existing noise, not a regression. `npm run build` is the real gate.
  For standalone logic checks, write a `src/**/__verify__/*.verify.ts` script and
  run it with `npx tsx` (see `src/lib/__verify__/framing-to-canvas.verify.ts`).

## Canvas data model

- Elements: `src/types/canvas-elements.ts`. `CanvasElement` is a discriminated
  union on `type` (`container | text | shape | freeform | image | line | connector |
  link | board | experienceBlock`). Children nest via **`containerId`** (not
  `parentId`); coordinates are **absolute**, even for children inside a container.
- The design/framing schema (wizard sections, vocab) is in `src/types/cxd-schema.ts`.
  Wizard answers are stored as **top-level typed fields on `CXDProject`**
  (`intentionCore`, `desiredChange`, `sensoryDomains`, …), not a single blob.
- The Hypercube (Map view) organizes elements onto 7 **faces** via
  `element.hypercubeTags: HypercubeFaceTag[]`. The canonical tag list
  (`HYPERCUBE_FACE_TAGS`), the `HypercubeFaceTag` type, and the section→face map
  (`SECTION_TO_FACE_TAG`) all live in `src/types/canvas-elements.ts`. NOTE: there
  are legacy parallel copies (`plan-types.ts`, a local map in `hexagon-detail-panel.tsx`);
  prefer the canvas-elements source and consolidate when you touch them.

## Save architecture — Y.Doc is authoritative (read this)

Mutations flow **Zustand action → Y.Doc write → bridge → Zustand**. The Y.Doc, not
Zustand, is what persists and syncs. Key conventions:

- **Transaction origins** gate the bridge (`src/lib/yjs/y-zustand-bridge.ts`) and the
  realtime provider (`src/lib/yjs/supabase-yjs-provider.ts`):
  - `'local'` — normal user edit; the bridge flushes it back to Zustand. Single-element
    writes (`yjsAddElement`, `yjsUpdateElement`) use this.
  - `'template-batch'` — used by `addCanvasElements` for bulk insert. The bridge
    **skips** re-flushing (the action already updated Zustand directly), avoiding the
    N-element observer cascade that throws React error #310 ("maximum update depth").
    Still persisted + broadcast.
  - `'drag-commit'`, `'remote'`, `'initialization'`, `'persistence'` — also special-cased.
- **Bulk insert must go through `addCanvasElements(elements)`** (`cxd-store.ts`), the
  freeze-proof path: one Zustand `set` + one `yDoc.transact(..., 'template-batch')`.
  It auto-fills `boardId`/`surface` and pushes a single undo entry. Do NOT loop
  `addCanvasElement` for many elements. Single field edits go through
  `updateCanvasElement(id, updates)` / `syncUpdateElement` (adds peer broadcast).
  Edges have the parallel `addCanvasEdges(edges)`.
- **The elements and edges observers in `y-zustand-bridge.ts` are NOT symmetric by
  default** — each has its own `origin === 'drag-commit' || origin === 'template-batch'`
  skip guard, hand-written separately (`observeElements` / `observeEdges`). If you ever
  add a new batched writer for another Y.Doc collection (boards, comments, etc.) using
  `'template-batch'`, you must add the same skip to *that* collection's observer too —
  it will not inherit the guard from elements. Forgetting it caused a real "Maximum
  update depth exceeded" crash (2026-07-09): `addCanvasEdges` wrote to Zustand directly
  then replayed via Yjs, and since `observeEdges` lacked the guard, the replay wasn't
  skipped and re-flowed into Zustand a second time.
- **Scalar project fields** (name, wizard flags, etc.) live in the meta Y.Map. To add
  one: add it to `META_SCALAR_FIELDS` (`src/lib/yjs/y-doc-types.ts`), hydrate it in
  `y-doc-factory.ts`, and handle it in `setMetaField` (`src/contexts/yjs-project-context.tsx`).
  Write it at runtime with `yjsSetMetaField(yDoc, field, value)`. If you only set it in
  Zustand it will not survive a reload from the doc.
- **`createYText`/`setYText`** (`src/lib/yjs/y-text-helpers.ts`) coerce non-string input
  to `''`. Legacy records (versions/OKRs serialized before a text field existed) can
  deserialize with `undefined`; the element serializer guards with
  `typeof value === 'string'`, so new element text fields should follow that pattern.
- **Load-time reconciliation is mandatory** (`reconcileCanvasIntoYDoc`, called in
  `yjs-project-context.tsx` whenever a persisted `yjs_state` is loaded). A stale
  `yjs_state` must never win over elements that exist in `project_data`: in July 2026
  this exact hole silently emptied a real user's boards — load trusted the doc
  unconditionally, `forceInitialSync` replaced Zustand with the stale projection, and
  the first post-ready save persisted the loss to BOTH columns with no exception ever
  thrown. The reconciler union-merges by id (doc wins for known ids; project_data-only
  ids are seeded) and reports seeded counts to Sentry (`cxd-yjs-divergence-repaired`).
  If you add a new doc collection, add it to the reconciler too. Never add a writer
  that updates `project_data` without `yjs_state` for canvas-bearing fields — that is
  how the two universes diverge in the first place.

## React stability traps (have caused infinite-loop crashes)

These are load-bearing — see `~/.claude/.../memory/MEMORY.md` for the full write-ups:

- **Selectors must return stable references.** `getCurrentProject()` initializes
  `canvasLayout.elements`/`edges` to `[]` so selectors don't return a fresh `[]` each
  call (which Zustand reads as changed → re-render → loop).
- **Derive reactive lists from `project`, not from stable store fn refs.** e.g. inbox
  items: `useMemo(() => (project?.canvasLayout?.elements||[]).filter(el => el.inInbox), [project])`,
  never from `getAllInboxItems`.
- **Stabilize inline `onUpdate` props via a ref** in `CanvasElementRenderer`
  (`canvas-element.tsx`) so sub-components don't re-fire effects every parent render.

## AI features

Server routes live in `src/app/api/ai/*`. They share one skeleton — copy an existing
route rather than reinventing it (`analyze`, `generate-elements`, `suggest-tags`):

1. Auth via `createClient()` (`@/supabase/server`) → `getUser()`.
2. Validate/bound the body (reject oversized input).
3. Rate-limit (`checkRateLimit(user.id, "analysis", plan)`) + concurrency slot
   (`acquire/releaseConcurrencySlot`) from `@/lib/ai/rate-limiter`.
4. Deduct credits: `CREDIT_COSTS[action][provider]` + `supabase.rpc('deduct_ai_credits', …)`;
   **gracefully skip** if the RPC is missing (`isMissing`), return 402 on cap/insufficient.
5. Model via `getModelInstance(provider, tier)` where tier is `'chat'` (cheap) or
   `'analysis'`. Prefer `'chat'` for light classification.
6. For structured output use `generateObject({ schema })` (Vercel AI SDK + zod), then
   **validate/convert server-side** — never return raw model output to the client
   (see `element-generation.ts` and `tag-suggestion.ts` sanitizers).
7. `AbortController` with a timeout, forward `request.signal`, release concurrency in
   `finally`, `Sentry.captureException(e, { tags: { route } })` in catch.

Credit costs and the `AIProviderKey`/`CreditAction` types are in `src/types/ai-types.ts`.
Provider/model registry + tiers: `src/lib/ai/provider-registry.ts` (only `chat` and
`analysis` tiers exist).

Client side: services in `src/lib/ai/*-service.ts` call the route and, on success, place
results through the store (`addCanvasElements` / `updateCanvasElement`). Keep AI-driven
changes **propose-only** where the user should confirm (tag suggestions, auto-fixes):
fetch → review UI → apply, never auto-mutate.

## The pipeline handoffs (the product's reason to exist)

Each automatic handoff is a "no other tool does this" moment. Current state:

- **Wizard → Canvas**: `framingToCanvas(project)` (`src/lib/framing-to-canvas.ts`) turns
  wizard answers into tagged containers + text, inserted on `completeWizard()` via
  `addCanvasElements`, guarded once per project by the `framingCanvasPopulated` meta flag.
- **AI → Canvas**: `/api/ai/generate-elements` + "Draft on Canvas" in the AI chat action bar.
- **AI-suggested tagging**: `/api/ai/suggest-tags` + "Suggest tags" in the Map view
  (propose-only review panel). Fills the Hypercube for hand-made canvas elements.
- **Canvas ↔ Plan**: bidirectional task/element sync (kanban + Gantt). Known hardening
  work outstanding: task↔element identity, timezone-safe date-only strings, Gantt
  virtualization.

Templates: hand-authored in `src/lib/templates.ts`; insert via `remapTemplateIds` then
`addCanvasElements`. A template = flat `CanvasElement[]`, containers first (zIndex 0),
children referencing them by `containerId` (zIndex 1), absolute coords.

## Key component locations

- Navbar `src/components/cxd/cxd-navbar.tsx` · Wizard `src/components/cxd/cxd-wizard.tsx`
- Canvas `src/components/cxd/cxd-canvas.tsx` · Element renderer `.../canvas/canvas-element.tsx`
- Map view `.../canvas/hexagon-view.tsx` (3D path is active: `USE_3D_CUBE = true` → `hypercube-3d.tsx`)
- AI chat `.../canvas/ai-chat-panel.tsx` + action bar `.../canvas/ai-action-bar.tsx`
- Plan `.../plan/plan-view.tsx`, `kanban-view.tsx` · Detail panel `.../canvas/hexagon-detail-panel.tsx`

## Working conventions

- Match surrounding style; keep comments to constraints the code can't show.
- Confirm before destructive/outward-facing actions; commit only when asked.
- After nontrivial changes, run `npm run build` (green = the real gate) and, for pure
  logic, an `__verify__` tsx script.

## Commits & Vercel (Hobby plan)

The Vercel project is on the Hobby plan, which blocks any deployment whose commit
lists a collaborator other than the account owner. A `Co-Authored-By:` trailer
counts as one, so **never add `Co-Authored-By` trailers** to commits in this repo,
and author commits as the owner's GitHub identity (`Jose <connect@cyberdelic.nexus>`).
`.claude/settings.json` disables Claude Code's automatic co-author trailer.
