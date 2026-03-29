# Public Share Page Redesign — Design Specification

## Goal

Redesign the read-only public share page to serve as a polished presentation of the experience design, convert viewers into collaborators, and provide a professional first impression for stakeholders.

## Audiences

1. **Clients/stakeholders** — reviewing the experience design for approval or feedback
2. **Potential collaborators** — people the owner wants to eventually invite to co-create

---

## 1. Share Settings Modal (Owner Side)

### Trigger

The Share button in the navbar now opens a settings modal instead of immediately copying a link.

### Modal Contents

- **Cover Image Upload** — dedicated image for the share page hero (manual upload, stored as `shareCoverImage` on the project)
- **Project Thumbnail Upload** — image shown on the landing page as the project preview (stored as `shareThumbnail` on the project)
- **Share Link** — displays the generated URL with a "Copy Link" button
- **Generate New Link** — creates a new share token (invalidates the previous one)
- **Revoke** — removes the share token entirely (link stops working)

### Schema Additions

Add to `CXDProject` in `src/types/cxd-schema.ts`:

```typescript
shareCoverImage?: string;   // URL to uploaded cover image for share page
shareThumbnail?: string;    // URL to uploaded thumbnail for share page
```

### Image Storage

Use Supabase Storage (same bucket/pattern as existing profile and cover image uploads in the dashboard).

---

## 2. Share Landing Page (Visitor Side)

### Route

Existing: `/cxd/share/[token]` — redesign the page component.

### Visual Design

- **Matches the dashboard aesthetic**: dark background, `ShimmerGrid` component with mouse hover animation (same as dashboard), glass-morphism cards
- **Cover image hero** at the top (from `shareCoverImage`, falls back to a gradient if not set)
- Gradient fade from cover into the content area

### Layout (top to bottom)

1. **CXD Branding** — logo + "Cyberdelic Experience Design" tagline (small, top-left)
2. **Cover image** — full-width hero at top with gradient fade to content
3. **Project identity** — project name (large), creator name (subtle), concept excerpt from framing data
4. **Thumbnail** — project thumbnail image centered (from `shareThumbnail`)
5. **View buttons**:
   - "View Experience Design" — primary button with gradient background (`#7c3aed → #6d28d9`), opens framing presentation
   - "View Canvas" — secondary button with glass-morphism border, opens read-only canvas
6. **Divider**
7. **CTA section**:
   - "Request to Collaborate" — gradient purple/pink border button, redirects to sign-up with `returnTo` param
   - "Create your own experience design →" — subtle gradient text link, points to home/sign-up page

### No Authentication Required

The landing page and all content views are fully public. Authentication only happens if the visitor clicks "Request to Collaborate."

---

## 3. Framing Presentation (Read-Only)

### Design

A **read-only version of the framing wizard** (`cxd-wizard.tsx`) that displays the user's framing data as a polished presentation. It reuses the same:

- **Step icons** — Lucide icons from the wizard (Target, Lightbulb, Users, Globe, BookOpen, Sparkles, etc.)
- **Step navigation tabs** — same pill-shaped tab bar showing all 11 steps across the 6 phases
- **Ghost gradient borders** — same dashed/gradient border styling on the content cards
- **Layout** — same centered content area with step indicator, progress dots, and prev/next navigation
- **Background** — `ShimmerGrid` component with dotted hover animation

### Key Differences from Wizard

- **Read-only**: Input fields replaced with styled text display of the actual content
- **No edit functionality**: No textareas, no save buttons
- **All steps navigable**: User can click any tab or use prev/next to browse all 11 steps
- **Empty fields**: If a framing field was never filled in, show a subtle "Not yet defined" placeholder
- **No progress tracking**: No progress bar needed (all content is static)

### 11 Steps (matching wizard)

Grouped into 6 phases:

1. **Intent**: Intention Core (project name, concept, core message)
2. **Objectives**: Desired Change (insights, feelings, states, knowledge)
3. **Audience**: Human Context (needs, desires, role)
4. **Meaning**: World, Story, Magic
5. **Structure**: Reality Planes, Sensory Domains, Presence Types
6. **Transformation**: State Mapping, Trait Mapping

### Navigation

- Tab bar at top for direct step access (same as wizard)
- Prev/Next buttons on the sides (same circular gradient buttons as wizard)
- Step counter (e.g., "1 of 11")
- "Back to overview" link returns to landing page

---

## 4. Canvas View (Read-Only)

### Existing Component

Reuse `cxd-canvas-readonly.tsx` — the read-only canvas with pan/zoom controls.

### Additions

- **"READ ONLY" badge** — small purple badge in the top-right corner
- **"Back to overview" link** — returns to landing page
- **Board navigation** — if the project has nested boards, viewers can double-click to enter them (read-only)
- **ShimmerGrid background** — same dotted hover animation as landing page

---

## 5. Collaboration Request Flow

### User Journey

1. Visitor clicks "Request to Collaborate" on the landing page
2. Redirected to sign-up page with URL params: `/sign-up?returnTo=/cxd/share/[token]&join=true`
3. Visitor creates account (or signs in if they already have one)
4. After auth, redirected back to `/cxd/share/[token]?join=true`
5. The share page detects `?join=true` and the authenticated user:
   - Creates a `canvas_collaborators` entry for this user on this project
   - Sends a notification to the project owner ("X has joined your project")
   - Redirects the user to `/cxd` with the project loaded (full editing access)

### Edge Cases

- **Already a collaborator**: If the user is already a collaborator, skip the add step and redirect directly to the canvas
- **Owner viewing own share link**: Show a banner "This is your project's share page" instead of the collaborate CTA
- **Already authenticated**: If a logged-in user clicks "Request to Collaborate", skip sign-up and proceed directly to adding them as a collaborator

### Permissions

- New collaborators get **editor** access by default
- Owner is notified and can remove collaborators from the collaboration panel

---

## 6. Component Architecture

### New Components

- `ShareSettingsModal` — modal for share page configuration (cover, thumbnail, link management)
- `ShareLandingPage` — redesigned landing page replacing current share page
- `ShareFramingPresentation` — read-only framing wizard presentation

### Reused Components

- `ShimmerGrid` — dotted background with hover animation (from dashboard)
- `CXDCanvasReadonly` — existing read-only canvas (may need minor updates)
- Wizard step icons and styling from `cxd-wizard.tsx`

### Modified Components

- `cxd-navbar.tsx` — Share button opens `ShareSettingsModal` instead of directly copying link
- `src/app/cxd/share/[token]/page.tsx` — complete redesign of the share page

### Files Affected

- Create: `src/components/cxd/share/share-settings-modal.tsx`
- Create: `src/components/cxd/share/share-landing-page.tsx`
- Create: `src/components/cxd/share/share-framing-presentation.tsx`
- Modify: `src/app/cxd/share/[token]/page.tsx` — rewire to new components
- Modify: `src/components/cxd/cxd-navbar.tsx` — Share button opens modal
- Modify: `src/types/cxd-schema.ts` — add `shareCoverImage`, `shareThumbnail`
- Modify: `src/lib/supabase-projects.ts` — handle new fields in save/fetch
- Modify: `src/app/cxd/share/[token]/page.tsx` — handle `?join=true` for collaboration auto-add
