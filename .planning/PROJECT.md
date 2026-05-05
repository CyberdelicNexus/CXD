# CXD Canvas

## What This Is

CXD Canvas is a collaborative experience design tool for teams — a multi-view canvas where designers and strategists map out user journeys, service blueprints, and experience flows. It combines a freeform 2D canvas, a semantic hypercube map, a kanban plan view, and a framing wizard, all backed by real-time collaboration and an AI assistant. The product is approaching public soft launch.

## Core Value

Teams should never lose their work — every change by every collaborator must be saved reliably.

## Requirements

### Validated

- ✓ Multi-view canvas: Canvas (2D freeform), Map (Hypercube), Plan (Kanban), Framing (Wizard) — existing
- ✓ Canvas elements: cards, text, images, containers, connectors, inbox — existing
- ✓ Real-time collaboration via Yjs CRDT — existing
- ✓ Auth, user management, and project ownership via Supabase — existing
- ✓ AI assistant with chat, analysis, and credit system — existing
- ✓ Stripe billing and subscriptions — existing
- ✓ Canvas operations: zoom to cursor, pan, select, multi-select, copy/paste — existing
- ✓ Export: PDF, DOCX — existing
- ✓ Project sharing and collaborator invites — existing
- ✓ Vercel deployment pipeline — existing

### Active

- [ ] Collaborator changes are saved reliably (owner and collaborator roles both persist)
- [ ] No progress is lost on network interruption or page reload for any user role
- [ ] Playwright stress tests cover critical user flows end-to-end
- [ ] Known bugs surfaced by testing are fixed before launch
- [ ] Templates tab with blank structure scaffolds for new users
- [ ] Connectors visually refined: lines touch element edges, always render above elements
- [ ] Connected elements automatically inherit parent element tags (AI association)
- [ ] Auto-organize button: spread selected elements in a grid layout on the canvas
- [ ] Auto-connect shortcut (cmd+L) connects selected elements with lines
- [ ] Right-click menu option to connect selected objects
- [ ] Canvas comments: users can leave comments pinned to canvas positions
- [ ] Comment replies: users can reply to existing comments
- [ ] Landing page visual assets: gifs, video, or 3D scroll animation explaining the tool

### Out of Scope

- Drawing/freehand annotation — deferred post-launch (comments are higher priority)
- Full node-based logic (conditional connections, input/output graph) — visual + tag propagation is v1 scope; full logic engine is future
- Mobile app — web-first

## Context

- **Architecture**: Next.js 14 App Router, Zustand store + Yjs CRDT bridge, Supabase persistence, Vercel deployment
- **Save bug root cause (suspected)**: Yjs CRDT syncs between collaborators but the Supabase persistence layer may not be flushing collaborator-originated changes — needs investigation in `src/lib/yjs/supabase-persistence.ts` and the Yjs-Zustand bridge
- **Connectors today**: Lines exist but don't reliably stay above elements in z-order and don't snap to element edges — feels janky
- **Target users**: Public soft launch — any user who signs up
- **Timeline**: Imminent (days/weeks)
- **Workshop happening now**: Students are using the tool in a live demo today

## Constraints

- **Tech stack**: Next.js 14, TypeScript, Zustand, Yjs, Supabase, Tailwind, Radix UI — no stack changes
- **Timeline**: Imminent soft launch — scope must be tight, quality over features
- **Deployment**: Vercel — all changes must pass `npm run build` before push
- **Collaboration**: Yjs CRDT is the sync layer — any save fix must work within this architecture

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix save bug before any new features | Users losing work is a launch-blocking trust issue | — Pending |
| Playwright for stress testing | Already in pipeline; surfaces real bugs before real users do | — Pending |
| Templates as blank scaffolds (not curated examples) | Faster to build; gives users structure without prescribing content | — Pending |
| Connector v1 = visual refinement + tag propagation | Full node logic is complex; nail the feel first | — Pending |
| Comments before drawing/annotation | More collaborative utility for the launch audience | — Pending |

---
*Last updated: 2026-03-18 after initialization*
