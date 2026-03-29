# Share Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the public share page with a polished landing page, read-only framing wizard presentation, share settings modal, and collaboration request flow.

**Architecture:** Restructure the share page (`/cxd/share/[token]`) into 3 views: landing page (default), framing presentation (read-only wizard), and canvas view (existing). Add a share settings modal to the navbar for image uploads and link management. Implement a collaboration auto-add flow via URL params.

**Tech Stack:** TypeScript, Next.js, React, Zustand, Supabase Storage, TailwindCSS

---

### Task 1: Add Schema Fields and Storage

**Files:**
- Modify: `src/types/cxd-schema.ts`
- Modify: `src/lib/supabase-projects.ts`

- [ ] **Step 1: Add shareCoverImage and shareThumbnail to CXDProject**

In `src/types/cxd-schema.ts`, find the `CXDProject` interface and add:

```typescript
shareCoverImage?: string;   // URL to uploaded cover image for share page
shareThumbnail?: string;    // URL to uploaded thumbnail for share page
```

- [ ] **Step 2: Ensure save/fetch handles new fields**

In `src/lib/supabase-projects.ts`, verify `saveProject` and `fetchProjectByShareToken` pass through all project fields. Since they use spread operators on the project data, the new fields should flow through automatically. Check `fetchProjectByShareToken` returns the full project.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 4: Commit**

```bash
git add src/types/cxd-schema.ts src/lib/supabase-projects.ts
git commit -m "feat(share): add shareCoverImage and shareThumbnail to project schema"
```

---

### Task 2: Create Share Settings Modal

**Files:**
- Create: `src/components/cxd/share/share-settings-modal.tsx`
- Modify: `src/components/cxd/cxd-navbar.tsx`

- [ ] **Step 1: Create the ShareSettingsModal component**

Create `src/components/cxd/share/share-settings-modal.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { useCXDStore } from "@/store/cxd-store";
import { createClient } from "@/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Copy, RefreshCw, Trash2, Check, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createNotification } from "@/lib/notifications";

interface ShareSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ShareSettingsModal({ open, onClose }: ShareSettingsModalProps) {
  const { getCurrentProject, generateShareToken, syncUpdateProject } = useCXDStore();
  const project = getCurrentProject();
  const { toast } = useToast();
  const [uploading, setUploading] = useState<'cover' | 'thumbnail' | null>(null);
  const [copied, setCopied] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  if (!project) return null;

  const shareUrl = project.shareToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/cxd/share/${project.shareToken}`
    : null;

  const handleUpload = async (type: 'cover' | 'thumbnail', file: File) => {
    setUploading(type);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const path = `share/${project.id}/${type}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('project-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('project-assets').getPublicUrl(data.path);
      const updates = type === 'cover'
        ? { shareCoverImage: urlData.publicUrl }
        : { shareThumbnail: urlData.publicUrl };
      syncUpdateProject(updates);
      toast({ title: `${type === 'cover' ? 'Cover image' : 'Thumbnail'} uploaded` });
    } catch (err) {
      console.error('Upload error:', err);
      toast({ title: 'Upload failed', description: 'Please try again' });
    } finally {
      setUploading(null);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) {
      // Generate token first
      const token = generateShareToken();
      const url = `${window.location.origin}/cxd/share/${token}`;
      navigator.clipboard.writeText(url);
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied to clipboard" });
  };

  const handleGenerateNew = () => {
    generateShareToken();
    toast({ title: "New share link generated" });
  };

  const handleRevoke = () => {
    syncUpdateProject({ shareToken: undefined });
    toast({ title: "Share link revoked" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} modal={false}>
      <DialogContent
        className="bg-zinc-900/95 backdrop-blur-xl border-white/10 text-white sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Share Project</DialogTitle>
          <DialogDescription className="text-white/50">
            Customize how your project appears to visitors
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Cover Image */}
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium mb-2 block">Cover Image</label>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload('cover', file);
            }} />
            {project.shareCoverImage ? (
              <div className="relative w-full h-24 rounded-xl overflow-hidden border border-white/10 group">
                <img src={project.shareCoverImage} alt="Cover" className="w-full h-full object-cover" />
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={uploading === 'cover'}
                className="w-full h-24 rounded-xl border-2 border-dashed border-purple-500/20 hover:border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10 transition-all flex flex-col items-center justify-center gap-1"
              >
                <Upload className="w-5 h-5 text-white/30" />
                <span className="text-xs text-white/30">{uploading === 'cover' ? 'Uploading...' : 'Upload cover image'}</span>
              </button>
            )}
          </div>

          {/* Thumbnail */}
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium mb-2 block">Project Thumbnail</label>
            <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload('thumbnail', file);
            }} />
            {project.shareThumbnail ? (
              <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-white/10 group">
                <img src={project.shareThumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                <button
                  onClick={() => thumbInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                onClick={() => thumbInputRef.current?.click()}
                disabled={uploading === 'thumbnail'}
                className="w-32 h-20 rounded-lg border-2 border-dashed border-purple-500/20 hover:border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10 transition-all flex flex-col items-center justify-center gap-1"
              >
                <ImageIcon className="w-4 h-4 text-white/30" />
                <span className="text-[10px] text-white/30">{uploading === 'thumbnail' ? 'Uploading...' : 'Upload'}</span>
              </button>
            )}
          </div>

          {/* Share Link */}
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium mb-2 block">Share Link</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/50 overflow-hidden text-ellipsis whitespace-nowrap">
                {shareUrl || 'No link generated yet'}
              </div>
              <Button
                onClick={handleCopyLink}
                size="sm"
                className="bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white text-xs gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : shareUrl ? 'Copy' : 'Generate & Copy'}
              </Button>
            </div>
          </div>

          {/* Actions */}
          {shareUrl && (
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateNew}
                variant="outline"
                size="sm"
                className="flex-1 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 gap-1.5 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                New Link
              </Button>
              <Button
                onClick={handleRevoke}
                variant="outline"
                size="sm"
                className="border-red-500/20 text-red-400/70 hover:bg-red-500/10 gap-1.5 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Revoke
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire Share button to open modal**

In `src/components/cxd/cxd-navbar.tsx`:

1. Import the new modal: `import { ShareSettingsModal } from './share/share-settings-modal';`
2. Add state: `const [showShareModal, setShowShareModal] = useState(false);`
3. Change the Share button's `onClick` from `handleShare` to `() => setShowShareModal(true)`
4. Add the modal to the render: `<ShareSettingsModal open={showShareModal} onClose={() => setShowShareModal(false)} />`

Keep the existing `handleShare` function for now (the modal will handle link generation internally).

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 4: Commit**

```bash
git add src/components/cxd/share/share-settings-modal.tsx src/components/cxd/cxd-navbar.tsx
git commit -m "feat(share): add share settings modal with image upload and link management"
```

---

### Task 3: Redesign Share Landing Page

**Files:**
- Create: `src/components/cxd/share/share-landing-page.tsx`
- Modify: `src/app/cxd/share/[token]/page.tsx`

- [ ] **Step 1: Create ShareLandingPage component**

Create `src/components/cxd/share/share-landing-page.tsx`. This is the new default view when a visitor opens a share link. It should:

- Use `ShimmerGrid` component for the dotted background with hover animation (import from wherever the dashboard uses it — search for `ShimmerGrid` in the codebase)
- Show cover image hero at the top (from `project.shareCoverImage`) with gradient fade
- CXD branding (logo + tagline)
- Project name (large), creator name, concept excerpt from `project.intentionCore?.mainConcept`
- Thumbnail image (from `project.shareThumbnail`)
- "View Experience Design" button — gradient purple, calls `onViewFraming()`
- "View Canvas" button — glass-morphism border, calls `onViewCanvas()`
- Divider
- "Request to Collaborate" button — gradient purple/pink border, navigates to sign-up with `returnTo` param
- "Create your own experience design →" text link — navigates to home page

Props:
```typescript
interface ShareLandingPageProps {
  project: CXDProject;
  onViewFraming: () => void;
  onViewCanvas: () => void;
  shareToken: string;
}
```

Style the component to match the dashboard aesthetic — dark background, glass-morphism cards, gradient borders, ShimmerGrid behind content.

- [ ] **Step 2: Update share page to use 3 view modes**

In `src/app/cxd/share/[token]/page.tsx`, change the `ViewMode` type from `'summary' | 'canvas'` to `'landing' | 'framing' | 'canvas'`. Default to `'landing'`.

Replace the existing header and content with:
- `landing` → `<ShareLandingPage>` (new component)
- `framing` → `<ShareFramingPresentation>` (Task 4)
- `canvas` → `<CXDCanvasReadOnly>` (existing, keep the header with back button and READ ONLY badge)

For `framing` and `canvas` views, add a minimal header bar with a "Back to overview" button, project name, and READ ONLY badge.

- [ ] **Step 3: Handle ?join=true for collaboration auto-add**

In the share page component, check for `?join=true` URL param on load. If present and the user is authenticated:
1. Check if user is already a collaborator
2. If not, add them as a collaborator via Supabase
3. Send notification to project owner
4. Redirect to `/cxd` with the project loaded

Use `useSearchParams()` from `next/navigation` to read the param. Use Supabase client to check auth and add collaborator.

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 5: Commit**

```bash
git add src/components/cxd/share/share-landing-page.tsx src/app/cxd/share/[token]/page.tsx
git commit -m "feat(share): redesign share page with landing page and collaboration flow"
```

---

### Task 4: Create Read-Only Framing Presentation

**Files:**
- Create: `src/components/cxd/share/share-framing-presentation.tsx`

- [ ] **Step 1: Create ShareFramingPresentation component**

Create `src/components/cxd/share/share-framing-presentation.tsx`. This is a read-only version of the framing wizard that displays the user's framing data as a polished presentation.

Key requirements:
- Import `WIZARD_STEPS` and `WIZARD_PHASES` data (WIZARD_STEPS from `src/types/cxd-schema.ts`, WIZARD_PHASES pattern from `cxd-wizard.tsx`)
- Reuse the same **Lucide icons** from the wizard: `Target` (Intent), `Sparkles` (Objectives), `Users` (Audience), `Globe` (World), `BookOpen` (Story), `Wand2` (Magic), `Layers` (Reality Planes), `Eye` (Sensory), `Radio` (Presence), `Brain` (State Mapping), `Heart` (Trait Mapping)
- Same **step navigation tabs** — pill-shaped tab bar across the top showing all 11 steps with icons
- Same **ghost gradient border** styling on content cards (dashed borders with gradient coloring matching the wizard)
- Same **prev/next circular buttons** on the sides
- Same **step counter** ("Step 1 of 11")
- **ShimmerGrid** background with hover animation
- **Read-only content**: Instead of input fields, show the actual data from the project's framing fields as styled text. If a field is empty, show "Not yet defined" in subtle italic.

Props:
```typescript
interface ShareFramingPresentationProps {
  project: CXDProject;
  onBack: () => void;  // returns to landing page
}
```

The component should read framing data from:
- `project.intentionCore` — projectName, mainConcept, coreMessage
- `project.desiredChange` — insights, feelings, states, knowledge
- `project.humanContext` — audienceNeeds, audienceDesires, userRole
- `project.contextAndMeaning` — world, story, magic
- `project.realityPlanes` — the reality planes data
- `project.sensoryDomains` — sensory domain settings
- `project.presenceTypes` — presence type settings
- `project.stateMapping` — state quadrant data
- `project.traitMapping` — trait quadrant data

Each step renders its content in gradient-bordered cards matching the wizard's visual style. Look at the wizard's actual rendering for each step (lines ~200-600 in `cxd-wizard.tsx`) and replicate the layout with static text instead of inputs.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/components/cxd/share/share-framing-presentation.tsx
git commit -m "feat(share): add read-only framing presentation with wizard styling"
```

---

### Task 5: Wire Everything Together and Polish

**Files:**
- Modify: `src/app/cxd/share/[token]/page.tsx`
- Modify: `src/components/cxd/cxd-canvas-readonly.tsx`

- [ ] **Step 1: Import and wire the framing presentation**

In `src/app/cxd/share/[token]/page.tsx`, import `ShareFramingPresentation` and render it when `viewMode === 'framing'`:

```tsx
import { ShareFramingPresentation } from '@/components/cxd/share/share-framing-presentation';

// In the render:
{viewMode === 'framing' && (
  <ShareFramingPresentation project={project} onBack={() => setViewMode('landing')} />
)}
```

- [ ] **Step 2: Add back button and ShimmerGrid to canvas view**

In `src/components/cxd/cxd-canvas-readonly.tsx` or in the share page wrapper for the canvas view, add:
- A "Back to overview" button that returns to the landing page
- A "READ ONLY" badge (if not already present)

- [ ] **Step 3: Test the full flow**

Run: `npm run dev`

Test:
1. Open a project → click Share button → settings modal opens
2. Upload cover image and thumbnail → images appear in modal
3. Copy link → open in incognito/new browser
4. Landing page shows: cover image, project name, thumbnail, view buttons, CTA
5. Click "View Experience Design" → framing presentation with all 11 steps
6. Navigate through steps with tabs and prev/next
7. Click back → returns to landing
8. Click "View Canvas" → read-only canvas
9. Click "Request to Collaborate" → redirects to sign-up

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(share): wire all share page components and polish"
```
