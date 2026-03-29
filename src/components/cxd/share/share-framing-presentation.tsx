'use client';

import { useState, useMemo } from 'react';
import {
  CXDProject,
  REALITY_PLANES,
  SENSORY_DOMAINS,
  PRESENCE_TYPES,
  RealityPlaneCode,
} from '@/types/cxd-schema';
import { ShimmerGrid } from '@/components/ui/shimmer-grid';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Target,
  Lightbulb,
  Users,
  Globe,
  BookOpen,
  Wand2,
  Layers,
  Eye,
  Radio,
  Brain,
  Heart,
  ChevronDown,
  Clock,
  Boxes,
  Route,
} from 'lucide-react';

// Section definitions for the sidebar accordion
interface SectionDef {
  id: string;
  title: string;
  icon: React.ReactNode;
  getPreview: (project: CXDProject) => string;
  hasData: (project: CXDProject) => boolean;
  renderContent: (project: CXDProject) => React.ReactNode;
}

function ReadOnlyField({ label, value }: { label: string; value: string | undefined }) {
  const hasContent = value && value.trim().length > 0;
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</div>
      <div
        className={cn(
          'rounded-lg px-3 py-2.5 text-sm leading-relaxed border border-white/5 bg-white/[0.03]',
          hasContent ? 'text-white/80 whitespace-pre-wrap' : 'italic text-white/20',
        )}
      >
        {hasContent ? value : 'Not yet defined'}
      </div>
    </div>
  );
}

function truncate(str: string | undefined, len: number): string {
  if (!str || str.trim().length === 0) return 'Not yet defined';
  const trimmed = str.trim();
  return trimmed.length > len ? trimmed.slice(0, len) + '...' : trimmed;
}

const SECTIONS: SectionDef[] = [
  {
    id: 'intention',
    title: 'Intention Core',
    icon: <Target className="w-4 h-4" />,
    getPreview: (p) => truncate(p.intentionCore?.coreMessage || p.intentionCore?.mainConcept, 50),
    hasData: (p) => !!(p.intentionCore?.projectName || p.intentionCore?.mainConcept || p.intentionCore?.coreMessage),
    renderContent: (p) => (
      <div className="space-y-3">
        <ReadOnlyField label="Project Name" value={p.intentionCore?.projectName || p.name} />
        <ReadOnlyField label="Main Concept" value={p.intentionCore?.mainConcept} />
        <ReadOnlyField label="Core Message" value={p.intentionCore?.coreMessage} />
      </div>
    ),
  },
  {
    id: 'change',
    title: 'Desired Change',
    icon: <Lightbulb className="w-4 h-4" />,
    getPreview: (p) => truncate(p.desiredChange?.insights || p.desiredChange?.feelings, 50),
    hasData: (p) => !!(p.desiredChange?.insights || p.desiredChange?.feelings || p.desiredChange?.states || p.desiredChange?.knowledge),
    renderContent: (p) => (
      <div className="space-y-3">
        <ReadOnlyField label="Insights" value={p.desiredChange?.insights} />
        <ReadOnlyField label="Feelings" value={p.desiredChange?.feelings} />
        <ReadOnlyField label="States" value={p.desiredChange?.states} />
        <ReadOnlyField label="Knowledge" value={p.desiredChange?.knowledge} />
      </div>
    ),
  },
  {
    id: 'human',
    title: 'Human Context',
    icon: <Users className="w-4 h-4" />,
    getPreview: (p) => truncate(p.humanContext?.audienceNeeds || p.humanContext?.userRole, 50),
    hasData: (p) => !!(p.humanContext?.audienceNeeds || p.humanContext?.audienceDesires || p.humanContext?.userRole),
    renderContent: (p) => (
      <div className="space-y-3">
        <ReadOnlyField label="Audience Needs" value={p.humanContext?.audienceNeeds} />
        <ReadOnlyField label="Audience Desires" value={p.humanContext?.audienceDesires} />
        <ReadOnlyField label="User Role" value={p.humanContext?.userRole} />
      </div>
    ),
  },
  {
    id: 'world',
    title: 'World',
    icon: <Globe className="w-4 h-4" />,
    getPreview: (p) => truncate(p.contextAndMeaning?.world, 50),
    hasData: (p) => !!(p.contextAndMeaning?.world && p.contextAndMeaning.world.trim()),
    renderContent: (p) => (
      <ReadOnlyField label="World Description" value={p.contextAndMeaning?.world} />
    ),
  },
  {
    id: 'story',
    title: 'Story',
    icon: <BookOpen className="w-4 h-4" />,
    getPreview: (p) => truncate(p.contextAndMeaning?.story, 50),
    hasData: (p) => !!(p.contextAndMeaning?.story && p.contextAndMeaning.story.trim()),
    renderContent: (p) => (
      <ReadOnlyField label="Narrative Arc" value={p.contextAndMeaning?.story} />
    ),
  },
  {
    id: 'magic',
    title: 'Magic',
    icon: <Wand2 className="w-4 h-4" />,
    getPreview: (p) => truncate(p.contextAndMeaning?.magic, 50),
    hasData: (p) => !!(p.contextAndMeaning?.magic && p.contextAndMeaning.magic.trim()),
    renderContent: (p) => (
      <ReadOnlyField label="Transformation Mechanism" value={p.contextAndMeaning?.magic} />
    ),
  },
  {
    id: 'flow',
    title: 'Experience Flow',
    icon: <Route className="w-4 h-4" />,
    getPreview: (p) => {
      const stages = p.experienceFlowStages;
      if (stages && stages.length > 0) {
        return stages.map((s) => s.name).join(' / ');
      }
      return 'Default 5-stage flow';
    },
    hasData: (p) => !!(p.experienceFlowStages && p.experienceFlowStages.length > 0),
    renderContent: (p) => {
      const stages = p.experienceFlowStages || [];
      return (
        <div className="space-y-2">
          {stages.map((stage, i) => (
            <div
              key={stage.id}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-white/[0.02]"
            >
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/80">{stage.name}</div>
                {stage.narrativeNotes && (
                  <div className="text-xs text-white/40 truncate">{stage.narrativeNotes}</div>
                )}
              </div>
              {stage.estimatedMinutes != null && (
                <div className="flex items-center gap-1 text-xs text-white/30">
                  <Clock className="w-3 h-3" />
                  {stage.estimatedMinutes}m
                </div>
              )}
            </div>
          ))}
        </div>
      );
    },
  },
  {
    id: 'reality',
    title: 'Reality Planes',
    icon: <Layers className="w-4 h-4" />,
    getPreview: (p) => {
      const v2 = p.realityPlanesV2;
      if (v2 && v2.length > 0) {
        const enabled = v2.filter((pl) => pl.enabled);
        if (enabled.length > 0) {
          return enabled.map((pl) => {
            const label = REALITY_PLANES.find((r) => r.code === pl.code)?.label || pl.code;
            return label;
          }).join(', ');
        }
      }
      return 'Not yet defined';
    },
    hasData: (p) => !!(p.realityPlanesV2 && p.realityPlanesV2.some((pl) => pl.enabled)),
    renderContent: (p) => {
      const v2 = p.realityPlanesV2;
      if (!v2 || v2.length === 0) return <div className="text-sm text-white/30 italic">Not yet defined</div>;
      const sorted = [...v2].sort((a, b) => a.priority - b.priority);
      return (
        <div className="space-y-2">
          {sorted.filter((pl) => pl.enabled).map((plane) => {
            const meta = REALITY_PLANES.find((r) => r.code === plane.code);
            return (
              <div key={plane.code} className="flex items-center gap-3 p-2 rounded-lg border border-white/5 bg-white/[0.02]">
                <span className="font-mono text-xs font-bold text-violet-300 w-7">{plane.code}</span>
                <span className="text-sm text-white/70 flex-1">{meta?.label || plane.code}</span>
                {plane.interfaceModality && plane.interfaceModality.trim() && (
                  <span className="text-xs text-white/40 max-w-[200px] truncate">{plane.interfaceModality}</span>
                )}
              </div>
            );
          })}
        </div>
      );
    },
  },
  {
    id: 'sensory',
    title: 'Sensory Domains',
    icon: <Eye className="w-4 h-4" />,
    getPreview: (p) => {
      const active = SENSORY_DOMAINS.filter((d) => (p.sensoryDomains[d.code] ?? 0) > 0);
      if (active.length > 0) return active.map((d) => d.label).join(', ');
      return 'Not yet defined';
    },
    hasData: (p) => SENSORY_DOMAINS.some((d) => (p.sensoryDomains[d.code] ?? 0) > 0),
    renderContent: (p) => (
      <div className="space-y-2">
        {SENSORY_DOMAINS.map((domain) => {
          const val = p.sensoryDomains[domain.code] ?? 0;
          return (
            <div key={domain.code} className="flex items-center gap-3 p-2 rounded-lg border border-white/5 bg-white/[0.02]">
              <span className="text-sm text-white/70 flex-1">{domain.label}</span>
              <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400" style={{ width: `${val}%` }} />
              </div>
              <span className="text-xs text-white/40 w-8 text-right">{val}%</span>
            </div>
          );
        })}
      </div>
    ),
  },
  {
    id: 'presence',
    title: 'Presence Types',
    icon: <Radio className="w-4 h-4" />,
    getPreview: (p) => {
      const active = PRESENCE_TYPES.filter((pt) => (p.presenceTypes[pt.code] ?? 0) > 0);
      if (active.length > 0) return active.map((pt) => pt.label).join(', ');
      return 'Not yet defined';
    },
    hasData: (p) => PRESENCE_TYPES.some((pt) => (p.presenceTypes[pt.code] ?? 0) > 0),
    renderContent: (p) => (
      <div className="space-y-2">
        {PRESENCE_TYPES.map((presence) => {
          const val = p.presenceTypes[presence.code] ?? 0;
          return (
            <div key={presence.code} className="flex items-center gap-3 p-2 rounded-lg border border-white/5 bg-white/[0.02]">
              <span className="text-sm text-white/70 flex-1">{presence.label}</span>
              <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400" style={{ width: `${val}%` }} />
              </div>
              <span className="text-xs text-white/40 w-8 text-right">{val}%</span>
            </div>
          );
        })}
      </div>
    ),
  },
  {
    id: 'state',
    title: 'State Mapping',
    icon: <Brain className="w-4 h-4" />,
    getPreview: (p) => {
      const first = p.stateMapping?.cognitive || p.stateMapping?.emotional;
      return truncate(first, 50);
    },
    hasData: (p) => !!(p.stateMapping && Object.values(p.stateMapping).some((v) => v && v.trim())),
    renderContent: (p) => (
      <div className="space-y-3">
        <ReadOnlyField label="Cognitive" value={p.stateMapping?.cognitive} />
        <ReadOnlyField label="Emotional" value={p.stateMapping?.emotional} />
        <ReadOnlyField label="Somatic" value={p.stateMapping?.somatic} />
        <ReadOnlyField label="Relational" value={p.stateMapping?.relational} />
      </div>
    ),
  },
  {
    id: 'trait',
    title: 'Trait Mapping',
    icon: <Heart className="w-4 h-4" />,
    getPreview: (p) => {
      const first = p.traitMapping?.cognitive || p.traitMapping?.emotional;
      return truncate(first, 50);
    },
    hasData: (p) => !!(p.traitMapping && Object.values(p.traitMapping).some((v) => v && v.trim())),
    renderContent: (p) => (
      <div className="space-y-3">
        <ReadOnlyField label="Cognitive" value={p.traitMapping?.cognitive} />
        <ReadOnlyField label="Emotional" value={p.traitMapping?.emotional} />
        <ReadOnlyField label="Somatic" value={p.traitMapping?.somatic} />
        <ReadOnlyField label="Relational" value={p.traitMapping?.relational} />
      </div>
    ),
  },
];

interface ShareFramingPresentationProps {
  project: CXDProject;
  onBack: () => void;
  viewToggle?: React.ReactNode;
}

export function ShareFramingPresentation({ project, onBack, viewToggle }: ShareFramingPresentationProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  // Compute stats
  const stats = useMemo(() => {
    const stageCount = project.experienceFlowStages?.length || 5;
    const elementCount = project.canvasLayout?.elements?.length || 0;
    const enabledPlanes = project.realityPlanesV2?.filter((p) => p.enabled).length || 0;
    const activeSenses = SENSORY_DOMAINS.filter((d) => (project.sensoryDomains[d.code] ?? 0) > 0).length;
    return { stageCount, elementCount, enabledPlanes, activeSenses };
  }, [project]);

  const coreMessage = project.intentionCore?.coreMessage;
  const mainConcept = project.intentionCore?.mainConcept;

  return (
    <div className="min-h-screen relative bg-black">
      {/* ShimmerGrid background */}
      <ShimmerGrid
        dotSize={1.5}
        dotSpacing={24}
        baseColor="rgba(110, 56, 236, 0.1)"
        hoverColor="rgba(138, 99, 255, 0.5)"
        hoverSize={400}
        className="!fixed inset-0 !z-0"
      />

      {/* View toggle — centered at top */}
      {viewToggle && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30">
          {viewToggle}
        </div>
      )}

      {/* Back button — top left */}
      <div className="fixed top-4 left-4 z-30">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {/* Main layout */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Left column — Overview (~70%) */}
          <div className="flex-1 lg:max-w-[65%] space-y-8">
            {/* Project name */}
            <div className="space-y-4">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
                {project.intentionCore?.projectName || project.name}
              </h1>

              {/* Core message as quote */}
              {coreMessage && coreMessage.trim() && (
                <blockquote className="border-l-2 border-violet-500/40 pl-5 py-2">
                  <p className="text-lg md:text-xl text-white/60 italic leading-relaxed">
                    &ldquo;{coreMessage}&rdquo;
                  </p>
                </blockquote>
              )}
            </div>

            {/* Main concept */}
            {mainConcept && mainConcept.trim() && (
              <div className="space-y-2">
                <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider">Main Concept</h2>
                <p className="text-base text-white/70 leading-relaxed max-w-2xl">
                  {mainConcept}
                </p>
              </div>
            )}

            {/* Stats row */}
            <div className="flex flex-wrap gap-3">
              <StatChip icon={<Route className="w-3.5 h-3.5" />} label="Flow Stages" value={stats.stageCount} />
              <StatChip icon={<Boxes className="w-3.5 h-3.5" />} label="Canvas Elements" value={stats.elementCount} />
              <StatChip icon={<Layers className="w-3.5 h-3.5" />} label="Reality Planes" value={stats.enabledPlanes} />
              <StatChip icon={<Eye className="w-3.5 h-3.5" />} label="Active Senses" value={stats.activeSenses} />
            </div>

            {/* Experience flow description */}
            {project.experienceFlowDescription && project.experienceFlowDescription.trim() && (
              <div className="space-y-2">
                <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider">Experience Flow Overview</h2>
                <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                  {project.experienceFlowDescription}
                </p>
              </div>
            )}
          </div>

          {/* Right column — Sidebar sections (~30%) */}
          <div className="lg:w-[35%] space-y-2">
            <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-4 px-1">
              Design Sections
            </h2>
            {SECTIONS.map((section) => {
              const isExpanded = expandedSection === section.id;
              const hasData = section.hasData(project);

              return (
                <div
                  key={section.id}
                  className="glass-purple rounded-xl overflow-hidden transition-all duration-300"
                >
                  {/* Section header — clickable */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      hasData ? 'bg-violet-500/15 text-violet-400' : 'bg-white/5 text-white/20',
                    )}>
                      {section.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        'text-sm font-medium',
                        hasData ? 'text-white/80' : 'text-white/40',
                      )}>
                        {section.title}
                      </div>
                      <div className="text-xs text-white/30 truncate">
                        {section.getPreview(project)}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-white/20 flex-shrink-0 transition-transform duration-300',
                        isExpanded && 'rotate-180',
                      )}
                    />
                  </button>

                  {/* Expanded content */}
                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-300 ease-in-out',
                      isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
                    )}
                  >
                    <div className="px-4 pb-4 pt-1 border-t border-white/5">
                      {section.renderContent(project)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 backdrop-blur-sm">
      <span className="text-violet-400">{icon}</span>
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-sm font-semibold text-white/80">{value}</span>
    </div>
  );
}
