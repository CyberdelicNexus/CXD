# Architecture

**Analysis Date:** 2026-03-18

## Pattern Overview

**Overall:** Multi-view design canvas with Zustand-based state management, Yjs CRDT for real-time collaboration, and modular component layers for canvas visualization.

**Key Characteristics:**
- Client-side state machine (ViewMode + CanvasViewMode) drives UI rendering
- Zustand store (`cxd-store.ts`) as single source of truth for project, canvas, and CXD design data
- Yjs CRDT integration for collaborative editing with optional feature flag (NEXT_PUBLIC_USE_YJS_CRDT)
- Lazy-loaded view components (Wizard, Canvas, Hexagon, Plan) with dynamic imports
- Separation of surface contexts: "canvas" (2D freeform moodboard) vs "hypercube" (semantic 3D structure)
- Context providers for collaboration and Yjs lifecycle management

## Layers

**Presentation Layer:**
- Purpose: UI components for canvas editing, navigation, and modals
- Location: `src/components/cxd/` (main views), `src/components/ui/` (base primitives)
- Contains: React components using Radix UI primitives, canvas renderers, form inputs
- Depends on: Zustand store hooks, Collaboration context, CXD schema types
- Used by: Next.js page routes (`src/app/cxd/page.tsx`)

**State Management Layer:**
- Purpose: Centralized application state with selectors and actions
- Location: `src/store/cxd-store.ts`
- Contains: Zustand store with persist middleware, action creators for canvas/CXD updates
- Depends on: Zustand library, Yjs library, types (`cxd-schema.ts`, `canvas-elements.ts`, `version-types.ts`)
- Used by: All React components via hooks, Yjs bridge for sync

**Collaboration Layer:**
- Purpose: Real-time user presence, cursor tracking, and state synchronization
- Location: `src/contexts/collaboration-context.tsx`, `src/hooks/use-collaboration.ts`
- Contains: Collaboration context provider, presence/cursor API, sync methods
- Depends on: Zustand selectors, Yjs awareness instances
- Used by: View components for broadcasting updates, presence rendering

**CRDT/Sync Layer:**
- Purpose: Yjs document lifecycle, persistence, and bidirectional store binding
- Location: `src/lib/yjs/` (y-doc-factory.ts, y-zustand-bridge.ts, supabase-persistence.ts, indexeddb-persistence.ts)
- Contains: Y.Doc initialization, element/edge serialization, undo/redo managers, persistence backends
- Depends on: Yjs library, Supabase client, IndexedDB
- Used by: YjsProjectProvider context, store actions for remote sync

**Data Access Layer:**
- Purpose: API handlers and database queries
- Location: `src/app/api/` (Next.js route handlers), `src/lib/supabase-projects.ts`
- Contains: Server-side API routes for projects/collaboration/AI, Supabase queries, authentication
- Depends on: Supabase client, AI SDKs, Stripe SDK
- Used by: Client-side hooks for data fetching, server actions

**Type Layer:**
- Purpose: Domain models and type definitions
- Location: `src/types/`
- Contains: CXD design schema, canvas element types, version/OKR types, AI types
- Depends on: None
- Used by: All layers for type safety

## Data Flow

**View Mode Selection:**

1. User interacts with navbar or menu (CXDNavbar.tsx)
2. Store action `setViewMode()` or `setCanvasViewMode()` updates state
3. Page component (cxd/page.tsx) re-renders based on `viewMode` and `canvasViewMode` selectors
4. Appropriate view component lazy-loads (CXDWizard, CXDCanvas, HexagonView, PlanView, CXDFocusMode)
5. Viewport position restored from `viewportByCanvasId[canvasId]` if switching back to previously viewed canvas

**Canvas Element Creation/Update:**

1. Canvas component user interacts with canvas (click, drag, type)
2. Handler calls `addCanvasElement()`, `updateCanvasElement()`, or `removeCanvasElement()` from store
3. Store updates in-memory arrays: `project.canvasLayout.elements` and `.edges`
4. If Yjs enabled: Yjs bridge listens to store mutations → broadcasts to Y.Doc shared types
5. Zustand subscribers re-render affected components (CanvasElementRenderer, LineLayer)
6. Collaboration context detects change → broadcasts CanvasUpdate to remote peers (if connected)
7. Auto-sync hook periodically saves project to Supabase (debounced)

**Project Sync Flow (Multi-tab/Reload):**

1. Page load: `useProjectSync()` hook sets up storage listeners
2. Zustand hydrates from localStorage (persist middleware)
3. Effect in cxd/page.tsx: if `currentProjectId` exists but `projects.length === 0`, fetch from Supabase
4. Checks for localStorage backup (updated within last hour)
5. If backup newer than database: restores backup, saves to database, clears backup
6. Else: uses fetched database projects
7. On unload: project auto-saved to localStorage backup by `useProjectSync()` hook

**Real-Time Collaboration (Yjs-enabled):**

1. Multiple users open same project → YjsProjectProvider initializes Y.Doc for project
2. Supabase persistence provider connects Y.Doc to `cxd_yjs_state` table
3. Local changes: Zustand action → Yjs bridge applies transaction to Y.Doc → broadcasts to other clients via Supabase
4. Remote changes: Supabase provider receives update → applies to Y.Doc → Yjs bridge syncs back to Zustand
5. Awareness instance tracks cursor/selection per user in real-time
6. CollaboratorCursors component renders presence indicators

**State Mapping Update (CXD Design Field):**

1. User edits state mapping input in Reality Planes editor
2. Calls `updateStateMapping(code, value)` from store
3. Store updates `project.canvasLayout.designData.stateMapping[code]`
4. Collaboration broadcasts CanvasUpdate with type='field_update'
5. Remote peer receives via CollaborationProvider → calls same `updateStateMapping()` action
6. If Yjs enabled: bridge syncs to Y.Doc and persists

**Freeform Card Editing (TextCard Component):**

1. User clicks text inside FreeformCard to edit content
2. Component calls `onUpdate({ content: newContent })` callback from CanvasElementRenderer
3. Callback triggers `syncUpdateElement(elementId, updates)` from collaboration context
4. Collaboration broadcasts type='element_update' with changes
5. Store action `updateCanvasElement()` applies changes to `project.canvasLayout.elements[id]`
6. CanvasElementRenderer re-renders with new content

**State Machine (View Navigation):**

```
home → dashboard/project selection
  ↓
canvas → wizard (framing flow)
  ↓ (or switch via navbar)
canvas → hexagon (hypercube 3D view)
  ↓ (or switch)
canvas → plan (kanban board for experience flow stages)
  ↓ (or switch)
focus (section-specific editor) ↔ (back to canvas)
```

## Key Abstractions

**CXDProject:**
- Purpose: Root domain model representing a design canvas
- Files: `src/types/cxd-schema.ts`, store actions, database schema
- Pattern: Nested structure containing `canvasLayout` (canvas elements/edges), `intentionCore` (project metadata), design sections (reality planes, sensory domains, state mapping, etc.)
- Usage: Passed to views as props via store selectors

**CanvasElement & CanvasEdge:**
- Purpose: Represent drawable objects and connections on the canvas
- Files: `src/types/canvas-elements.ts`, store element array, Yjs serializers
- Pattern: Union types with type discriminators (freeform, image, shape, text, etc.), each with unique `design` properties
- Usage: Iterated in LineLayer (edges rendered first), then CanvasElementRenderer (elements on top)

**ViewMode State Machine:**
- Purpose: Determine which UI surface to display
- Files: Store state, cxd/page.tsx lazy-loaded views
- Pattern: Type-safe enum ('home' | 'wizard' | 'canvas' | 'focus' | 'share')
- Usage: Conditionally render CXDWizard vs CXDCanvas vs CXDFocusMode in page component

**Viewport Persistence:**
- Purpose: Remember pan/zoom per canvas context (root canvas vs boards)
- Files: `viewportByCanvasId` in store state, called on canvas switch
- Pattern: Record<canvasId, Viewport> with restore/save actions
- Usage: Prevents camera jump when switching between nested boards or view modes

**Design Sections (Reality Planes, Sensory Domains, etc.):**
- Purpose: Organize CXD design metadata into logical groups
- Files: `CXD_SECTIONS` in `cxd-schema.ts`, cards rendered on canvas
- Pattern: Each section has an ID, title, visual representation as a draggable card
- Usage: Experience inspector displays all sections as collapsible panels, canvas positions them spatially

**Inbox System:**
- Purpose: Temporary staging area for elements awaiting placement on canvas
- Files: Store state `inInbox` boolean on elements, `TaskInbox` component
- Pattern: Elements in inbox have `inInbox: true`, dragged from inbox to canvas to set false
- Usage: Alternative creation flow for bulk element import

## Entry Points

**Web (Application):**
- Location: `src/app/cxd/page.tsx`
- Triggers: Navigation to `/cxd` route (after authentication)
- Responsibilities:
  - Initialize Zustand store and restore from localStorage
  - Restore user's projects from Supabase on first load
  - Set up Yjs and collaboration providers
  - Route to correct view based on viewMode/canvasViewMode state
  - Handle credit topup success redirect from Stripe

**API Routes (Backend):**
- Projects API: `src/app/api/projects/route.ts` - GET user projects (owned + collaborative)
- Canvas API: `src/app/api/canvas/collaborators/route.ts` - Fetch canvas collaborators
- Collaboration: `src/app/api/canvas/invite/route.ts` - Send invites, `accept/route.ts` - Accept invite
- AI APIs: `src/app/api/ai/chat/route.ts`, `analyze/route.ts`, `credits/route.ts`
- Stripe: `src/app/api/stripe/` - Payment webhooks and checkout sessions
- Auth: `src/app/auth/callback/route.ts` - OAuth callback handler

**Server Actions:**
- Location: `src/app/actions.ts`
- Used for: Server-side operations triggered from client without explicit fetch

## Error Handling

**Strategy:** Layered error handling with fallbacks

**Patterns:**

1. **API Errors:** Try-catch in route handlers, return NextResponse with error code + message
   - Example: `src/app/api/projects/route.ts` catches Supabase errors, returns 500 with error details
   - Client: useQuery/useMutation hooks catch and surface to Collaboration context

2. **Store Mutations:** Direct mutation in Zustand; errors thrown from Yjs operations caught by bridge
   - Bridge has try-catch wrapping Y.Doc transactions → logs to console, continues
   - Retries not automatic; manual sync via useProjectSync

3. **Async Operations:** useEffect cleanup functions prevent state updates on unmounted components
   - Example: cxd/page.tsx restoreProjectState sets isRestoring flag with timeout failsafe

4. **Validation:** Zod schemas in `src/types/` for type inference; API routes validate request body before querying

## Cross-Cutting Concerns

**Logging:**
- Console.log prefixed with `[Collab]`, `[CXD]`, `[Yjs]` for easy filtering in DevTools
- No centralized logger; consider Winston/Pino if log volume grows

**Validation:**
- Zod for input validation in API routes
- No client-side form validation; fields accept any input and sync immediately
- Type safety via TypeScript for canvas element shapes

**Authentication:**
- Supabase Auth (OAuth + email/password)
- Middleware in `src/supabase/middleware.ts` protects `/cxd` routes
- Session managed via Supabase cookies; server/client clients created in `src/supabase/server.ts` and `client.ts`

**Rate Limiting:**
- Not implemented at application level; Supabase provides RLS and API rate limiting
- Stripe webhooks trusted via signature verification in `src/app/api/webhooks/stripe/route.ts`

**Observability:**
- Tempo DevTools integrated (`TempoInit` component in root layout)
- Error tracking: No centralized service (consider Sentry)
- Monitoring: Supabase provides query logs and database metrics

---

*Architecture analysis: 2026-03-18*
