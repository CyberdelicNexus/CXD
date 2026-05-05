# Hypercube Map — Landing Page Concept + Feature Highlights Update

**Date:** 2026-04-23 (revised after user feedback moved the concept into its own section)
**File:** `CXD/src/components/landing-page.tsx`

## Goal

Reframe the Hypercube area of the landing page in two layers:

1. **A new concept section** above the feature cards that teaches what a hypercube
   is and why it belongs in experience design.
2. **The existing Hypercube `FeatureShowcase`** refocused on three shipped
   capabilities ("Tag Objects & Ask", "Insights & Configure", "Your Model, Your
   Workflow"), with a short bridging description that names all three.

## Concept section (NEW)

A new `HypercubeConcept` component, defined in the same file, rendered
immediately before the `hypercube` entry inside the `FEATURE_SECTIONS.map` loop
in the existing `id="features"` wrapper.

**Layout:** Two-column on desktop (`md:grid-cols-2`), stacked on mobile. Left
column is the animated GIF, right column is the hero title + concept paragraph.
Padding and container sizing consistent with surrounding `FeatureShowcase`
sections.

**Hero title (right column, above the paragraph):**

> Flat tools produce flat experiences. The Hypercube gives experience design
> dimensional intelligence.

**Paragraph (right column, below the title):**

> Experiences are layered. They happen on more than one surface of reality at
> once. They activate more than one sense. They shift more than one kind of
> presence.
>
> That's why we use a higher-dimensional geometry for experience design: the
> Hypercube.
>
> The inner cube is your core message. The intent the experience is built
> around.
>
> The outer cube's six faces are the dimensions that message travels through:
> Reality Planes, Sensory Domains, Presence Types, State Mapping, Trait
> Mapping, and Meaning Architecture.
>
> Six faces. Six dimensions. One object you can rotate, tag, and align every
> part of your experience to.

**Left-column media:**

- Asset: `/images/Tesseract-1K.gif` (exists; ~3 MB)
- Rendered with a plain `<img>` (Next.js `<Image>` with animated GIFs requires
  `unoptimized`; a plain `<img>` is simpler and matches the GIF nature of the
  asset)
- `loading="lazy"`, `decoding="async"`, `alt="Rotating tesseract representing the Hypercube"`

## Hypercube FeatureShowcase (REVISED from prior spec)

Fields on the `id: 'hypercube'` entry in `FEATURE_SECTIONS`:

- `headline: 'Design From'`
- `highlight: 'Core Outward'`
- `description`:
  > Three ways the Hypercube works for you: tag objects and ask, surface
  > insights and configure, and make it your model, your workflow.
- `icon`: `Box` (unchanged)
- `label`: `'Hypercube Map'` (unchanged)
- `poster`: `/images/Screenshot/3_canvas-screeshot.png` (unchanged)
- `details` (unchanged from the current on-disk implementation — all three
  cards with placeholder V2 video paths, verified in the prior implementer
  run):

  1. `Tag Objects & Ask` → `/images/Gifs/V2/Hypercube%20-%20Tag%20%26%20Ask.mp4`
  2. `Insights & Configure` → `/images/Gifs/V2/Hypercube%20-%20Insights%20%26%20Configure.mp4`
  3. `Your Model, Your Workflow` → `/images/Gifs/V2/Hypercube%20-%20Model%20%26%20Inbox.mp4`

The ONLY field changing vs. the current on-disk state is `description` (the
long cube-in-cube paragraph moves out of the FeatureShowcase and up into the
new concept section; the FeatureShowcase gets the bridging line).

## Rendering

Replace:

```tsx
{FEATURE_SECTIONS.map((section, index) => (
  <FeatureShowcase key={section.id} section={section} index={index} />
))}
```

with:

```tsx
{FEATURE_SECTIONS.map((section, index) => (
  <Fragment key={section.id}>
    {section.id === 'hypercube' && <HypercubeConcept />}
    <FeatureShowcase section={section} index={index} />
  </Fragment>
))}
```

Add `Fragment` to the React import (or use `<React.Fragment>`).

## Scope

- Single file: `CXD/src/components/landing-page.tsx`
- Single asset referenced: `/images/Tesseract-1K.gif` (already present — no new
  files added to `public/`)
- No new dependencies, no schema/interface changes, no other sections touched

## Out of scope

- Recording the three feature MP4s (they remain as placeholder paths)
- Visual polish beyond matching the existing Tailwind patterns in the file
- Mobile-specific asset swap (the GIF is used at all viewports)
