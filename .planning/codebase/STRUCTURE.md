# Codebase Structure

**Analysis Date:** 2026-03-18

## Directory Layout

```
project-root/
├── src/
│   ├── app/                          # Next.js App Router pages and API routes
│   │   ├── (auth)/                  # Authentication layout group
│   │   │   ├── sign-in/
│   │   │   ├── sign-up/
│   │   │   └── forgot-password/
│   │   ├── api/                     # Server-side API endpoints
│   │   │   ├── ai/                 # AI chat, analysis, credits management
│   │   │   ├── canvas/             # Canvas collaboration APIs
│   │   │   ├── projects/           # Project CRUD operations
│   │   │   ├── stripe/             # Payment webhooks and sessions
│   │   │   ├── profile/
│   │   │   ├── link-meta/
│   │   │   ├── support/
│   │   │   └── webhooks/
│   │   ├── auth/                    # Auth callback handler
│   │   ├── cxd/                     # CXD canvas editor main page
│   │   ├── dashboard/               # Project dashboard/listing
│   │   ├── changelog/
│   │   ├── invite/                  # Invite acceptance page
│   │   ├── mobile-notice/           # Mobile device notice
│   │   ├── layout.tsx               # Root layout (ThemeProvider, TempoInit)
│   │   ├── page.tsx                 # Home/landing page redirect
│   │   ├── globals.css
│   │   └── actions.ts
│   │
│   ├── components/                   # React UI components
│   │   ├── cxd/                     # CXD-specific components
│   │   │   ├── canvas/              # Canvas view and editors (40+ components)
│   │   │   │   ├── canvas-element.tsx          # Element renderer with onUpdate stability fix
│   │   │   │   ├── canvas-toolkit.tsx          # Drawing tools and context menu
│   │   │   │   ├── line-layer.tsx             # Connector line rendering
│   │   │   │   ├── task-inbox.tsx             # Inbox for unstyled elements
│   │   │   │   ├── multi-selection-box.tsx    # Multi-select rendering
│   │   │   │   ├── experience-flow-drawer.tsx # Timeline for stages
│   │   │   │   ├── hexagon-view.tsx           # 3D hypercube view
│   │   │   │   ├── canvas-minimap.tsx         # Viewport minimap
│   │   │   │   ├── ai-chat-panel.tsx          # AI sidebar
│   │   │   │   ├── diagnostic-panel.tsx       # Design validation
│   │   │   │   ├── erd-generator.tsx          # Entity relation diagram
│   │   │   │   ├── design-overview-card.tsx   # Summary of CXD fields
│   │   │   │   ├── cxd-reference-panel.tsx    # Design templates/docs
│   │   │   │   └── (20+ more card/editor components)
│   │   │   ├── plan/                # Plan/Kanban view for stages
│   │   │   │   ├── plan-view.tsx    # Kanban board main
│   │   │   │   ├── kanban-view.tsx  # Column/card rendering
│   │   │   │   └── (task/card components)
│   │   │   ├── cxd-canvas.tsx       # Main canvas container + context menu logic
│   │   │   ├── cxd-wizard.tsx       # Framing/onboarding wizard
│   │   │   ├── cxd-focus-mode.tsx   # Section-focused editor overlay
│   │   │   ├── cxd-navbar.tsx       # Top navigation bar
│   │   │   ├── cxd-home.tsx         # Project home/empty state
│   │   │   ├── reality-planes-editor.tsx
│   │   │   ├── account-menu.tsx
│   │   │   ├── credit-topup-modal.tsx
│   │   │   ├── ai-credit-meter.tsx
│   │   │   ├── ai-model-selector.tsx
│   │   │   ├── cxd-share-summary.tsx
│   │   │   └── (more CXD-specific components)
│   │   ├── collaboration/           # Real-time collaboration UI
│   │   │   └── collaborator-cursors.tsx  # Render peer cursors/selections
│   │   ├── modals/                  # Dialog/modal components
│   │   ├── nav/                     # Navigation components (sidebar, menus)
│   │   ├── settings/                # Settings panels
│   │   ├── ui/                      # Radix UI-based base components
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── form.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── select.tsx
│   │   │   └── (20+ more Radix components)
│   │   ├── icons/                   # Custom SVG icons
│   │   ├── theme-provider.tsx       # NextThemes wrapper
│   │   ├── landing-page.tsx
│   │   └── tempo-init.tsx           # Tempo DevTools initialization
│   │
│   ├── contexts/                     # React Context providers
│   │   ├── collaboration-context.tsx # Real-time sync, presence, broadcasts
│   │   └── yjs-project-context.tsx   # Yjs Y.Doc lifecycle and bridge
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── use-cxd-store.ts         # Zustand store hook (auto-generated)
│   │   ├── use-collaboration.ts     # Collaboration state and callbacks
│   │   ├── use-yjs-sync.ts          # Yjs ↔ Zustand bridge integration
│   │   ├── use-yjs-awareness.ts     # Presence/cursor tracking
│   │   ├── use-project-sync.ts      # Auto-save and localStorage backup
│   │   ├── use-ai-chat.ts           # AI chat API integration
│   │   ├── use-ai-credits.ts        # Credit balance and usage
│   │   ├── use-canvas-settings.ts   # Canvas zoom/pan persistence
│   │   ├── use-plan-tasks.ts        # Kanban board operations
│   │   ├── use-subscription.ts      # User subscription status
│   │   ├── use-notifications.ts     # Toast notifications
│   │   ├── use-toast.ts             # Sonner toast hook
│   │   └── use-mobile.tsx           # Mobile device detection
│   │
│   ├── store/                        # Zustand state management
│   │   └── cxd-store.ts             # Main store (26k+ lines, split into sections)
│   │       ├── ViewMode state (wizard, canvas, focus, share)
│   │       ├── Project state (currentProjectId, projects array)
│   │       ├── Canvas state (zoom, pan, activeBoardId, boardPath)
│   │       ├── Viewport persistence (per-canvas zoom/pan)
│   │       ├── Canvas element actions (add, update, remove, duplicate, group/ungroup)
│   │       ├── Canvas edge actions (add, update, remove)
│   │       ├── CXD design field actions (sensory domains, presence types, reality planes, state/trait mapping)
│   │       ├── Intention core actions (projectName, mainConcept, coreMessage)
│   │       ├── Desired change actions (insights, feelings, states, knowledge)
│   │       ├── Human context actions (audience needs/desires, user role)
│   │       ├── Context & meaning actions (world, story, magic)
│   │       ├── Experience flow actions (stages, narrative, intent)
│   │       ├── Yjs integration (yDoc reference, Yjs-aware selectors)
│   │       └── Selectors (getCurrentProject, getCanvasElements, getCanvasEdges, etc.)
│   │
│   ├── lib/                          # Utility libraries and services
│   │   ├── yjs/                     # Yjs CRDT integration
│   │   │   ├── y-doc-factory.ts     # Create and initialize Y.Doc for projects
│   │   │   ├── y-doc-types.ts       # Yjs type definitions (Y.Map, Y.Array)
│   │   │   ├── y-zustand-bridge.ts  # Bidirectional sync Zustand ↔ Y.Doc
│   │   │   ├── yjs-store-actions.ts # Yjs transaction wrappers for store actions
│   │   │   ├── yjs-version-actions.ts # Version/OKR CRDT operations
│   │   │   ├── element-serializers.ts # Serialize/deserialize canvas elements to Y.Map
│   │   │   ├── encoding-utils.ts    # Binary encoding helpers
│   │   │   ├── indexeddb-persistence.ts # Local Y.Doc persistence
│   │   │   ├── supabase-persistence.ts # Remote Y.Doc persistence (Supabase)
│   │   │   ├── supabase-yjs-provider.ts # Awareness and sync provider
│   │   │   ├── awareness-provider.ts    # Cursor/selection tracking
│   │   │   ├── undo-manager.ts     # Canvas and design undo/redo
│   │   │   └── y-text-helpers.ts   # Text operation helpers
│   │   ├── ai/                     # AI integration
│   │   │   ├── ai-credits-config.ts # Credit costs and tiers
│   │   │   ├── ai-providers.ts     # Multi-provider SDK setup
│   │   │   └── (AI service integrations)
│   │   ├── supabase-projects.ts     # Project CRUD operations
│   │   ├── user-profile.ts          # User profile queries
│   │   ├── stripe.ts                # Stripe setup and helpers
│   │   ├── plans.ts                 # Subscription tier definitions
│   │   ├── credit-packs.ts          # Credit purchase options
│   │   ├── notifications.ts         # Email notification templates
│   │   ├── email.ts                 # Resend email service
│   │   ├── encryption.ts            # Data encryption utilities
│   │   ├── document-export.ts       # PDF/DOCX export
│   │   ├── display-utils.ts         # Formatting (dates, numbers, etc.)
│   │   ├── utils.ts                 # Core utilities (extractCenterColor, hexToRgba, etc.)
│   │   └── fix-duplicate-stage-ids.ts
│   │
│   ├── supabase/                     # Supabase SDK setup
│   │   ├── server.ts                # Server-side client with Auth headers
│   │   ├── client.ts                # Client-side client with cookies
│   │   └── middleware.ts            # Route protection middleware
│   │
│   ├── types/                        # TypeScript domain types
│   │   ├── cxd-schema.ts            # CXD design model (Reality Planes, Sensory Domains, etc.)
│   │   ├── canvas-elements.ts       # Canvas element and edge types + constants
│   │   ├── version-types.ts         # Version, OKR, KeyResult, Objective
│   │   ├── plan-types.ts            # Kanban plan types
│   │   ├── ai-types.ts              # AI chat and credit types
│   │   ├── supabase.ts              # Database row types (auto-generated from schema)
│   │   └── diagnostics.ts           # Validation diagnostics
│   │
│   ├── utils/                        # Utility functions
│   │   ├── __tests__/               # Jest test files
│   │   ├── __verify__/              # Type verification scripts
│   │   └── (utility functions organized by domain)
│   │
│   └── data/                         # Static data and fixtures
│       └── (demo projects, templates, constants)
│
├── emails/                           # React Email templates
│   ├── _components/                 # Email component library
│   └── (individual email templates)
│
├── public/                           # Static assets
│   └── images/
│
├── docs/                             # Documentation
│
├── .planning/                        # GSD planning documents
│   └── codebase/                    # Generated by /gsd:map-codebase
│
├── .vscode/                          # VS Code settings
├── .env.local                        # Local environment variables
├── .env.example                      # Example env vars
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
└── README.md
```

## Directory Purposes

**src/app/**
- Purpose: Next.js App Router pages and API routes
- Contains: Page components (.tsx), API handlers (route.ts), layout definitions
- Key files: `cxd/page.tsx` (main editor), `api/projects/route.ts` (project APIs)

**src/components/cxd/**
- Purpose: CXD Canvas application UI components
- Contains: View containers (Canvas, Wizard, HexagonView, PlanView), editors, toolbars, panels
- Key files: `cxd-canvas.tsx` (main container), `canvas/canvas-element.tsx` (element renderer), `canvas/canvas-toolkit.tsx` (tools)

**src/components/ui/**
- Purpose: Base UI primitives wrapping Radix UI
- Contains: Re-exports of Radix UI components with custom styling
- Key files: `button.tsx`, `dialog.tsx`, `input.tsx` (follow shadcn/ui pattern)

**src/store/**
- Purpose: Central Zustand state management
- Contains: Single large store file with all state, actions, and selectors
- Key files: `cxd-store.ts` (26k+ lines organized into logical sections)

**src/contexts/**
- Purpose: React Context providers for dependency injection
- Contains: CollaborationContext (peer sync and presence), YjsProjectContext (Y.Doc lifecycle)
- Key files: Used to wrap subtrees in `cxd/page.tsx`

**src/lib/yjs/**
- Purpose: Yjs CRDT integration and persistence
- Contains: Y.Doc factory, bridge to Zustand, serializers, persistence backends, undo/redo
- Key files: `y-zustand-bridge.ts` (bidirectional sync), `supabase-persistence.ts` (remote sync)

**src/lib/ai/**
- Purpose: AI provider integration and credit management
- Contains: SDK configuration for OpenAI/Anthropic/Google, credit cost definitions
- Key files: `ai-credits-config.ts`, provider setup files

**src/supabase/**
- Purpose: Supabase SDK initialization
- Contains: Server and client SDK setup with auth headers
- Key files: `server.ts`, `client.ts`, `middleware.ts`

**src/types/**
- Purpose: TypeScript domain models
- Contains: CXD design schema, canvas element types, API response types
- Key files: `cxd-schema.ts` (core design model), `canvas-elements.ts` (drawable types)

**src/hooks/**
- Purpose: Reusable React hooks
- Contains: Store access hooks, collaboration hooks, API integration hooks
- Key files: `use-collaboration.ts`, `use-yjs-sync.ts`, `use-project-sync.ts`

**src/utils/**
- Purpose: Utility functions shared across components
- Contains: Formatting, color conversion, sorting, filtering helpers
- Key files: Located in subdirectories organized by domain

**emails/**
- Purpose: React Email templates
- Contains: Email component compositions using React Email
- Key files: Rendered by Resend service for transactional emails

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout with ThemeProvider and TempoInit
- `src/app/page.tsx`: Home page (redirects to dashboard or landing)
- `src/app/cxd/page.tsx`: CXD Canvas editor (main application)
- `src/app/dashboard/page.tsx`: Project listing and dashboard

**Configuration:**
- `src/store/cxd-store.ts`: Central state store (26k lines)
- `src/contexts/collaboration-context.tsx`: Real-time sync setup
- `src/contexts/yjs-project-context.tsx`: Yjs Y.Doc initialization
- `tailwind.config.ts`: Tailwind CSS customization
- `next.config.js`: Next.js build configuration

**Core Logic:**
- `src/lib/yjs/y-zustand-bridge.ts`: Yjs ↔ Zustand synchronization engine
- `src/lib/supabase-projects.ts`: Project persistence operations
- `src/lib/yjs/supabase-persistence.ts`: Remote Y.Doc sync via Supabase
- `src/components/cxd/canvas/canvas-element.tsx`: Individual element renderer

**Testing/Verification:**
- `src/utils/__tests__/`: Jest test files
- `src/utils/__verify__/`: Type verification scripts

## Naming Conventions

**Files:**
- Components: `PascalCase.tsx` (e.g., `CXDCanvas.tsx`, `CanvasElement.tsx`)
- Utilities: `kebab-case.ts` (e.g., `use-collaboration.ts`, `supabase-projects.ts`)
- Types/Schemas: `kebab-case.ts` (e.g., `canvas-elements.ts`, `cxd-schema.ts`)
- API Routes: `route.ts` in nested directory per endpoint (e.g., `src/app/api/projects/route.ts`)

**Directories:**
- Feature containers: kebab-case (e.g., `canvas/`, `plan/`, `collaboration/`)
- Type collections: kebab-case (e.g., `src/types/`, `src/hooks/`)
- Utilities: kebab-case (e.g., `src/lib/yjs/`, `src/lib/ai/`)

**React Components:**
- Container components (manage state): verb + noun, e.g., `CXDCanvas`, `TaskInbox`, `ExperienceFlowDrawer`
- Presentational components (UI only): noun/adjective, e.g., `Card`, `Button`, `CollaboratorCursors`
- Custom hooks: `use` + functionality, e.g., `useCollaboration`, `useYjsSync`, `useProjectSync`

**Zustand Store:**
- State properties: camelCase, e.g., `viewMode`, `currentProjectId`, `activeBoardId`
- Actions: verb + noun, e.g., `setViewMode`, `addCanvasElement`, `updateStateMapping`
- Selectors: `get` + noun or `getBy` + criteria, e.g., `getCurrentProject`, `getCanvasElements`

**Types:**
- Domain models: PascalCase + suffix, e.g., `CXDProject`, `CanvasElement`, `CanvasEdge`
- Enums: PascalCase or `CONSTANT_CASE` for const enums, e.g., `ViewMode`, `CanvasElementType`
- Type aliases: PascalCase, e.g., `SurfaceType`, `HypercubeFaceTag`

## Where to Add New Code

**New Feature (Canvas or Design Editor):**
- Primary code: `src/components/cxd/` (new component file or subdir if complex)
- Store actions: `src/store/cxd-store.ts` (add action creators at bottom)
- Types: `src/types/cxd-schema.ts` or `canvas-elements.ts` if domain-related
- Hooks: `src/hooks/use-feature-name.ts` if custom hook needed
- Tests: `src/utils/__tests__/feature.test.ts`

**New Canvas Element Type:**
- Define type in: `src/types/canvas-elements.ts` (add to `CanvasElementType` union)
- Renderer: `src/components/cxd/canvas/canvas-element.tsx` (add render logic)
- Store actions: `src/store/cxd-store.ts` (add element creation/update if special logic)
- Editor panel: `src/components/cxd/canvas/[ElementType]-editor.tsx` (new file)
- Serializers (if using Yjs): `src/lib/yjs/element-serializers.ts`

**New API Endpoint:**
- Location: `src/app/api/[domain]/[resource]/route.ts` (follow existing structure)
- Pattern: Create directory matching domain (e.g., `/api/ai/`, `/api/canvas/`)
- Authentication: Use `createClient()` from `src/supabase/server.ts`
- Response: Return `NextResponse` with `.json()` data
- Error handling: Wrap in try-catch, return 5xx for server errors, 4xx for client errors

**New Hook:**
- Location: `src/hooks/use-[feature-name].ts`
- Pattern: Export single named hook with dependencies clearly defined
- Use: Call Zustand store selectors and actions, or use context hooks
- No side effects: Use useEffect for async operations

**New Utility Function:**
- Location: `src/lib/` subdirectories by domain (e.g., `src/lib/yjs/`, `src/lib/ai/`)
- Pattern: Pure functions preferred; document with JSDoc if complex
- Testing: Add tests to `src/utils/__tests__/`

**New Database Integration:**
- Location: `src/lib/supabase-[feature].ts`
- Pattern: Export CRUD functions, use `createClient()` for queries
- Types: Define result types in `src/types/supabase.ts`

**Styles:**
- Tailwind classes inline in JSX: Preferred for component styling
- CSS modules: `src/components/[component-name].module.css` if complex styling
- Global CSS: `src/app/globals.css` for app-wide styles
- Theme: Use Tailwind config for colors, spacing, etc.; avoid hardcoded values

## Special Directories

**src/lib/yjs/**
- Purpose: Yjs CRDT integration layer
- Generated: No (hand-written)
- Committed: Yes
- Special: Handles bidirectional sync between Zustand and Y.Doc; enables multi-user collaboration

**.next/**
- Purpose: Next.js build output
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)

**node_modules/**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in .gitignore)

**public/**
- Purpose: Static assets served directly
- Generated: No (hand-written or copied)
- Committed: Yes

**src/utils/__verify__/**
- Purpose: Type verification scripts (run TypeScript compiler to verify patterns)
- Generated: No (hand-written)
- Committed: Yes

---

*Structure analysis: 2026-03-18*
