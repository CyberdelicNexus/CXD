# Hypercube Concept + Feature Highlights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `HypercubeConcept` component (with the Tesseract GIF on the left and the concept copy on the right) above the existing Hypercube `FeatureShowcase`, and update the `FeatureShowcase` `description` to a short bridging line now that the long concept paragraph lives in the new section above.

**Architecture:** All changes inside one file — `CXD/src/components/landing-page.tsx`. A new inline `HypercubeConcept` function component is added next to the existing `FeatureShowcase`, and the `FEATURE_SECTIONS.map` is wrapped in `React.Fragment` so the concept section renders immediately before the hypercube feature section.

**Tech Stack:** Next.js + React + TypeScript + Tailwind. No new dependencies. Animated GIF is rendered with a plain `<img>` tag (Next.js `<Image>` requires `unoptimized` for animated GIFs, and the plain tag is simpler and matches the file's existing pattern for decorative images).

---

## File Structure

- **Modify:** `CXD/src/components/landing-page.tsx`
  - Add `Fragment` to the `react` import.
  - Change the `hypercube` entry's `description` field inside `FEATURE_SECTIONS`.
  - Add a new `HypercubeConcept` component definition (placed directly below `FeatureShowcase`).
  - Wrap the `FEATURE_SECTIONS.map` with `Fragment` and inject `<HypercubeConcept />` when the current section's `id === 'hypercube'`.

No new files, no new assets, no other files touched.

---

## Task 1: Update imports and the hypercube description

**Files:**
- Modify: `CXD/src/components/landing-page.tsx`

- [ ] **Step 1: Read the current imports and the hypercube entry to confirm baseline**

Read `CXD/src/components/landing-page.tsx` and verify:

The top import:

```tsx
import { useState, useEffect, useRef } from 'react';
```

And that the current `hypercube` entry (from the prior implementer run) looks like:

```tsx
  {
    id: 'hypercube',
    icon: Box,
    label: 'Hypercube Map',
    headline: 'Design From',
    highlight: 'Core Outward',
    description: 'A hypercube is a cube inside a cube. The inner cube is your core message — the guiding force of the experience. The outer cube\'s six faces are the dimensions that message travels through: reality planes, sensory domains, presence, state, traits, and meaning. Rotate it to see how every layer aligns with your intent.',
    poster: '/images/Screenshot/3_canvas-screeshot.png',
    details: [
      { title: 'Tag Objects & Ask', description: 'Tag canvas objects to any face to give them context. Then ask Cyberdelic Intelligence questions — in general mode, or scoped to a single face — and get answers grounded in exactly what you tagged.', video: '/images/Gifs/V2/Hypercube%20-%20Tag%20%26%20Ask.mp4' },
      { title: 'Insights & Configure', description: 'The System Insights panel surfaces suggestions, questions, and tips from your design. The Configure panel sits alongside so you can adjust settings as you read — insight and control, side by side.', video: '/images/Gifs/V2/Hypercube%20-%20Insights%20%26%20Configure.mp4' },
      { title: 'Your Model, Your Workflow', description: 'Choose from multiple AI models or bring your own key. Turn any reply into a note or task right from the chat window — it lands in your inbox, ready to drop anywhere on the canvas.', video: '/images/Gifs/V2/Hypercube%20-%20Model%20%26%20Inbox.mp4' },
    ],
  },
```

If the file does not match, stop and report NEEDS_CONTEXT so the controller can reconcile.

- [ ] **Step 2: Add `Fragment` to the react import**

Change:

```tsx
import { useState, useEffect, useRef } from 'react';
```

to:

```tsx
import { useState, useEffect, useRef, Fragment } from 'react';
```

- [ ] **Step 3: Replace the hypercube `description`**

The `headline`, `highlight`, `details`, `icon`, `label`, and `poster` fields stay exactly as-is. Only the `description` string changes.

Replace the current long description string in the `hypercube` entry with:

```tsx
    description: 'Three ways the Hypercube works for you: tag objects and ask, surface insights and configure, and make it your model, your workflow.',
```

(No em-dashes — the line uses ASCII commas and periods only. No apostrophes to escape.)

Use the Edit tool. Match a unique snippet (include the `id: 'hypercube'` line above and the `poster:` line below) so the replacement can't accidentally match a similar string elsewhere.

---

## Task 2: Add the `HypercubeConcept` component

**Files:**
- Modify: `CXD/src/components/landing-page.tsx`

- [ ] **Step 1: Locate the insertion point**

Find the line `function FeatureShowcase({ section, index }: { section: FeatureSection; index: number }) {` in the file (around line 122). The new component will be added **immediately after** the `FeatureShowcase` function closes (after the `}` that ends `FeatureShowcase`).

If you're unsure where `FeatureShowcase` ends, search for the comment `// ─── Sticky Feature Section Component ───` that introduces it, then read forward until the matching closing brace.

- [ ] **Step 2: Add the `HypercubeConcept` component**

Insert the following code **immediately after** the closing `}` of `FeatureShowcase` and before the next top-level declaration:

```tsx
// ─── Hypercube Concept Section ──────────────────────────────────────────────

function HypercubeConcept() {
  return (
    <section className="relative py-24 md:py-32 px-4">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        {/* Left: Tesseract GIF */}
        <div className="order-2 md:order-1 flex justify-center">
          <img
            src="/images/Tesseract-1K.gif"
            alt="Rotating tesseract representing the Hypercube"
            loading="lazy"
            decoding="async"
            className="w-full max-w-[420px] h-auto select-none pointer-events-none"
          />
        </div>

        {/* Right: Hero title + concept paragraph */}
        <div className="order-1 md:order-2 space-y-6">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight text-white">
            Flat tools produce flat experiences. The Hypercube gives experience design dimensional intelligence.
          </h2>

          <div className="space-y-4 text-white/70 text-base md:text-lg leading-relaxed">
            <p>
              Experiences are layered. They happen on more than one surface of reality at once. They activate more than one sense. They shift more than one kind of presence.
            </p>
            <p>
              That&apos;s why we use a higher-dimensional geometry for experience design: the Hypercube.
            </p>
            <p>
              The inner cube is your core message. The intent the experience is built around.
            </p>
            <p>
              The outer cube&apos;s six faces are the dimensions that message travels through: Reality Planes, Sensory Domains, Presence Types, State Mapping, Trait Mapping, and Meaning Architecture.
            </p>
            <p>
              Six faces. Six dimensions. One object you can rotate, tag, and align every part of your experience to.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
```

Notes:
- `order-2 md:order-1` on the GIF and `order-1 md:order-2` on the text ensures that on mobile the heading appears first (reads like a lede) and on desktop the GIF is left, text is right.
- `&apos;` is used for ASCII apostrophes so the JSX doesn't misparse.
- No new imports needed — all classes are Tailwind, `<img>` and `<section>` are intrinsic HTML.

---

## Task 3: Inject `HypercubeConcept` into the render loop

**Files:**
- Modify: `CXD/src/components/landing-page.tsx`

- [ ] **Step 1: Locate the current render block**

Find (around line 678):

```tsx
      {/* ─── Feature Showcase Sections ─── */}
      <div id="features">
        {FEATURE_SECTIONS.map((section, index) => (
          <FeatureShowcase key={section.id} section={section} index={index} />
        ))}
      </div>
```

- [ ] **Step 2: Replace with the Fragment-wrapped version**

```tsx
      {/* ─── Feature Showcase Sections ─── */}
      <div id="features">
        {FEATURE_SECTIONS.map((section, index) => (
          <Fragment key={section.id}>
            {section.id === 'hypercube' && <HypercubeConcept />}
            <FeatureShowcase section={section} index={index} />
          </Fragment>
        ))}
      </div>
```

Key prop moved from `FeatureShowcase` to `Fragment` — React requires the key on the outermost element returned by the map callback.

---

## Task 4: Verify

**Files:** none modified.

- [ ] **Step 1: Type-check**

Run from `CXD/`:

```bash
npx tsc --noEmit
```

Expected: no new errors in `landing-page.tsx`. Pre-existing errors in test files (e.g., `src/lib/ai/__tests__/ai-response-classifier.test.ts`, `src/utils/__tests__/diagnostic-chat-handoff.test.ts`) are acceptable and should be ignored — they existed before this change.

- [ ] **Step 2: Production build**

Run from `CXD/`:

```bash
npm run build
```

Expected: build succeeds (exit 0). Pre-existing `DYNAMIC_SERVER_USAGE` warnings from cookie-based API routes are unrelated and may be ignored.

If the build fails with a JSX parse error on the description or `HypercubeConcept` content, double-check that all ASCII apostrophes in JSX text were written as `&apos;` or kept inside string literals with `\'`.

- [ ] **Step 3: Commit**

Only when the user explicitly asks you to commit. If asked:

```bash
git add CXD/src/components/landing-page.tsx CXD/docs/superpowers/specs/2026-04-23-hypercube-feature-highlights-design.md CXD/docs/superpowers/plans/2026-04-23-hypercube-feature-highlights.md
git commit -m "$(cat <<'EOF'
feat(landing): add Hypercube concept section with Tesseract GIF

Split the Hypercube area of the landing page into two stacked sections: a new
concept block on top (hero title "Flat tools produce flat experiences…" with
the Tesseract-1K.gif on the side) that teaches the inner-cube / outer-cube
metaphor, and the existing feature rotator below shortened to a bridging line
that names the three shipped capabilities (Tag Objects & Ask, Insights &
Configure, Your Model, Your Workflow).
EOF
)"
```

Do not push. Do not run this step unless the user explicitly asks to commit.

---

## Self-review checklist (completed)

- **Spec coverage:** Concept section (Task 2) covers hero title, paragraph, and GIF placement. FeatureShowcase description change (Task 1, Step 3) covers the only field changing from the prior implementer run. Rendering change (Task 3) wraps the map in `Fragment` and injects the concept before the hypercube section — matches spec verbatim.
- **Placeholder scan:** No TBD/TODO; every string and class list is verbatim; edit blocks are self-contained.
- **Type consistency:** `Fragment` comes from `react` and is used exactly as in the React docs. No new types. `HypercubeConcept` is a nullary component — no props, no interface to keep in sync.
- **Cross-task consistency:** Task 1 mentions only `description` changes on the hypercube entry; Task 3 references the new `HypercubeConcept` added in Task 2; Task 4 verifies both compilation paths.
