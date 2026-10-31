'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Plus, Crown } from 'lucide-react';
import {
  TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  FRAMEWORK_STAGE_LABELS,
  frameworkTemplatesByStage,
  instantiateTemplate,
  isTemplateFree,
} from '@/lib/templates';
import type { TemplateCategory, TemplateDefinition } from '@/lib/templates';
import { FrameworkDetailDialog } from '@/components/cxd/framework-detail-dialog';
import { TemplateMiniPreview } from '@/components/cxd/template-mini-preview';
import { useCXDStore } from '@/store/cxd-store';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeModal } from '@/components/upgrade-modal';
import { createClient } from '@/supabase/client';

type FilterTab = 'all' | TemplateCategory;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All Templates' },
  { key: 'experience', label: 'Experience Design' },
  { key: 'product-brand', label: 'Product & Brand' },
  { key: 'creative', label: 'Creative & General' },
  { key: 'framework', label: 'Frameworks' },
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
  const [upgradeFeature, setUpgradeFeature] = useState<'templates' | 'unlimitedCanvases' | null>(null);
  const [detailTemplate, setDetailTemplate] = useState<TemplateDefinition | null>(null);
  const [creating, setCreating] = useState(false);
  // The ref is the synchronous double-submit lock; `creating` only drives the UI.
  const creatingRef = useRef(false);
  // Set when the user backs out mid-create, so a resolved create doesn't teleport them to /cxd.
  const createDismissedRef = useRef(false);
  const { templateAccess, canCreateCanvas, isLoading: subscriptionLoading, error: subscriptionError } = useSubscription();

  useEffect(() => () => { createDismissedRef.current = true; }, []);

  const isLocked = (templateId: string) =>
    templateAccess !== 'full' && !isTemplateFree(templateId);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return TEMPLATES;
    return TEMPLATES.filter((t) => t.category === activeFilter);
  }, [activeFilter]);

  type Group = { key: string; label: string; templates: TemplateDefinition[] };
  const grouped = useMemo<Group[]>(() => {
    if (activeFilter === 'framework') {
      return frameworkTemplatesByStage().map((g) => ({ key: `stage-${g.stage}`, label: g.label, templates: g.templates }));
    }
    const cats: TemplateCategory[] = ['experience', 'product-brand', 'creative', 'framework'];
    return cats
      .map((cat) => ({
        key: cat,
        label: TEMPLATE_CATEGORY_LABELS[cat],
        templates: filtered.filter((t) => t.category === cat),
      }))
      .filter((g) => g.templates.length > 0);
  }, [filtered, activeFilter]);

  const closeCreateDialog = () => {
    createDismissedRef.current = true;
    setDialogOpen(false);
    setProjectName('');
    setSelectedTemplate(null);
  };

  const closeDetailDialog = () => {
    createDismissedRef.current = true;
    setDetailTemplate(null);
  };

  const createFromTemplate = async (tpl: TemplateDefinition, name: string) => {
    const trimmedName = name.trim();
    // The plan reads as free until useSubscription settles; the submit buttons
    // stay disabled until then so Pro users never hit a false wall.
    if (!trimmedName || creatingRef.current || subscriptionLoading) return;
    if (isLocked(tpl.id)) {
      setUpgradeFeature('templates');
      return;
    }

    creatingRef.current = true;
    createDismissedRef.current = false;
    setCreating(true);
    try {
      // `projects` isn't persisted and this page never loads them, so the owner
      // and the canvas count both have to come from the server. insertProject
      // and saveProject silently skip an invalid owner, so never guess one here.
      const supabase = createClient();
      const user = await supabase.auth.getUser().then((res) => res.data.user).catch(() => null);
      if (createDismissedRef.current) return;
      if (!user) {
        router.replace('/sign-in');
        return;
      }

      const { count, error } = await supabase
        .from('cxd_projects')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id);
      if (createDismissedRef.current) return;

      // Fail open like the dashboard, whose count falls back to 0 when the list
      // fetch errors: a flaky read, of the count or the plan, shouldn't wall off a paying user.
      if (error) {
        console.error('[templates] Failed to count owned canvases:', error);
      } else if (!subscriptionError && !canCreateCanvas(count ?? 0)) {
        setDialogOpen(false);
        setDetailTemplate(null);
        setUpgradeFeature('unlimitedCanvases');
        return;
      }

      const { elements: freshElements, edges: freshEdges } = instantiateTemplate(tpl);
      createProject(
        trimmedName,
        user.id,
        freshElements,
        freshEdges,
        tpl.framework ? { frameworkIds: [tpl.id] } : undefined,
      );
      setProjectName('');
      setSelectedTemplate(null);
      setDialogOpen(false);
      setDetailTemplate(null);
      router.push('/cxd');
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const handleCreate = () => {
    if (!selectedTemplate) return;
    void createFromTemplate(selectedTemplate, projectName);
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
          <div key={group.key} className="mb-10">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
              {group.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {group.templates.map((tpl) => {
                const locked = isLocked(tpl.id);
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      if (tpl.framework) {
                        setDetailTemplate(tpl);
                        return;
                      }
                      if (locked) {
                        setUpgradeFeature('templates');
                        return;
                      }
                      setSelectedTemplate(tpl);
                      setProjectName(tpl.name);
                      setDialogOpen(true);
                    }}
                    className={`relative flex flex-col rounded-xl border border-white/10 bg-black/30 p-5 text-left transition-all group ${
                      locked
                        ? 'hover:border-amber-400/40 hover:bg-amber-500/5'
                        : 'hover:border-purple-500/40 hover:bg-purple-500/5'
                    }`}
                  >
                    {locked && (
                      <span className="absolute top-4 right-4 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-semibold text-amber-300 uppercase tracking-wide">
                        <Crown className="w-3 h-3" />
                        Pro
                      </span>
                    )}
                    {tpl.framework ? (
                      <TemplateMiniPreview template={tpl} className="w-full h-32 mb-3" />
                    ) : (
                      <TemplatePreview template={tpl} />
                    )}
                    <div className="flex items-start gap-3">
                      <span className="text-2xl shrink-0">{tpl.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white group-hover:text-purple-200 transition-colors flex items-center gap-2 flex-wrap">
                          {tpl.name}
                          {tpl.framework && (
                            <span className="px-1.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-[10px] font-semibold text-purple-200 uppercase tracking-wide">
                              {FRAMEWORK_STAGE_LABELS[tpl.framework.stage]}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-white/50 mt-1 line-clamp-2">
                          {tpl.description}
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto pt-3 self-end">
                      <span className={`text-xs transition-colors ${
                        locked
                          ? 'text-amber-400/80 group-hover:text-amber-300'
                          : 'text-purple-400 group-hover:text-purple-300'
                      }`}>
                        {tpl.framework
                          ? (locked ? 'Learn more →' : 'Learn & use →')
                          : (locked ? 'Upgrade to use' : 'Use template →')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Create dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (open) setDialogOpen(true);
          else closeCreateDialog();
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
                onClick={closeCreateDialog}
                className="text-white/60 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                className="btn-primary-glow"
                disabled={!projectName.trim() || creating || subscriptionLoading}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Canvas
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FrameworkDetailDialog
        template={detailTemplate}
        open={detailTemplate !== null}
        onClose={closeDetailDialog}
        mode="create"
        modal
        busy={creating || subscriptionLoading}
        locked={detailTemplate ? isLocked(detailTemplate.id) : false}
        onCreate={(name) => { if (detailTemplate) void createFromTemplate(detailTemplate, name); }}
        onUpgrade={() => { setDetailTemplate(null); setUpgradeFeature('templates'); }}
      />

      <UpgradeModal
        isOpen={upgradeFeature !== null}
        onClose={() => setUpgradeFeature(null)}
        feature={upgradeFeature ?? undefined}
      />
    </div>
  );
}
