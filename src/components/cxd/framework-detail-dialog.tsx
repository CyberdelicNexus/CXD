'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Crown, ExternalLink, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TemplateMiniPreview } from '@/components/cxd/template-mini-preview';
import { FRAMEWORK_STAGE_LABELS } from '@/lib/templates';
import type { TemplateDefinition } from '@/lib/templates';

export type FrameworkDialogMode = 'create' | 'insert';

interface FrameworkDetailDialogProps {
  /** Must have `framework`; the dialog renders nothing otherwise. */
  template: TemplateDefinition | null;
  open: boolean;
  onClose: () => void;
  mode: FrameworkDialogMode;
  /** Pro-gated and the viewer is on the free tier. Explainer stays readable. */
  locked: boolean;
  /** Radix modal mode: adds the scrim, scroll lock and click blocking. Off by default for the in-canvas picker. */
  modal?: boolean;
  /** The primary action can't run yet (async work in flight, plan still loading). */
  busy?: boolean;
  onCreate?: (projectName: string) => void;
  onInsert?: () => void;
  onUpgrade?: () => void;
}

/** Touch keyboards shouldn't pop open over the explainer. */
const hasFinePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">{heading}</h3>
      {children}
    </section>
  );
}

export function FrameworkDetailDialog({
  template, open, onClose, mode, locked, modal = false, busy = false, onCreate, onInsert, onUpgrade,
}: FrameworkDetailDialogProps) {
  const [projectName, setProjectName] = useState('');

  // Prefill the project name with the framework name each time a template opens.
  useEffect(() => {
    if (open && template) setProjectName(template.name);
  }, [open, template]);

  const fw = template?.framework;
  if (!template || !fw) return null;

  const canSubmit = !busy && (mode !== 'create' || projectName.trim().length > 0);

  const primary = () => {
    if (locked) { onUpgrade?.(); return; }
    if (mode === 'create') onCreate?.(projectName.trim());
    else onInsert?.();
  };

  const primaryLabel = locked
    ? 'Upgrade to use'
    : mode === 'create' ? 'Create canvas'
    : 'Insert into canvas';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} modal={modal}>
      <DialogContent
        className="bg-zinc-900/95 border-white/10 text-white sm:max-w-3xl max-h-[88dvh] overflow-hidden flex flex-col"
        onPointerDownOutside={modal ? undefined : (e) => e.preventDefault()}
        onInteractOutside={modal ? undefined : (e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none shrink-0">{template.emoji}</span>
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {template.name}
                <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-[10px] font-semibold text-purple-200 uppercase tracking-wide">
                  {FRAMEWORK_STAGE_LABELS[fw.stage]}
                </span>
                {locked && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-semibold text-amber-300 uppercase tracking-wide">
                    <Crown className="w-3 h-3" /> Pro
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-white/50 text-xs mt-1">
                {fw.origin}
                {fw.sourceUrl && (
                  <>
                    {' · '}
                    <a
                      href={fw.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-200 underline-offset-2 hover:underline"
                    >
                      Source <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div
          tabIndex={0}
          role="region"
          aria-label={`About ${template.name}`}
          className="overflow-y-auto flex-1 -mx-1 px-1 py-2 rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400/40"
        >
          <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6">
            <div className="space-y-6">
              <Section heading="What it is">
                <p className="text-sm text-white/75 leading-relaxed">{fw.whatItIs}</p>
              </Section>
              <Section heading="When to use it">
                <ul className="space-y-1.5">
                  {fw.whenToUse.map((item) => (
                    <li key={item} className="text-sm text-white/70 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[0.55em] before:w-1.5 before:h-1.5 before:rounded-full before:bg-purple-400/70">
                      {item}
                    </li>
                  ))}
                </ul>
              </Section>
              <Section heading="How to run it">
                <ol className="space-y-3">
                  {fw.steps.map((step, i) => (
                    <li key={step.title} className="flex gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-semibold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{step.title}</p>
                        <p className="text-sm text-white/60 leading-relaxed">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
              <Section heading="Watch out for">
                <ul className="space-y-1.5">
                  {fw.pitfalls.map((item) => (
                    <li key={item} className="text-sm text-white/70 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[0.55em] before:w-1.5 before:h-1.5 before:rounded-full before:bg-amber-400/70">
                      {item}
                    </li>
                  ))}
                </ul>
              </Section>
            </div>

            <aside className="order-first md:order-none md:border-l md:border-white/10 md:pl-6">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">The canvas you get</h3>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <TemplateMiniPreview template={template} className="w-full h-28" />
              </div>
              <p className="text-xs text-white/50 mt-3 leading-relaxed">{template.description}. Step cards along the top mirror the steps here, and the Canvas Assistant coaches inside this method.</p>
            </aside>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-end gap-3">
          {mode === 'create' && !locked && (
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="fw-project-name" className="text-white/70 text-xs">Project name</Label>
              <Input
                id="fw-project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) primary(); }}
                placeholder="Enter project name…"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                autoFocus={hasFinePointer()}
              />
            </div>
          )}
          <div className="flex gap-2 justify-end sm:ml-auto">
            <Button variant="ghost" onClick={onClose} className="text-white/60 hover:text-white">
              Cancel
            </Button>
            <Button
              onClick={primary}
              disabled={!canSubmit}
              className={locked ? 'bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30' : 'btn-primary-glow'}
            >
              {locked ? <Crown className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {primaryLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
