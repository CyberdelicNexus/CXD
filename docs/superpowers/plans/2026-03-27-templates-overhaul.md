# Templates Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 3 bare-container templates with 8 richly structured templates featuring prompt cards and example content, upgrade the template picker modal with thumbnails, update the dashboard template cards, and add a full gallery page.

**Architecture:** Expand `src/lib/templates.ts` with 8 new template definitions using the existing `TemplateDefinition` interface. Each template uses containers for zones and freeform cards for prompts/examples. Upgrade the picker modal with category tabs and thumbnails. Update dashboard template cards. Add a new gallery page route.

**Tech Stack:** TypeScript, React, Next.js, TailwindCSS, Radix UI

---

### Task 1: Define Template Data Structures

**Files:**
- Modify: `src/lib/templates.ts`

- [ ] **Step 1: Add template category type**

Add a category field to the `TemplateDefinition` interface:

```typescript
export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: 'experience' | 'product-brand' | 'creative';
  elements: CanvasElement[];
}
```

- [ ] **Step 2: Update existing templates with category field**

Add `category: 'experience'` to User Journey and Service Blueprint, `category: 'creative'` to Workshop Canvas.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Errors in files consuming TemplateDefinition (need to handle the new `category` field). Note these for later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/lib/templates.ts
git commit -m "feat: add category field to template definitions"
```

---

### Task 2: Create Experience Journey Template

**Files:**
- Modify: `src/lib/templates.ts`

- [ ] **Step 1: Replace the old User Journey template with the enhanced version**

Replace the existing User Journey template with a richer version. Use 5 horizontal containers with freeform prompt cards inside each:

```typescript
{
  id: 'experience-journey',
  name: 'Experience Journey',
  description: 'Map the full journey — from first awareness to lasting reflection',
  emoji: '🗺️',
  category: 'experience',
  elements: [
    // Container 1: Awareness
    {
      id: 'ej-awareness',
      type: 'container' as const,
      x: 50, y: 50, width: 350, height: 500,
      zIndex: 1,
      label: 'Awareness',
      tintColor: '#4B1B6B',
      collapsed: false,
      locked: false,
      style: containerStyle,
    },
    // Prompt card inside Awareness
    {
      id: 'ej-awareness-prompt-1',
      type: 'freeform' as const,
      x: 70, y: 120, width: 280, height: 120,
      zIndex: 2,
      containerId: 'ej-awareness',
      content: 'How does the audience first discover this experience? What draws their attention?',
      cardType: 'note' as const,
      locked: false,
    },
    {
      id: 'ej-awareness-prompt-2',
      type: 'freeform' as const,
      x: 70, y: 260, width: 280, height: 120,
      zIndex: 2,
      containerId: 'ej-awareness',
      content: 'What emotions or expectations are set at first contact?',
      cardType: 'note' as const,
      locked: false,
    },
    // Container 2: Consideration
    {
      id: 'ej-consideration',
      type: 'container' as const,
      x: 430, y: 50, width: 350, height: 500,
      zIndex: 1,
      label: 'Consideration',
      tintColor: '#123A5A',
      collapsed: false,
      locked: false,
      style: containerStyle,
    },
    {
      id: 'ej-consideration-prompt',
      type: 'freeform' as const,
      x: 450, y: 120, width: 280, height: 120,
      zIndex: 2,
      containerId: 'ej-consideration',
      content: 'What information does the audience need to commit? What barriers exist?',
      cardType: 'note' as const,
      locked: false,
    },
    // Container 3: Engagement
    {
      id: 'ej-engagement',
      type: 'container' as const,
      x: 810, y: 50, width: 350, height: 500,
      zIndex: 1,
      label: 'Engagement',
      tintColor: '#0F3A3A',
      collapsed: false,
      locked: false,
      style: containerStyle,
    },
    {
      id: 'ej-engagement-example',
      type: 'freeform' as const,
      x: 830, y: 120, width: 280, height: 160,
      zIndex: 2,
      containerId: 'ej-engagement',
      content: 'Example: Participants enter the space and are greeted by ambient soundscapes. Staff guide them through an orientation ritual that sets intention.',
      cardType: 'note' as const,
      locked: false,
    },
    // Container 4: Experience
    {
      id: 'ej-experience',
      type: 'container' as const,
      x: 1190, y: 50, width: 350, height: 500,
      zIndex: 1,
      label: 'Experience',
      tintColor: '#3D1E66',
      collapsed: false,
      locked: false,
      style: containerStyle,
    },
    {
      id: 'ej-experience-prompt',
      type: 'freeform' as const,
      x: 1210, y: 120, width: 280, height: 120,
      zIndex: 2,
      containerId: 'ej-experience',
      content: 'What are the peak moments? What sensory elements are present?',
      cardType: 'note' as const,
      locked: false,
    },
    // Container 5: Reflection
    {
      id: 'ej-reflection',
      type: 'container' as const,
      x: 1570, y: 50, width: 350, height: 500,
      zIndex: 1,
      label: 'Reflection',
      tintColor: '#2B1C52',
      collapsed: false,
      locked: false,
      style: containerStyle,
    },
    {
      id: 'ej-reflection-prompt',
      type: 'freeform' as const,
      x: 1590, y: 120, width: 280, height: 120,
      zIndex: 2,
      containerId: 'ej-reflection',
      content: 'How does the audience process what they experienced? What lasting impression remains?',
      cardType: 'note' as const,
      locked: false,
    },
  ],
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS (or only pre-existing errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/templates.ts
git commit -m "feat: add Experience Journey template with prompt cards"
```

---

### Task 3: Create Remaining Experience Templates

**Files:**
- Modify: `src/lib/templates.ts`

- [ ] **Step 1: Create Immersive Experience Canvas template**

Add template with zones: Concept (top-center), Audience (left), Sensory Domains (right), Spatial Layout (bottom-left), Narrative Arc (bottom-right). Include prompt cards in each zone. Follow the same pattern as Task 2 — containers with freeform card children.

- [ ] **Step 2: Create Event Blueprint template**

Add template with 3 horizontal timeline sections: Pre-Production, Live Experience, Post-Experience. Each has sub-containers for tasks, logistics, and experience moments with prompt cards.

- [ ] **Step 3: Update Service Blueprint with prompts**

Enhance the existing Service Blueprint with prompt cards inside each of the 4 layers (Customer Actions, Frontstage, Backstage, Support Processes).

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/templates.ts
git commit -m "feat: add Immersive Experience Canvas and Event Blueprint templates"
```

---

### Task 4: Create Product & Brand Templates

**Files:**
- Modify: `src/lib/templates.ts`

- [ ] **Step 1: Create Product Canvas template**

Grid layout with 6 zones: Problem (top-left), Solution (top-right), Audience (mid-left), Value Proposition (center, larger), Channels (mid-right), Metrics (bottom). Prompt cards asking "What problem are you solving?", "What does success look like?", etc. Example content in Value Proposition zone.

- [ ] **Step 2: Create Brand Experience Map template**

Sections: Brand Values (top), Touchpoints (middle row of 3-4 containers), Emotional Journey (bottom-left), Visual Identity (bottom-right). Prompt cards in each.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/templates.ts
git commit -m "feat: add Product Canvas and Brand Experience Map templates"
```

---

### Task 5: Create Creative & General Templates

**Files:**
- Modify: `src/lib/templates.ts`

- [ ] **Step 1: Create Mood Board template**

Pre-laid zones: Visual Inspiration (large, top), Color Palette (left), Typography (center), References (right), Notes (bottom). Containers sized appropriately for visual content.

- [ ] **Step 2: Update Workshop Canvas with prompts**

Enhance existing Workshop Canvas with facilitator prompt cards. Add example content in Activity 1.

- [ ] **Step 3: Create Brainstorm Board template**

Two main zones: Diverge (large, left 2/3) and Converge (right 1/3 with prioritization grid). Action Items container at bottom.

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/templates.ts
git commit -m "feat: add Mood Board, Brainstorm Board templates, enhance Workshop Canvas"
```

---

### Task 6: Upgrade Template Picker Modal

**Files:**
- Modify: `src/components/cxd/template-picker-modal.tsx`

- [ ] **Step 1: Add category tabs**

Replace the flat list with tabbed categories:

```typescript
const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'experience', label: 'Experience Design' },
  { id: 'product-brand', label: 'Product & Brand' },
  { id: 'creative', label: 'Creative & General' },
] as const;

const [activeCategory, setActiveCategory] = useState<string>('all');

const filteredTemplates = activeCategory === 'all'
  ? TEMPLATES
  : TEMPLATES.filter(t => t.category === activeCategory);
```

- [ ] **Step 2: Add thumbnail preview cards**

Replace the current list items with visual cards showing a miniature preview of the template layout:

```tsx
<div className="grid grid-cols-2 gap-4 p-4 max-h-[60vh] overflow-y-auto">
  {filteredTemplates.map((template) => (
    <button
      key={template.id}
      onClick={() => handleSelectTemplate(template)}
      className="group p-4 rounded-xl border border-white/10 hover:border-primary/40 bg-white/5 hover:bg-white/10 transition-all text-left"
    >
      {/* Mini preview showing container layout */}
      <div className="w-full h-32 rounded-lg bg-black/30 mb-3 p-2 flex gap-1">
        {template.elements
          .filter(el => el.type === 'container')
          .slice(0, 5)
          .map((el, i) => (
            <div
              key={i}
              className="flex-1 rounded bg-white/10 border border-white/5"
            />
          ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg">{template.emoji}</span>
        <div>
          <h3 className="text-sm font-medium text-white">{template.name}</h3>
          <p className="text-xs text-white/50 mt-0.5">{template.description}</p>
        </div>
      </div>
    </button>
  ))}
</div>
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/cxd/template-picker-modal.tsx
git commit -m "feat: upgrade template picker modal with categories and thumbnails"
```

---

### Task 7: Update Dashboard Template Cards

**Files:**
- Modify: `src/components/dashboard-content.tsx`

- [ ] **Step 1: Update the template gallery section**

Replace the template gallery section (~line 927-955) to show all 8 templates organized by category with better visual cards:

```tsx
{/* Template Gallery */}
<div className="space-y-4">
  <div className="flex items-center gap-2">
    <LayoutTemplate className="w-4 h-4 text-purple-400" />
    <h3 className="text-sm font-medium text-white/70">Start from a Template</h3>
  </div>

  {/* Category labels + template grid */}
  {(['experience', 'product-brand', 'creative'] as const).map(category => {
    const categoryTemplates = TEMPLATES.filter(t => t.category === category);
    const categoryLabel = category === 'experience' ? 'Experience Design'
      : category === 'product-brand' ? 'Product & Brand'
      : 'Creative & General';

    return (
      <div key={category}>
        <h4 className="text-xs uppercase text-white/40 mb-2 tracking-wide">{categoryLabel}</h4>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {categoryTemplates.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => {
                setSelectedTemplate(tpl);
                setTemplateProjectName(tpl.name);
                setTemplateDialogOpen(true);
              }}
              className="group p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-purple-500/30 transition-all text-left"
            >
              <span className="text-lg">{tpl.emoji}</span>
              <h5 className="text-sm font-medium text-white/80 mt-1">{tpl.name}</h5>
              <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{tpl.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  })}
</div>
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard-content.tsx
git commit -m "feat: update dashboard template cards with categories and all 8 templates"
```

---

### Task 8: Add Dashboard Template Gallery Page

**Files:**
- Create: `src/app/dashboard/templates/page.tsx`
- Modify: `src/components/dashboard-navbar.tsx`

- [ ] **Step 1: Create the gallery page**

Create `src/app/dashboard/templates/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { TEMPLATES, type TemplateDefinition } from "@/lib/templates";
import { useCXDStore } from "@/store/cxd-store";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORIES = [
  { id: 'all', label: 'All Templates' },
  { id: 'experience', label: 'Experience Design' },
  { id: 'product-brand', label: 'Product & Brand' },
  { id: 'creative', label: 'Creative & General' },
] as const;

export default function TemplatesGalleryPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);
  const [projectName, setProjectName] = useState('');
  const createProject = useCXDStore(s => s.createProject);
  const router = useRouter();

  const filteredTemplates = activeCategory === 'all'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === activeCategory);

  const handleCreate = () => {
    if (!selectedTemplate || !projectName.trim()) return;
    const freshElements = selectedTemplate.elements.map(el => ({
      ...el,
      id: crypto.randomUUID(),
    }));
    const projectId = createProject(projectName.trim(), '', freshElements);
    router.push(`/canvas/${projectId}`);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Templates</h1>
        <p className="text-white/50 mb-8">Choose a starting structure for your next project</p>

        {/* Category filter tabs */}
        <div className="flex gap-2 mb-8">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                activeCategory === cat.id
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <button
              key={template.id}
              onClick={() => {
                setSelectedTemplate(template);
                setProjectName(template.name);
              }}
              className="group p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-purple-500/30 transition-all text-left"
            >
              {/* Preview area */}
              <div className="w-full h-40 rounded-xl bg-black/30 mb-4 p-3 flex gap-1.5">
                {template.elements
                  .filter(el => el.type === 'container')
                  .slice(0, 6)
                  .map((_, i) => (
                    <div key={i} className="flex-1 rounded-lg bg-white/10 border border-white/5" />
                  ))}
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{template.emoji}</span>
                <div>
                  <h3 className="text-base font-medium text-white group-hover:text-primary transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-sm text-white/40 mt-1">{template.description}</p>
                  <p className="text-xs text-white/25 mt-2">
                    {template.elements.filter(el => el.type === 'container').length} sections
                    {' · '}
                    {template.elements.filter(el => el.type === 'freeform').length} prompt cards
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => { if (!open) setSelectedTemplate(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedTemplate?.emoji} Create from {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {selectedTemplate?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="gallery-project-name" className="text-white/70">Project Name</Label>
              <Input
                id="gallery-project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelectedTemplate(null)} className="text-white/60">
                Cancel
              </Button>
              <Button onClick={handleCreate} className="btn-primary-glow" disabled={!projectName.trim()}>
                Create Canvas
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Unlock the Templates button in dashboard-navbar.tsx**

In `src/components/dashboard-navbar.tsx` (~line 254-267), change the Templates button from disabled/locked to an active link pointing to `/dashboard/templates`:

```typescript
// Change from locked styling to active link:
// The button should use router.push('/dashboard/templates') or a Link component
// Remove "cursor-not-allowed", "Coming soon" tooltip, and locked styling
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Test manually**

Run: `npm run dev`
Navigate to `/dashboard/templates`. Verify:
- Gallery page loads with all 8 templates
- Category filter tabs work
- Clicking a template opens the create dialog
- Creating from template works

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/templates/page.tsx src/components/dashboard-navbar.tsx
git commit -m "feat: add template gallery page and unlock dashboard templates button"
```
