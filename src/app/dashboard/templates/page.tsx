'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardNavbar from '@/components/dashboard-navbar';
import { ShimmerGrid } from '@/components/ui/shimmer-grid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import {
  TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  instantiateTemplate,
} from '@/lib/templates';
import type { TemplateCategory, TemplateDefinition } from '@/lib/templates';
import { useCXDStore } from '@/store/cxd-store';

type FilterTab = 'all' | TemplateCategory;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All Templates' },
  { key: 'experience', label: 'Experience Design' },
  { key: 'product-brand', label: 'Product & Brand' },
  { key: 'creative', label: 'Creative & General' },
];

/** SVG mini-preview of the template layout */
function TemplatePreview({ template }: { template: TemplateDefinition }) {
  const containers = template.elements.filter(
    (el) => el.type === 'container' && !('containerId' in el && el.containerId),
  );
  if (containers.length === 0) return null;

  const minX = Math.min(...containers.map((c) => c.x));
  const minY = Math.min(...containers.map((c) => c.y));
  const maxX = Math.max(...containers.map((c) => c.x + c.width));
  const maxY = Math.max(...containers.map((c) => c.y + c.height));
  const bw = maxX - minX || 1;
  const bh = maxY - minY || 1;

  return (
    <svg
      viewBox={`0 0 ${bw} ${bh}`}
      className="w-full h-32 mb-3"
      preserveAspectRatio="xMidYMid meet"
    >
      {containers.map((c) => (
        <rect
          key={c.id}
          x={c.x - minX}
          y={c.y - minY}
          width={c.width}
          height={c.height}
          rx={6}
          fill="rgba(139,92,246,0.10)"
          stroke="rgba(139,92,246,0.30)"
          strokeWidth={Math.max(bw, bh) * 0.005}
          strokeDasharray={`${Math.max(bw, bh) * 0.012} ${Math.max(bw, bh) * 0.008}`}
        />
      ))}
    </svg>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const createProject = useCXDStore((s) => s.createProject);

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);
  const [projectName, setProjectName] = useState('');

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return TEMPLATES;
    return TEMPLATES.filter((t) => t.category === activeFilter);
  }, [activeFilter]);

  const grouped = useMemo(() => {
    const cats: TemplateCategory[] = ['experience', 'product-brand', 'creative'];
    return cats
      .map((cat) => ({
        category: cat,
        label: TEMPLATE_CATEGORY_LABELS[cat],
        templates: filtered.filter((t) => t.category === cat),
      }))
      .filter((g) => g.templates.length > 0);
  }, [filtered]);

  const handleCreate = async () => {
    if (!selectedTemplate || !projectName.trim()) return;

    const { elements: freshElements, edges: freshEdges } = instantiateTemplate(selectedTemplate);

    // We need a userId — get from supabase auth state via the store or fallback
    // The createProject store action requires ownerId; use a placeholder that
    // the server sync will resolve. Dashboard pages are protected so user is authed.
    const userId =
      useCXDStore.getState().projects[0]?.ownerId ?? 'pending';

    createProject(projectName.trim(), userId, freshElements, freshEdges);
    setProjectName('');
    setSelectedTemplate(null);
    setDialogOpen(false);
    router.push('/cxd');
  };

  return (
    <div className="min-h-screen bg-black">
      <ShimmerGrid
        dotSize={1.5}
        dotSpacing={24}
        baseColor="rgba(110, 56, 236, 0.1)"
        hoverColor="rgba(138, 99, 255, 0.5)"
        hoverSize={400}
        smoothing={60}
      />
      <DashboardNavbar />

      <div className="relative z-10 container mx-auto max-w-6xl px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Templates</h1>
          <p className="text-white/50 text-sm mt-1">
            Choose a starting structure for your next canvas
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-8">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                activeFilter === tab.key
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-200'
                  : 'bg-white/[0.03] border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Template grid by category */}
        {grouped.map((group) => (
          <div key={group.category} className="mb-10">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
              {group.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {group.templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(tpl);
                    setProjectName(tpl.name);
                    setDialogOpen(true);
                  }}
                  className="flex flex-col rounded-xl border border-white/10 bg-black/30 p-5 text-left transition-all hover:border-purple-500/40 hover:bg-purple-500/5 group"
                >
                  <TemplatePreview template={tpl} />
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">{tpl.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-purple-200 transition-colors">
                        {tpl.name}
                      </p>
                      <p className="text-xs text-white/50 mt-1 line-clamp-2">
                        {tpl.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto pt-3 self-end">
                    <span className="text-xs text-purple-400 group-hover:text-purple-300 transition-colors">
                      Use template →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Create dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setProjectName('');
            setSelectedTemplate(null);
          }
        }}
      >
        <DialogContent className="bg-zinc-900/95 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate?.emoji} Create from {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {selectedTemplate?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-project-name" className="text-white/70">
                Project Name
              </Label>
              <Input
                id="tpl-project-name"
                placeholder="Enter project name..."
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="text-white/60 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                className="btn-primary-glow"
                disabled={!projectName.trim()}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Canvas
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
