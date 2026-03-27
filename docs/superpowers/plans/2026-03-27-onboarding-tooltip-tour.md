# Onboarding Tooltip Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a guided tooltip tour system that introduces new users to the Canvas (9 steps), Map (5 steps), and Plan (7 steps) tabs after completing the Framing wizard.

**Architecture:** Custom tour engine (~300 LOC) using React portals, Zustand state slice, and CSS spotlight overlay. Target elements are identified via `data-tour-id` attributes. Tour completion state is persisted in the project data via Zustand/Yjs.

**Tech Stack:** TypeScript, React, Zustand, TailwindCSS, CSS Portals

---

### Task 1: Create Tour State in Zustand Store

**Files:**
- Modify: `src/store/cxd-store.ts`
- Modify: `src/types/cxd-schema.ts` (if tourCompleted needs schema changes)

- [ ] **Step 1: Add tour state to the store interface**

Add tour-related state and actions to the store type:

```typescript
// Add to the state interface:
tourActive: boolean;
tourId: 'canvas' | 'map' | 'plan' | null;
tourStep: number;

// Add to the actions interface:
startTour: (tourId: 'canvas' | 'map' | 'plan') => void;
nextTourStep: () => void;
prevTourStep: () => void;
skipTour: () => void;
completeTour: () => void;
isTourCompleted: (tourId: 'canvas' | 'map' | 'plan') => boolean;
```

- [ ] **Step 2: Add tourCompleted to project schema**

In the project data structure (check `src/types/cxd-schema.ts` or wherever the project type is defined), add:

```typescript
tourCompleted?: {
  canvas: boolean;
  map: boolean;
  plan: boolean;
};
```

- [ ] **Step 3: Implement tour actions in the store**

```typescript
// Initial state:
tourActive: false,
tourId: null,
tourStep: 0,

// Actions:
startTour: (tourId) => {
  set({ tourActive: true, tourId, tourStep: 0 });
},

nextTourStep: () => {
  const { tourStep, tourId } = get();
  const steps = TOUR_STEPS[tourId!];
  if (tourStep < steps.length - 1) {
    set({ tourStep: tourStep + 1 });
  } else {
    get().completeTour();
  }
},

prevTourStep: () => {
  const { tourStep } = get();
  if (tourStep > 0) {
    set({ tourStep: tourStep - 1 });
  }
},

skipTour: () => {
  get().completeTour();
},

completeTour: () => {
  const { tourId } = get();
  if (tourId) {
    const project = get().getCurrentProject();
    if (project) {
      const tourCompleted = project.tourCompleted || { canvas: false, map: false, plan: false };
      tourCompleted[tourId] = true;
      get().syncUpdateProject({ tourCompleted });
    }
  }
  set({ tourActive: false, tourId: null, tourStep: 0 });
},

isTourCompleted: (tourId) => {
  const project = get().getCurrentProject();
  return project?.tourCompleted?.[tourId] ?? false;
},
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS or only unrelated errors

- [ ] **Step 5: Commit**

```bash
git add src/store/cxd-store.ts src/types/cxd-schema.ts
git commit -m "feat: add tour state management to Zustand store"
```

---

### Task 2: Define Tour Step Configurations

**Files:**
- Create: `src/lib/tour-steps.ts`

- [ ] **Step 1: Create tour step type and data**

```typescript
export interface TourStep {
  targetId: string;  // matches data-tour-id attribute
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  /** Optional: action to perform before showing this step (e.g., open a panel) */
  preAction?: () => void;
}

export const TOUR_STEPS: Record<'canvas' | 'map' | 'plan', TourStep[]> = {
  canvas: [
    {
      targetId: 'canvas-toolkit',
      title: 'Your Toolkit',
      content: 'This is your toolkit. Click any tool to add elements to your canvas — cards, text, images, shapes, containers, and more.',
      position: 'right',
    },
    {
      targetId: 'canvas-element-sample',
      title: 'Canvas Elements',
      content: 'Drag to move, grab corners to resize, right-click for more options. Double-click cards to edit their content.',
      position: 'top',
    },
    {
      targetId: 'canvas-inbox',
      title: 'Inbox',
      content: 'Your inbox holds elements waiting to be placed. Drag them onto the canvas when you\'re ready to use them.',
      position: 'left',
    },
    {
      targetId: 'canvas-connector-port',
      title: 'Connections',
      content: 'Drag from a connector port to another element to create connections. A menu appears to choose the connection type.',
      position: 'top',
    },
    {
      targetId: 'canvas-board-tool',
      title: 'Nested Boards',
      content: 'Create nested boards to organize complex projects. Double-click a board to dive inside it.',
      position: 'top',
    },
    {
      targetId: 'canvas-experience-sidebar',
      title: 'Experience Elements',
      content: 'Drag experience elements from here onto the canvas, or click them to view details about each experience stage.',
      position: 'left',
    },
    {
      targetId: 'canvas-experience-flow',
      title: 'Experience Flow',
      content: 'Map the stages of your experience here. This timeline shows how your experience flows from start to finish.',
      position: 'top',
    },
    {
      targetId: 'canvas-collaborate-btn',
      title: 'Collaborate',
      content: 'Invite teammates to work on this canvas together in real-time.',
      position: 'bottom',
    },
    {
      targetId: 'canvas-shortcuts-btn',
      title: 'Keyboard Shortcuts',
      content: 'View all keyboard shortcuts and navigation controls here.',
      position: 'bottom',
    },
  ],
  map: [
    {
      targetId: 'map-face-selector',
      title: 'Face Selector',
      content: 'Select a face of the Hypercube to explore. Each face represents a different dimension of your experience.',
      position: 'bottom',
    },
    {
      targetId: 'map-insights-panel',
      title: 'System Insights',
      content: 'This panel shows AI-generated insights about the current face based on the elements you\'ve tagged on your canvas.',
      position: 'left',
    },
    {
      targetId: 'map-chat-panel',
      title: 'AI Chat',
      content: 'Ask the AI questions about your experience design. The more elements you tag on the canvas, the richer context the AI has to work with.',
      position: 'left',
    },
    {
      targetId: 'map-cyberdelic-tab',
      title: 'Cyberdelic Wizard',
      content: 'The Cyberdelic wizard guides you through deeper experience design patterns and frameworks.',
      position: 'top',
    },
    {
      targetId: 'map-erd-button',
      title: 'Experience Requirements Document',
      content: 'When you\'re ready, generate an Experience Requirements Document — a complete presentation of your canvas work to share with stakeholders.',
      position: 'bottom',
    },
  ],
  plan: [
    {
      targetId: 'plan-roadmap-tab',
      title: 'Roadmap',
      content: 'Start here. Create a version roadmap to organize your project into milestones and releases.',
      position: 'bottom',
    },
    {
      targetId: 'plan-kanban-add-task',
      title: 'Add Tasks',
      content: 'Add tasks to track your work. Drag cards between columns to update their status.',
      position: 'bottom',
    },
    {
      targetId: 'plan-task-detail',
      title: 'Task Details',
      content: 'Click any task to see its full details — assign people, set dates, add descriptions, and manage subtasks.',
      position: 'left',
    },
    {
      targetId: 'plan-table-tab',
      title: 'Table View',
      content: 'View all your tasks in a structured table format for quick scanning and bulk editing.',
      position: 'bottom',
    },
    {
      targetId: 'plan-timeline-tab',
      title: 'Timeline',
      content: 'Place tasks on a timeline, drag to adjust duration, and connect dependencies between tasks.',
      position: 'bottom',
    },
    {
      targetId: 'plan-calendar-tab',
      title: 'Calendar',
      content: 'View tasks in month, week, or day views. In week view, drag tasks to time-block your schedule.',
      position: 'bottom',
    },
    {
      targetId: 'plan-archive-tab',
      title: 'Archive',
      content: 'Completed tasks can be archived here. Review past work or restore tasks when needed.',
      position: 'bottom',
    },
  ],
};
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/tour-steps.ts
git commit -m "feat: define tour step configurations for all 3 tabs"
```

---

### Task 3: Build TourOverlay Component

**Files:**
- Create: `src/components/cxd/tour/tour-overlay.tsx`

- [ ] **Step 1: Create the TourOverlay component**

This component renders the spotlight overlay, tooltip, and navigation controls:

```tsx
"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useCXDStore } from '@/store/cxd-store';
import { TOUR_STEPS } from '@/lib/tour-steps';

export function TourOverlay() {
  const tourActive = useCXDStore(s => s.tourActive);
  const tourId = useCXDStore(s => s.tourId);
  const tourStep = useCXDStore(s => s.tourStep);
  const nextTourStep = useCXDStore(s => s.nextTourStep);
  const prevTourStep = useCXDStore(s => s.prevTourStep);
  const skipTour = useCXDStore(s => s.skipTour);

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentSteps = tourId ? TOUR_STEPS[tourId] : [];
  const currentStep = currentSteps[tourStep];
  const totalSteps = currentSteps.length;

  // Find and measure target element
  useEffect(() => {
    if (!tourActive || !currentStep) return;

    const findTarget = () => {
      const target = document.querySelector(`[data-tour-id="${currentStep.targetId}"]`);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    };

    // Run preAction if defined
    currentStep.preAction?.();

    // Small delay to allow preAction to take effect
    const timer = setTimeout(findTarget, 100);

    // Re-measure on resize/scroll
    window.addEventListener('resize', findTarget);
    window.addEventListener('scroll', findTarget, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', findTarget);
      window.removeEventListener('scroll', findTarget, true);
    };
  }, [tourActive, tourStep, currentStep]);

  // Keyboard handler
  useEffect(() => {
    if (!tourActive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skipTour();
      if (e.key === 'ArrowRight' || e.key === 'Enter') nextTourStep();
      if (e.key === 'ArrowLeft') prevTourStep();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [tourActive, nextTourStep, prevTourStep, skipTour]);

  if (!tourActive || !currentStep || !targetRect) return null;

  // Calculate tooltip position
  const padding = 8;
  const tooltipGap = 12;
  const cutout = {
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
  };

  let tooltipStyle: React.CSSProperties = {};
  switch (currentStep.position) {
    case 'top':
      tooltipStyle = { left: cutout.left, bottom: window.innerHeight - cutout.top + tooltipGap };
      break;
    case 'bottom':
      tooltipStyle = { left: cutout.left, top: cutout.top + cutout.height + tooltipGap };
      break;
    case 'left':
      tooltipStyle = { right: window.innerWidth - cutout.left + tooltipGap, top: cutout.top };
      break;
    case 'right':
      tooltipStyle = { left: cutout.left + cutout.width + tooltipGap, top: cutout.top };
      break;
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] pointer-events-none">
      {/* Overlay with cutout */}
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{
          boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.6),
                      inset ${cutout.left}px ${cutout.top}px 0 0 transparent`,
          // Use clip-path for the cutout
          clipPath: `polygon(
            0% 0%, 0% 100%, ${cutout.left}px 100%, ${cutout.left}px ${cutout.top}px,
            ${cutout.left + cutout.width}px ${cutout.top}px,
            ${cutout.left + cutout.width}px ${cutout.top + cutout.height}px,
            ${cutout.left}px ${cutout.top + cutout.height}px, ${cutout.left}px 100%,
            100% 100%, 100% 0%
          )`,
          background: 'rgba(0, 0, 0, 0.6)',
          transition: 'all 300ms ease',
        }}
      />

      {/* Purple glow around cutout */}
      <div
        className="absolute rounded-lg pointer-events-none"
        style={{
          left: cutout.left - 2,
          top: cutout.top - 2,
          width: cutout.width + 4,
          height: cutout.height + 4,
          boxShadow: '0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          transition: 'all 300ms ease',
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute pointer-events-auto max-w-[320px] rounded-xl p-4"
        style={{
          ...tooltipStyle,
          background: '#1a1a2e',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          transition: 'all 300ms ease',
        }}
      >
        <h3 className="text-white font-medium text-sm mb-1">{currentStep.title}</h3>
        <p className="text-white/70 text-sm leading-relaxed">{currentStep.content}</p>

        {/* Controls */}
        <div className="flex items-center justify-between mt-4">
          {/* Step dots */}
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === tourStep ? 'bg-purple-400' : 'bg-white/20'
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={skipTour}
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Skip tour
            </button>
            {tourStep > 0 && (
              <button
                onClick={prevTourStep}
                className="px-3 py-1.5 text-xs rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                Back
              </button>
            )}
            <button
              onClick={nextTourStep}
              className="px-3 py-1.5 text-xs rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-all"
            >
              {tourStep === totalSteps - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/cxd/tour/tour-overlay.tsx
git commit -m "feat: create TourOverlay component with spotlight and tooltip"
```

---

### Task 4: Add data-tour-id Attributes to Canvas Tab

**Files:**
- Modify: `src/components/cxd/canvas/canvas-toolkit.tsx` (toolkit)
- Modify: `src/components/cxd/cxd-canvas.tsx` (inbox, experience flow)
- Modify: `src/components/cxd/cxd-navbar.tsx` (collaborate, shortcuts buttons)
- Modify: Various components for remaining targets

- [ ] **Step 1: Add data-tour-id to the toolkit bar**

In `canvas-toolkit.tsx`, add to the root element:
```tsx
<div data-tour-id="canvas-toolkit" className="...">
```

- [ ] **Step 2: Add data-tour-id to the inbox area**

In `cxd-canvas.tsx`, find the inbox/task-inbox container and add:
```tsx
<div data-tour-id="canvas-inbox" className="...">
```

- [ ] **Step 3: Add data-tour-id to the experience sidebar**

Find the right sidebar that shows experience elements and add:
```tsx
<div data-tour-id="canvas-experience-sidebar" className="...">
```

- [ ] **Step 4: Add data-tour-id to the experience flow bottom drawer**

Find the experience flow drawer component and add:
```tsx
<div data-tour-id="canvas-experience-flow" className="...">
```

- [ ] **Step 5: Add data-tour-id to the collaborate button in navbar**

In `cxd-navbar.tsx`, find the collaborate/share button and add:
```tsx
<button data-tour-id="canvas-collaborate-btn" className="...">
```

- [ ] **Step 6: Add data-tour-id to the keyboard shortcuts button**

In the navbar or canvas area, find the shortcuts button and add:
```tsx
<button data-tour-id="canvas-shortcuts-btn" className="...">
```

- [ ] **Step 7: Add data-tour-id to a sample canvas element**

For the first element on the canvas (or a known element), add:
```tsx
<div data-tour-id="canvas-element-sample" className="...">
```
This may need to be set dynamically on the first rendered element.

- [ ] **Step 8: Add data-tour-id for connector port area**

On a canvas element's connector port area:
```tsx
<div data-tour-id="canvas-connector-port" className="...">
```

- [ ] **Step 9: Add data-tour-id to the board tool in toolkit**

```tsx
<button data-tour-id="canvas-board-tool" className="...">
```

- [ ] **Step 10: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add data-tour-id attributes to canvas tab UI elements"
```

---

### Task 5: Add data-tour-id Attributes to Map and Plan Tabs

**Files:**
- Modify: `src/components/cxd/canvas/hexagon-view.tsx` (Map tab elements)
- Modify: `src/components/cxd/plan/plan-view.tsx` (Plan tab elements)
- Modify: Various Map and Plan sub-components

- [ ] **Step 1: Add data-tour-id to Map tab elements**

Add attributes to:
- Face selector menu: `data-tour-id="map-face-selector"`
- System Insights panel: `data-tour-id="map-insights-panel"`
- Chat panel: `data-tour-id="map-chat-panel"`
- Cyberdelic wizard tab: `data-tour-id="map-cyberdelic-tab"`
- ERD button: `data-tour-id="map-erd-button"`

- [ ] **Step 2: Add data-tour-id to Plan tab elements**

Add attributes to:
- Roadmap view tab: `data-tour-id="plan-roadmap-tab"`
- Kanban add task button: `data-tour-id="plan-kanban-add-task"`
- Task detail panel: `data-tour-id="plan-task-detail"`
- Table view tab: `data-tour-id="plan-table-tab"`
- Timeline view tab: `data-tour-id="plan-timeline-tab"`
- Calendar view tab: `data-tour-id="plan-calendar-tab"`
- Archive view tab: `data-tour-id="plan-archive-tab"`

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add data-tour-id attributes to map and plan tab elements"
```

---

### Task 6: Wire Up Tour Triggers and Replay

**Files:**
- Modify: `src/components/cxd/cxd-canvas.tsx` (or the view mode switch component)
- Modify: `src/components/cxd/cxd-navbar.tsx` (replay button)
- Modify: Root layout or app component (mount TourOverlay)

- [ ] **Step 1: Mount TourOverlay globally**

In the canvas layout or the component that wraps all view modes, add:

```tsx
import { TourOverlay } from '@/components/cxd/tour/tour-overlay';

// In the render:
<TourOverlay />
```

- [ ] **Step 2: Auto-trigger tour on first tab visit**

In the view mode switching logic (wherever `canvasViewMode` changes), add a check:

```typescript
useEffect(() => {
  if (canvasViewMode === 'canvas' && !isTourCompleted('canvas')) {
    const timer = setTimeout(() => startTour('canvas'), 1000);
    return () => clearTimeout(timer);
  }
  if (canvasViewMode === 'hexagon' && !isTourCompleted('map')) {
    const timer = setTimeout(() => startTour('map'), 1000);
    return () => clearTimeout(timer);
  }
  if (canvasViewMode === 'plan' && !isTourCompleted('plan')) {
    const timer = setTimeout(() => startTour('plan'), 1000);
    return () => clearTimeout(timer);
  }
}, [canvasViewMode]);
```

- [ ] **Step 3: Add replay button to navbar**

Add a help icon button in the navbar that allows replaying tours:

```tsx
<button
  onClick={() => {
    // Start tour for current view mode
    const tourMap = { canvas: 'canvas', hexagon: 'map', plan: 'plan' } as const;
    const tourId = tourMap[canvasViewMode as keyof typeof tourMap];
    if (tourId) startTour(tourId);
  }}
  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/60 transition-all"
  title="Replay tour"
>
  <HelpCircle className="w-4 h-4" />
</button>
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 5: Test manually**

Run: `npm run dev`
Test:
1. Complete Framing wizard → navigate to Canvas → tour auto-starts after 1s
2. Navigate through all 9 Canvas steps with Next/Back
3. Skip tour → tour marked as completed
4. Switch to Map tab → Map tour auto-starts
5. Click replay button → tour restarts
6. Refresh page → completed tours don't restart

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire tour triggers, auto-start on first visit, replay button"
```
