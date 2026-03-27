# CXD Production Readiness — Design Specification

This document covers all features, bug fixes, and hardening work planned for the CXD production release. It is organized into 7 independent work streams that can be planned and executed separately.

---

## 1. Comments System (Figma-style)

### Goal
Add a commenting system where users can click anywhere on the canvas to leave a comment, reply to existing comments, and resolve comment threads — similar to Figma's commenting UX.

### Architecture
- **Comment data model**: Comments stored as a new data structure in the project schema (not as canvas elements). Each comment has: `id`, `authorId`, `authorName`, `content`, `position: {x, y}`, `boardId` (which board/canvas it belongs to), `createdAt`, `resolvedAt`, `parentId` (for replies).
- **Comment thread**: A top-level comment plus all replies sharing the same `parentId`. Resolving marks the entire thread as resolved.
- **Storage**: Comments array on the project, synced via Yjs for real-time collaboration.
- **UI components**:
  - `CommentPin` — small numbered avatar circle rendered at the comment's canvas position. Unresolved pins are visible by default, resolved pins are hidden unless "Show resolved" is toggled.
  - `CommentThread` — floating panel that opens when a pin is clicked, showing the original comment and replies with a reply input.
  - `CommentModeToggle` — button in the toolbar to enter/exit "comment mode" (cursor changes to comment icon, click to place a new comment).
- **Interaction flow**:
  1. User clicks the comment mode toggle in the toolbar
  2. Cursor changes to a comment crosshair
  3. User clicks on the canvas to place a comment pin
  4. A text input appears at that position for the user to type their comment
  5. After submitting, a numbered pin appears at that location
  6. Clicking a pin opens the thread panel with replies
  7. The resolve button marks the thread as resolved and fades/hides the pin
  8. Exiting comment mode returns to normal canvas interaction

### Scope
- Canvas-only (not on Map or Plan tabs)
- Comments are per-board (nested boards have their own comments)
- No @mentions or notifications in v1 — just the comment, reply, resolve flow
- Comments persist across sessions via Yjs sync

---

## 2. Onboarding Tooltip Tour

### Goal
Guided tooltip tour that introduces new users to the Canvas, Map, and Plan tabs after completing the Framing wizard. Highlights key UI elements with sequential tooltips.

### Architecture
- **Custom implementation** (~300 LOC) — no external library. React portal-based tooltip with Zustand state management.
- **Components**:
  - `TourProvider` — context provider managing tour state (active tour, current step, completion flags)
  - `TourTooltip` — floating tooltip with arrow, positioned relative to target elements found via `data-tour-id` attributes
  - `TourHighlight` — full-page overlay (`rgba(0,0,0,0.6)`) with transparent cutout around the target element
- **Target identification**: UI elements get `data-tour-id` attributes (e.g., `data-tour-id="canvas-toolkit"`). The tour finds targets via `document.querySelector('[data-tour-id="..."]')` and uses `getBoundingClientRect()` for positioning.
- **Tour trigger**: After Framing wizard completes and user navigates to a tab, check `tourCompleted.{tab}`. If `false`, auto-start after 1-second delay.
- **Persistence**: `tourCompleted: { canvas: boolean, map: boolean, plan: boolean }` stored in project data via Zustand/Yjs.
- **Replay**: Available from a help icon in the navbar.

### Visual Style
- Dark background tooltip (`#1a1a2e`) with subtle purple border (`rgba(139, 92, 246, 0.3)`)
- Soft purple glow on the spotlight cutout
- Small arrow/caret pointing at target
- Max width ~320px, Inter font
- Controls: "Next" button (purple accent), "Back" (from step 2+), "Skip tour" link, step indicator dots
- Smooth 300ms CSS transition when moving between targets

### Behavior
- Click outside tooltip = no action
- Escape = skip tour
- Target element remains interactive during its step
- If target is not visible (panel closed), tour auto-opens/scrolls to reveal it

### Canvas Tour (9 steps)
1. **Toolkit bar** — "This is your toolkit. Click any tool to add elements to your canvas — cards, text, images, shapes, containers, and more."
2. **Canvas element** — "Drag to move, grab corners to resize, right-click for more options. Double-click cards to edit their content."
3. **Inbox area** — "Your inbox holds elements waiting to be placed. Drag them onto the canvas when you're ready to use them."
4. **Connector port on element** — "Drag from a connector port to another element to create connections. A menu appears to choose the connection type."
5. **Board element/tool** — "Create nested boards to organize complex projects. Double-click a board to dive inside it."
6. **Right sidebar (experience elements)** — "Drag experience elements from here onto the canvas, or click them to view details about each experience stage."
7. **Experience flow tab (bottom drawer)** — "Map the stages of your experience here. This timeline shows how your experience flows from start to finish."
8. **Collaborate button** — "Invite teammates to work on this canvas together in real-time."
9. **Keyboard shortcuts button** — "View all keyboard shortcuts and navigation controls here."

### Map Tour (5 steps)
1. **Face selector menu** — "Select a face of the Hypercube to explore. Each face represents a different dimension of your experience."
2. **System Insights panel** — "This panel shows AI-generated insights about the current face based on the elements you've tagged on your canvas."
3. **Chat bot panel** — "Ask the AI questions about your experience design. The more elements you tag on the canvas, the richer context the AI has to work with."
4. **Cyberdelic wizard tab** — "The Cyberdelic wizard guides you through deeper experience design patterns and frameworks."
5. **ERD button** — "When you're ready, generate an Experience Requirements Document — a complete presentation of your canvas work to share with stakeholders."

### Plan Tour (7 steps)
1. **Roadmap view tab** — "Start here. Create a version roadmap to organize your project into milestones and releases."
2. **Kanban view → Add task** — "Add tasks to track your work. Drag cards between columns to update their status."
3. **Task detail panel** — "Click any task to see its full details — assign people, set dates, add descriptions, and manage subtasks."
4. **Table view tab** — "View all your tasks in a structured table format for quick scanning and bulk editing."
5. **Timeline view tab** — "Place tasks on a timeline, drag to adjust duration, and connect dependencies between tasks."
6. **Calendar view tab** — "View tasks in month, week, or day views. In week view, drag tasks to time-block your schedule."
7. **Archive view tab** — "Completed tasks can be archived here. Review past work or restore tasks when needed."

---

## 3. Templates Overhaul

### Goal
Replace the current 3 bare-container templates with 8 richly structured templates that include prompt cards, example content, and visual organization to help users start projects with clear frameworks.

### Template Categories & Definitions

#### Experience Design

**1. Experience Journey** (improved User Journey)
- 5 horizontal containers: Awareness, Consideration, Engagement, Experience, Reflection
- Prompt cards inside each: touchpoint prompts, emotion prompts, sensory element prompts
- Example content in the Engagement container showing what a filled-in stage looks like

**2. Immersive Experience Canvas**
- Zones: Concept (top-center), Audience (left), Sensory Domains (right), Spatial Layout (bottom-left), Narrative Arc (bottom-right)
- Prompt cards: "What is the core concept?", "Who is your audience and what do they bring?", "What senses are engaged and how?"
- Example content in Concept zone

**3. Event Blueprint**
- 3 horizontal timeline sections: Pre-Production, Live Experience, Post-Experience
- Each section has sub-containers for tasks, logistics, and experience moments
- Prompt cards for key decisions in each phase

#### Product & Brand

**4. Product Canvas**
- Grid layout: Problem (top-left), Solution (top-right), Audience (mid-left), Value Proposition (center), Channels (mid-right), Metrics (bottom)
- Prompt cards with questions: "What problem are you solving?", "What does success look like?"
- Example content in Value Proposition

**5. Brand Experience Map**
- Sections: Brand Values (top), Touchpoints (middle row of containers), Emotional Journey (bottom-left), Visual Identity (bottom-right)
- Prompt cards: "What are your 3-5 core brand values?", "Where does the audience interact with your brand?"

#### Creative & General

**6. Mood Board**
- Pre-laid zones: Visual Inspiration (large, top), Color Palette (left), Typography (center), References (right), Notes (bottom)
- Prompt cards: "Collect images that capture the feeling", "Define 3-5 colors that represent the mood"
- Styled containers with appropriate sizing for visual content

**7. Workshop Canvas** (improved existing)
- Sections: Objective (top), Participants (top-right), Activity 1-3 (middle row), Outcomes (bottom)
- Facilitator prompt cards: "What should participants walk away with?", "Time-box each activity"
- Example content in Activity 1 showing a filled-in workshop activity

**8. Brainstorm Board**
- Two main zones: Diverge (large open space, left 2/3) and Converge (right 1/3 with prioritization grid)
- Action Items container at the bottom
- Prompt cards: "Generate as many ideas as possible — no judgment", "Which ideas are most feasible AND impactful?"

### Template Element Structure
- All prompt/example content uses **freeform cards (note type)** — no new element types
- Prompt cards have placeholder text that users overwrite with their own content
- Example cards are clearly labeled as examples (e.g., title starts with "Example:")
- Containers use tint colors to visually distinguish sections

### Template Surfaces (3 access points)
1. **In-canvas modal** (`template-picker-modal.tsx`) — upgraded with preview thumbnails organized by category (Experience Design, Product & Brand, Creative & General)
2. **Dashboard bottom section** (~line 927 in `dashboard-content.tsx`) — updated template cards showing all 8 templates with better previews
3. **Dashboard navbar template button** — opens a full gallery page for browsing templates with larger previews, descriptions, and category filtering

### Template Data
- Templates defined in `src/lib/templates.ts` as `TemplateDefinition` objects
- Each template is a fixed layout — no size variants
- Template elements use fresh UUIDs generated at creation time (existing pattern in `handleCreateFromTemplate`)

---

## 4. Text Tool Redesign

### Goal
Fix text element interactions: proper resize handles, improved font-size control, remove connector ports, better defaults, and more font options.

### Changes

#### Remove Connector Ports
- Text elements (`type: 'text'`) no longer render connector ports (FloatingPort components)
- No `data-port` attributes on text elements
- Connector system skips text elements as valid connection targets

#### Standard Bounding Box Resize
- Text elements get the same corner/edge resize handles as other elements (freeform cards, images, shapes)
- Dragging resize handles changes the text element's `width` and `height`
- Text content reflows/wraps within the new bounding box dimensions
- This replaces the broken wrap-width handle entirely — remove `TextWrapWidthHandle` component

#### Font-Size Handle Redesign
- Repositioned from current location to **bottom-center** of the bounding box
- Icon changed from "T" to `ALargeSmall` (Lucide) — communicates font size adjustment clearly
- Drag behavior: drag down = increase font size, drag up = decrease font size
- Visible when element is selected but not in edit mode (same as current behavior)

#### Interaction Flow
1. Click text element → selects it, shows bounding box with corner/edge resize handles + font-size handle at bottom-center
2. Click again or double-click → enters edit mode, cursor in text
3. Drag corners/edges → resize the text box (text reflows)
4. Drag font-size handle → scale font size up/down

#### Better Defaults
- New text elements start at H1 size (font size ~32px or equivalent in the current size scale)
- Default width wide enough to comfortably hold a short heading

#### Additional Font Options
Add to the existing font family list (Inter, Georgia, Mono):

**Creative/Display:**
- Space Grotesk — geometric, modern
- Syne — bold, artistic
- Unbounded — bold, geometric display font

**Professional/Versatile:**
- Playfair Display — elegant serif
- Raleway — clean sans-serif
- Outfit — modern, readable

All fonts loaded via Google Fonts (or next/font) to match existing font loading patterns.

---

## 5. Remove OpenAI Models

### Goal
Remove all OpenAI model integrations from the application. The user no longer wishes to support OpenAI as a provider.

### Scope of Changes
- **AI credit config** (`src/lib/ai-credit-config.ts`): Remove `gpt-4o` and `gpt-4o-mini` from the model list and credit tiers
- **Provider registry** (`src/lib/ai/provider-registry.ts`): Remove OpenAI provider instantiation and imports
- **Model selector UI** (`src/components/cxd/ai-model-selector.tsx`): Remove OpenAI models from the dropdown
- **API route** (`src/app/api/ai/chat/route.ts`): Remove OpenAI model handling in the chat endpoint
- **Analysis route** (`src/app/api/ai/analyze/route.ts`): Remove OpenAI model handling if present
- **BYOK route** (`src/app/api/ai/byok/route.ts`): Remove OpenAI key validation/support
- **API key manager** (`src/components/settings/api-key-manager.tsx`): Remove OpenAI API key input field
- **Environment variables**: Remove `OPENAI_API_KEY` from `.env` / `.env.local` / `.env.example` references
- **Package dependencies**: Remove `openai` npm package if it exists as a direct dependency (check if Vercel AI SDK handles OpenAI internally — if so, only remove direct imports)
- **Any other references**: Search codebase for "openai", "gpt-4", "gpt-3", "OpenAI" and remove all references

### Remaining Providers After Removal
- Google Gemini (2.0 Flash, 2.5 Pro)
- Anthropic Claude (Haiku 4.5, Sonnet 4.5, Opus 4.6)
- Moonshot Kimi (K2.5)

---

## 6. Breadcrumb Bug Fix

### Goal
Fix the breadcrumb display bug where breadcrumb text duplicates even though the canvas state is correct. The duplication is a rendering/state sync issue in the breadcrumb UI only.

### Investigation Plan
- Examine `cxd-navbar.tsx` breadcrumb rendering logic
- Trace `boardPath` state updates in the Zustand store — specifically `navigateToBoardPath()` and any mutations to the `boardPath` array
- Check for duplicate pushes to `boardPath` (e.g., double-firing of navigation events, React strict mode double-rendering, or missing deduplication)
- Check if browser history integration (`popstate` handler) is pushing duplicate entries
- Test with nested board navigation (enter board, go deeper, go back) to reproduce

### Likely Root Cause Areas
- `boardPath` array being mutated in place (Yjs/Zustand reactivity issue) rather than replaced
- Navigation handler firing twice (event listener registered multiple times, or React effect running twice)
- Browser history `pushState`/`popstate` interaction creating duplicate path entries

### Fix Approach
- Identify the duplication source through debugging
- Add deduplication guard: before pushing to `boardPath`, check if the last entry already matches
- Ensure `boardPath` is always replaced (new array reference), never mutated in place
- Verify fix across: entering boards, exiting boards, using browser back button, refreshing the page

---

## 7. Security Audit & Hardening

### Goal
Comprehensive security review of the application to identify and fix vulnerabilities before production release.

### Audit Areas

#### Authentication & Authorization
- Review Supabase RLS policies — ensure all tables have appropriate row-level security
- Verify auth middleware covers all protected routes
- Check session token handling and expiration
- Review OAuth callback security (Google sign-in)
- Verify email verification flow

#### API Security
- Review all API routes (`src/app/api/`) for:
  - Authentication checks (user must be logged in)
  - Authorization checks (user owns the resource)
  - Input validation and sanitization
  - Rate limiting (check `rate-limiter.ts` coverage)
- AI endpoints: verify credit checks can't be bypassed
- BYOK endpoint: verify API key encryption at rest (`encryption.ts`)
- Collaboration invite endpoint: verify authorization

#### Client-Side Security
- Check for XSS vectors in user-generated content rendering (canvas element content, comments, project names)
- Review `dangerouslySetInnerHTML` usage if any
- Check for open redirects in auth flows
- Verify CSP headers if configured

#### Data Security
- Review what data is sent to AI providers — ensure no sensitive user data leaks in prompts
- Check Yjs sync — verify collaboration data is scoped to authorized users only
- Review file upload handling (images) for type validation and size limits
- Check for information disclosure in error responses

#### Infrastructure
- Review environment variable handling — no secrets in client bundles
- Check Next.js server/client boundary — ensure server-only code stays server-side
- Review CORS configuration
- Check dependency vulnerabilities (`npm audit`)

### Deliverables
- Vulnerability report with severity ratings (Critical, High, Medium, Low)
- Fixes for all Critical and High issues
- Recommendations for Medium/Low issues
- `npm audit` clean or documented exceptions
