'use client';

import { useState, useMemo } from 'react';
import {
  CXDProject,
  REALITY_PLANES,
  SENSORY_DOMAINS,
  PRESENCE_TYPES,
  ENGAGEMENT_LEVELS,
  STAGE_PRESENCE_TYPES,
  STATE_QUADRANTS,
  TRAIT_QUADRANTS,
} from '@/types/cxd-schema';
import type { EngagementLevelCode, StagePresenceTypeCode } from '@/types/cxd-schema';
import type { HypercubeFaceTag } from '@/types/canvas-elements';
import { HYPERCUBE_FACE_TAGS } from '@/types/canvas-elements';
import dynamic from 'next/dynamic';

// Lazy-load Hypercube3D to avoid SSR issues with Three.js
const Hypercube3D = dynamic(
  () => import('@/components/cxd/canvas/hypercube-3d').then((mod) => mod.Hypercube3D),
  { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center text-white/20">Loading hypercube...</div> }
);
import { ShimmerGrid } from '@/components/ui/shimmer-grid';
import { cn } from '@/lib/utils';
import {
  Target,
  Lightbulb,
  Users,
  Globe,
  BookOpen,
  Wand2,
  Layers,
  Eye,
  Ear,
  Wind,
  Apple,
  Fingerprint,
  PersonStanding,
  Zap,
  Radio,
  Brain,
  Heart,
  Clock,
  Route,
  Home,
  ListTodo,
  CalendarDays,
  Boxes,
} from 'lucide-react';

// ECharts tree-shakeable imports
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { RadarChart, BarChart, PieChart, LineChart, CustomChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
echarts.use([
  RadarChart,
  BarChart,
  PieChart,
  LineChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
  CanvasRenderer,
]);

/* ── chart theme constants ─────────────────────────────────────── */

const CHART_TEXT_COLOR = 'rgba(255,255,255,0.5)';
const CHART_FONT_FAMILY = 'Inter, system-ui, sans-serif';
const TOOLTIP_BG = 'rgba(15,10,30,0.92)';
const TOOLTIP_BORDER = 'rgba(139,92,246,0.3)';
const AXIS_LABEL_COLOR = 'rgba(255,255,255,0.35)';
const GRID_LINE_COLOR = 'rgba(255,255,255,0.04)';

const tooltipStyle = {
  backgroundColor: TOOLTIP_BG,
  borderColor: TOOLTIP_BORDER,
  borderWidth: 1,
  textStyle: { color: CHART_TEXT_COLOR, fontFamily: CHART_FONT_FAMILY, fontSize: 12 },
  extraCssText: 'backdrop-filter:blur(12px);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.4);',
};

/* ── hypercube face colors ──────────────────────────────────────── */

const HYPERCUBE_FACE_COLORS: Record<HypercubeFaceTag, string> = {
  'Reality Planes': '#8B5CF6',
  'Sensory Domains': '#EC4899',
  'Presence Types': '#06B6D4',
  'State Mapping': '#F59E0B',
  'Trait Mapping': '#10B981',
  'Meaning Architecture': '#6366F1',
  'Core': '#F97316',
};

/* ── sensory/presence metadata (wizard-matching) ─────────────── */

const SENSORY_METADATA: Record<string, { icon: React.ReactNode; color: string; colorRaw: string }> = {
  visual: { icon: <Eye className="w-5 h-5" />, color: 'from-blue-950 to-blue-400', colorRaw: '59, 130, 246' },
  auditory: { icon: <Ear className="w-5 h-5" />, color: 'from-indigo-950 to-indigo-400', colorRaw: '99, 102, 241' },
  olfactory: { icon: <Wind className="w-5 h-5" />, color: 'from-teal-950 to-teal-400', colorRaw: '20, 184, 166' },
  gustatory: { icon: <Apple className="w-5 h-5" />, color: 'from-rose-950 to-rose-400', colorRaw: '244, 63, 94' },
  haptic: { icon: <Fingerprint className="w-5 h-5" />, color: 'from-purple-950 to-purple-400', colorRaw: '168, 85, 247' },
};

const PRESENCE_METADATA: Record<string, { icon: React.ReactNode; color: string; colorRaw: string }> = {
  mental: { icon: <Brain className="w-5 h-5" />, color: 'from-blue-950 to-blue-400', colorRaw: '59, 130, 246' },
  emotional: { icon: <Heart className="w-5 h-5" />, color: 'from-red-950 to-red-400', colorRaw: '239, 68, 68' },
  social: { icon: <Users className="w-5 h-5" />, color: 'from-violet-950 to-violet-400', colorRaw: '139, 92, 246' },
  embodied: { icon: <PersonStanding className="w-5 h-5" />, color: 'from-orange-950 to-orange-400', colorRaw: '249, 115, 22' },
  environmental: { icon: <Globe className="w-5 h-5" />, color: 'from-emerald-950 to-emerald-400', colorRaw: '16, 185, 129' },
  active: { icon: <Zap className="w-5 h-5" />, color: 'from-yellow-950 to-yellow-400', colorRaw: '234, 179, 8' },
};

const INTENSITY_LEVELS = [
  { value: 0, label: 'None' },
  { value: 25, label: 'Minimal' },
  { value: 50, label: 'Moderate' },
  { value: 75, label: 'Significant' },
  { value: 100, label: 'Primary' },
];

/* ── helpers ─────────────────────────────────────────────────────── */

function getClosestLevel(value: number) {
  return INTENSITY_LEVELS.reduce((prev, curr) =>
    Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev,
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string | undefined }) {
  const hasContent = value && value.trim().length > 0;
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</div>
      <div
        className={cn(
          'rounded-lg px-4 py-3 text-[15px] leading-relaxed border border-purple-500/10',
          hasContent ? 'text-white/85 whitespace-pre-wrap' : 'italic text-white/20',
        )}
        style={{ background: 'linear-gradient(135deg, rgba(18, 8, 35, 0.95) 0%, rgba(8, 4, 18, 0.9) 100%)' }}
      >
        {hasContent ? value : 'Not yet defined'}
      </div>
    </div>
  );
}

const PURPLE_CARD_STYLE: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(20, 10, 40, 0.6) 0%, rgba(12, 6, 25, 0.5) 50%, rgba(8, 4, 18, 0.6) 100%)',
  boxShadow: '0 0 10px rgba(139,92,246,0.06), inset 0 1px 0 rgba(255,255,255,0.02)',
};

const CHART_CARD_STYLE: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(8, 4, 18, 0.9) 0%, rgba(4, 2, 10, 0.85) 100%)',
  boxShadow: '0 0 10px rgba(139,92,246,0.04)',
};

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border border-purple-500/15 backdrop-blur-sm flex-1 min-w-[100px]"
      style={PURPLE_CARD_STYLE}
    >
      <span className="text-violet-400">{icon}</span>
      <span className="text-xl font-bold text-white/90">{value}</span>
      <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('rounded-lg p-3 border border-purple-500/10 backdrop-blur-md', className)}
      style={CHART_CARD_STYLE}
    >
      <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

/* ── wizard-style section renderers ─────────────────────────────── */

function WizardSensorySection({ project }: { project: CXDProject }) {
  return (
    <div className="space-y-6">
      {SENSORY_DOMAINS.map((domain) => {
        const val = project.sensoryDomains[domain.code] ?? 0;
        const closest = getClosestLevel(val);
        const meta = SENSORY_METADATA[domain.code];
        if (!meta) return null;

        return (
          <div key={domain.code} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${meta.color} bg-opacity-10 text-white shadow-sm`}>
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white/90 tracking-tight">{domain.label}</div>
                <p className="text-xs text-white/40 hidden sm:block">{domain.description}</p>
              </div>
              <span className="text-xs text-white/40 font-medium">{closest.label}</span>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2">
              {INTENSITY_LEVELS.map((level) => {
                const isSelected = closest.value === level.value;
                const baseClass = 'flex-1 py-1.5 sm:py-2.5 px-2 sm:px-3 text-[10px] sm:text-sm rounded-xl transition-all duration-300 flex items-center justify-center min-w-[55px] sm:min-w-0';
                let intensityStyle = '';

                if (isSelected) {
                  const color = meta.color;
                  const raw = meta.colorRaw;
                  if (level.value === 0) intensityStyle = 'bg-zinc-600 text-white shadow-md';
                  else if (level.value === 25) intensityStyle = `bg-gradient-to-br ${color} opacity-70 text-white shadow-sm`;
                  else if (level.value === 50) intensityStyle = `bg-gradient-to-br ${color} opacity-90 text-white shadow-[0_0_15px_rgba(${raw},0.3)]`;
                  else if (level.value === 75) intensityStyle = `bg-gradient-to-br ${color} text-white shadow-[0_0_20px_rgba(${raw},0.4)]`;
                  else if (level.value === 100) intensityStyle = `bg-gradient-to-br ${color} text-white shadow-[0_0_30px_rgba(${raw},0.6)] scale-105 font-bold border border-white/20`;
                } else {
                  intensityStyle = 'bg-secondary/40 text-muted-foreground/70';
                }

                return (
                  <div
                    key={level.value}
                    className={`${baseClass} ${intensityStyle} cursor-default`}
                  >
                    {level.label}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Radar chart */}
      <ChartCard title="Sensory Profile">
        <ReactEChartsCore
          echarts={echarts}
          option={buildSensoryRadarOption(project)}
          style={{ height: 'min(280px, 60vw)' }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>
    </div>
  );
}

function WizardPresenceSection({ project }: { project: CXDProject }) {
  return (
    <div className="space-y-6">
      {PRESENCE_TYPES.map((presence) => {
        const val = project.presenceTypes[presence.code] ?? 0;
        const closest = getClosestLevel(val);
        const meta = PRESENCE_METADATA[presence.code];
        if (!meta) return null;

        return (
          <div key={presence.code} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${meta.color} bg-opacity-10 text-white shadow-sm`}>
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white/90 tracking-tight">{presence.label}</div>
                <p className="text-xs text-white/40 hidden sm:block">{presence.description}</p>
              </div>
              <span className="text-xs text-white/40 font-medium">{closest.label}</span>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2">
              {INTENSITY_LEVELS.map((level) => {
                const isSelected = closest.value === level.value;
                const baseClass = 'flex-1 py-1.5 sm:py-2.5 px-2 sm:px-3 text-[10px] sm:text-sm rounded-xl transition-all duration-300 flex items-center justify-center min-w-[55px] sm:min-w-0';
                let intensityStyle = '';

                if (isSelected) {
                  const color = meta.color;
                  const raw = meta.colorRaw;
                  if (level.value === 0) intensityStyle = 'bg-zinc-600 text-white shadow-md';
                  else if (level.value === 25) intensityStyle = `bg-gradient-to-br ${color} opacity-70 text-white shadow-sm`;
                  else if (level.value === 50) intensityStyle = `bg-gradient-to-br ${color} opacity-90 text-white shadow-[0_0_15px_rgba(${raw},0.3)]`;
                  else if (level.value === 75) intensityStyle = `bg-gradient-to-br ${color} text-white shadow-[0_0_20px_rgba(${raw},0.4)]`;
                  else if (level.value === 100) intensityStyle = `bg-gradient-to-br ${color} text-white shadow-[0_0_30px_rgba(${raw},0.6)] scale-105 font-bold border border-white/20`;
                } else {
                  intensityStyle = 'bg-secondary/40 text-muted-foreground/70';
                }

                return (
                  <div
                    key={level.value}
                    className={`${baseClass} ${intensityStyle} cursor-default`}
                  >
                    {level.label}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Radar chart */}
      <ChartCard title="Presence Profile">
        <ReactEChartsCore
          echarts={echarts}
          option={buildPresenceRadarOption(project)}
          style={{ height: 'min(280px, 60vw)' }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>
    </div>
  );
}

function WizardRealityPlanesSection({ project }: { project: CXDProject }) {
  const v2 = project.realityPlanesV2;
  if (!v2 || v2.length === 0) return <div className="text-sm text-white/30 italic">Not yet defined</div>;
  const sorted = [...v2].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-3">
      {sorted.map((plane) => {
        const meta = REALITY_PLANES.find((r) => r.code === plane.code);
        return (
          <div
            key={plane.code}
            className="rounded-xl border border-purple-500/15 backdrop-blur-md p-4 space-y-2"
            style={PURPLE_CARD_STYLE}
          >
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
              <span className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center text-xs font-bold text-violet-300 flex-shrink-0">
                {plane.priority + 1}
              </span>
              <span className="font-mono text-xs sm:text-sm font-bold text-violet-300">{plane.code}</span>
              <span className="text-xs sm:text-sm text-white/70 flex-1 min-w-0">{meta?.label || plane.code}</span>
              <div
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border',
                  plane.enabled
                    ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/30',
                )}
              >
                {plane.enabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
            {plane.enabled && plane.interfaceModality && plane.interfaceModality.trim() && (
              <div className="ml-10 text-xs text-white/40 leading-relaxed">
                {plane.interfaceModality}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WizardStateMappingSection({ project }: { project: CXDProject }) {
  const quadrantIcons: Record<string, React.ReactNode> = {
    cognitive: <Brain className="w-4 h-4" />,
    emotional: <Heart className="w-4 h-4" />,
    somatic: <PersonStanding className="w-4 h-4" />,
    relational: <Users className="w-4 h-4" />,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {STATE_QUADRANTS.map((quadrant) => (
        <div
          key={quadrant.code}
          className="rounded-xl border border-purple-500/15 backdrop-blur-md p-4 space-y-2"
          style={PURPLE_CARD_STYLE}
        >
          <div className="flex items-center gap-2">
            <span className="text-violet-400">{quadrantIcons[quadrant.code]}</span>
            <span className="text-sm font-semibold text-white/90">{quadrant.label}</span>
          </div>
          <p className="text-[11px] text-white/30">{quadrant.description}</p>
          <div
            className={cn(
              'rounded-lg px-3 py-2.5 text-sm leading-relaxed border border-white/5 bg-white/[0.03]',
              project.stateMapping?.[quadrant.code as keyof typeof project.stateMapping]
                ? 'text-white/80 whitespace-pre-wrap'
                : 'italic text-white/20',
            )}
          >
            {project.stateMapping?.[quadrant.code as keyof typeof project.stateMapping] || 'Not yet defined'}
          </div>
        </div>
      ))}
    </div>
  );
}

function WizardTraitMappingSection({ project }: { project: CXDProject }) {
  const quadrantIcons: Record<string, React.ReactNode> = {
    cognitive: <Brain className="w-4 h-4" />,
    emotional: <Heart className="w-4 h-4" />,
    somatic: <PersonStanding className="w-4 h-4" />,
    relational: <Users className="w-4 h-4" />,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {TRAIT_QUADRANTS.map((quadrant) => (
        <div
          key={quadrant.code}
          className="rounded-xl border border-purple-500/15 backdrop-blur-md p-4 space-y-2"
          style={PURPLE_CARD_STYLE}
        >
          <div className="flex items-center gap-2">
            <span className="text-violet-400">{quadrantIcons[quadrant.code]}</span>
            <span className="text-sm font-semibold text-white/90">{quadrant.label}</span>
          </div>
          <p className="text-[11px] text-white/30">{quadrant.description}</p>
          <div
            className={cn(
              'rounded-lg px-3 py-2.5 text-sm leading-relaxed border border-white/5 bg-white/[0.03]',
              project.traitMapping?.[quadrant.code as keyof typeof project.traitMapping]
                ? 'text-white/80 whitespace-pre-wrap'
                : 'italic text-white/20',
            )}
          >
            {project.traitMapping?.[quadrant.code as keyof typeof project.traitMapping] || 'Not yet defined'}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Planning section renderer ──────────────────────────────────── */

function PlanningSection({ project }: { project: CXDProject }) {
  const [taskView, setTaskView] = useState<'kanban' | 'list' | 'timeline'>('kanban');
  const elements = project.canvasLayout?.elements || [];
  const tasks = elements.filter((el) => el.type === 'freeform' && (el.cardType === 'task' || el.taskMetadata));

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { not_started: 0, in_progress: 0, completed: 0, blocked: 0 };
    for (const t of tasks) {
      if (t.type === 'freeform') {
        const status = t.taskMetadata?.status || 'not_started';
        counts[status] = (counts[status] || 0) + 1;
      }
    }
    return counts;
  }, [tasks]);

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 };
    for (const t of tasks) {
      if (t.type === 'freeform') {
        const priority = t.taskMetadata?.priority || 'medium';
        counts[priority] = (counts[priority] || 0) + 1;
      }
    }
    return counts;
  }, [tasks]);

  if (tasks.length === 0) {
    return <div className="text-sm text-white/30 italic">No tasks defined yet</div>;
  }

  const statusColors: Record<string, string> = {
    completed: '#10B981',
    in_progress: '#3B82F6',
    not_started: '#6B7280',
    blocked: '#EF4444',
  };

  const statusLabels: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed',
    blocked: 'Blocked',
  };

  const priorityColors: Record<string, string> = {
    low: '#6B7280',
    medium: '#3B82F6',
    high: '#F59E0B',
    urgent: '#EF4444',
  };

  // Status stacked bar data
  const total = tasks.length;
  const statusBarData = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status,
      count,
      pct: Math.round((count / total) * 100),
      color: statusColors[status] || '#6B7280',
      label: statusLabels[status] || status,
    }));

  // Tasks with dates for gantt-like view
  const tasksWithDates = tasks
    .filter((t) => t.type === 'freeform' && (t.taskMetadata?.startDate || t.taskMetadata?.dueDate))
    .map((t) => {
      if (t.type !== 'freeform') return null;
      const title = t.noteTitle || t.content?.slice(0, 40) || 'Untitled';
      const start = t.taskMetadata?.startDate ? new Date(t.taskMetadata.startDate).getTime() : null;
      const due = t.taskMetadata?.dueDate ? new Date(t.taskMetadata.dueDate).getTime() : null;
      return { title, start, due, status: t.taskMetadata?.status || 'not_started' };
    })
    .filter(Boolean) as { title: string; start: number | null; due: number | null; status: string }[];

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<ListTodo className="w-4 h-4" />} label="Total Tasks" value={total} />
        <StatCard
          icon={<div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors.completed }} />}
          label="Completed"
          value={statusCounts.completed}
        />
        <StatCard
          icon={<div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors.in_progress }} />}
          label="In Progress"
          value={statusCounts.in_progress}
        />
        <StatCard
          icon={<div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors.blocked }} />}
          label="Blocked"
          value={statusCounts.blocked}
        />
      </div>

      {/* Status distribution stacked bar */}
      <ChartCard title="Task Status Distribution">
        <div className="space-y-3">
          <div className="flex h-8 rounded-lg overflow-hidden">
            {statusBarData.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-center text-[10px] font-bold text-white/90 transition-all"
                style={{ width: `${item.pct}%`, backgroundColor: item.color, minWidth: item.pct > 0 ? '24px' : '0' }}
                title={`${item.label}: ${item.count} (${item.pct}%)`}
              >
                {item.pct >= 10 ? `${item.pct}%` : ''}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {statusBarData.map((item) => (
              <div key={item.status} className="flex items-center gap-1.5 text-xs text-white/50">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                {item.label} ({item.count})
              </div>
            ))}
          </div>
        </div>
      </ChartCard>

      {/* Priority distribution bar chart */}
      <ChartCard title="Priority Distribution">
        <ReactEChartsCore
          echarts={echarts}
          option={{
            backgroundColor: 'transparent',
            textStyle: { color: CHART_TEXT_COLOR, fontFamily: CHART_FONT_FAMILY },
            tooltip: { ...tooltipStyle, trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '8%', top: '8%', containLabel: true },
            xAxis: {
              type: 'category',
              data: ['Low', 'Medium', 'High', 'Urgent'],
              axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 11 },
              axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
              axisTick: { show: false },
            },
            yAxis: {
              type: 'value',
              axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 11 },
              splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
              axisLine: { show: false },
              axisTick: { show: false },
            },
            series: [{
              type: 'bar',
              data: ['low', 'medium', 'high', 'urgent'].map((p) => ({
                value: priorityCounts[p],
                itemStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: priorityColors[p] },
                    { offset: 1, color: priorityColors[p] + '66' },
                  ]),
                  borderRadius: [4, 4, 0, 0],
                  shadowColor: priorityColors[p] + '40',
                  shadowBlur: 8,
                },
              })),
              barMaxWidth: 40,
            }],
            animation: false,
          }}
          style={{ height: '200px' }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>

      {/* Task view with filter buttons */}
      <ChartCard title="Tasks">
        {/* Filter buttons */}
        <div className="flex gap-2 mb-4">
          {(['kanban', 'list', 'timeline'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setTaskView(view)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all capitalize',
                taskView === view
                  ? 'bg-violet-500/15 border-violet-500/30 text-white'
                  : 'bg-transparent border-white/[0.06] text-white/40 hover:text-white/60 hover:bg-white/[0.04]',
              )}
            >
              {view}
            </button>
          ))}
        </div>

        {/* Kanban view */}
        {taskView === 'kanban' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {['not_started', 'in_progress', 'completed', 'blocked'].map((status) => {
              const columnTasks = tasks.filter((t) => t.type === 'freeform' && (t.taskMetadata?.status || 'not_started') === status);
              return (
                <div key={status} className="space-y-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[status] }} />
                    <span className="text-xs font-medium text-white/60">{statusLabels[status]}</span>
                    <span className="text-[10px] text-white/30 ml-auto">{columnTasks.length}</span>
                  </div>
                  <div className="space-y-1.5 min-h-[60px]">
                    {columnTasks.map((t) => {
                      if (t.type !== 'freeform') return null;
                      const title = t.noteTitle || t.content?.slice(0, 40) || 'Untitled';
                      const priority = t.taskMetadata?.priority || 'medium';
                      return (
                        <div key={t.id} className="px-2.5 py-2 rounded-lg border border-purple-500/10 transition-colors" style={{ background: 'rgba(18,8,35,0.8)' }}>
                          <p className="text-xs text-white/70 leading-relaxed truncate">{title}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priorityColors[priority] }} />
                            <span className="text-[10px] text-white/30 capitalize">{priority}</span>
                          </div>
                        </div>
                      );
                    })}
                    {columnTasks.length === 0 && (
                      <div className="text-[10px] text-white/15 italic text-center py-3">No tasks</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List view */}
        {taskView === 'list' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 uppercase tracking-wider border-b border-white/5">
                  <th className="text-left py-2 px-2 font-medium">Title</th>
                  <th className="text-left py-2 px-2 font-medium">Status</th>
                  <th className="text-left py-2 px-2 font-medium">Priority</th>
                  <th className="text-left py-2 px-2 font-medium">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  if (t.type !== 'freeform') return null;
                  const title = t.noteTitle || t.content?.slice(0, 50) || 'Untitled';
                  const status = t.taskMetadata?.status || 'not_started';
                  const priority = t.taskMetadata?.priority || 'medium';
                  const dueDate = t.taskMetadata?.dueDate;
                  return (
                    <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2 px-2 text-white/70 max-w-[200px] truncate">{title}</td>
                      <td className="py-2 px-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: statusColors[status] + '20', color: statusColors[status] }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColors[status] }} />
                          {statusLabels[status]}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize" style={{ backgroundColor: priorityColors[priority] + '20', color: priorityColors[priority] }}>
                          {priority}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-white/40">{dueDate ? new Date(dueDate).toLocaleDateString() : '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Timeline view */}
        {taskView === 'timeline' && (
          tasksWithDates.length > 0 ? (
            <ReactEChartsCore
              echarts={echarts}
              option={buildTaskGanttOption(tasksWithDates, statusColors)}
              style={{ height: `${Math.max(200, tasksWithDates.length * 36 + 60)}px` }}
              opts={{ renderer: 'canvas' }}
            />
          ) : (
            <div className="text-sm text-white/30 italic py-4 text-center">No tasks with dates set</div>
          )
        )}
      </ChartCard>
    </div>
  );
}

/* ── Timeline section renderer ──────────────────────────────────── */

function TimelineSection({ project }: { project: CXDProject }) {
  const elements = project.canvasLayout?.elements || [];
  const tasksWithDates = elements
    .filter((el) => el.type === 'freeform' && (el.cardType === 'task' || el.taskMetadata) && (el.taskMetadata?.startDate || el.taskMetadata?.dueDate))
    .map((el) => {
      if (el.type !== 'freeform') return null;
      const title = el.noteTitle || el.content?.slice(0, 40) || 'Untitled';
      const start = el.taskMetadata?.startDate ? new Date(el.taskMetadata.startDate).getTime() : null;
      const due = el.taskMetadata?.dueDate ? new Date(el.taskMetadata.dueDate).getTime() : null;
      return { title, start, due, status: el.taskMetadata?.status || 'not_started' };
    })
    .filter(Boolean) as { title: string; start: number | null; due: number | null; status: string }[];

  const statusColors: Record<string, string> = {
    completed: '#10B981',
    in_progress: '#3B82F6',
    not_started: '#6B7280',
    blocked: '#EF4444',
  };

  if (tasksWithDates.length === 0) {
    return <div className="text-sm text-white/30 italic">No tasks with dates set</div>;
  }

  return (
    <div className="space-y-6">
      <ChartCard title="Project Timeline">
        <ReactEChartsCore
          echarts={echarts}
          option={buildTaskGanttOption(tasksWithDates, statusColors)}
          style={{ height: `${Math.max(250, tasksWithDates.length * 36 + 60)}px` }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>
    </div>
  );
}

/* ── Hypercube Map section renderer ─────────────────────────────── */

function HypercubeMapSection({ project }: { project: CXDProject }) {
  // No-op handlers for read-only hypercube
  const noop = () => {};
  const elements = project.canvasLayout?.elements || [];

  const faceData = useMemo(() => {
    const counts: Record<HypercubeFaceTag, number> = {
      'Reality Planes': 0,
      'Sensory Domains': 0,
      'Presence Types': 0,
      'State Mapping': 0,
      'Trait Mapping': 0,
      'Meaning Architecture': 0,
      'Core': 0,
    };
    let taggedCount = 0;
    let untaggedCount = 0;

    for (const el of elements) {
      const tags = el.hypercubeTags;
      if (tags && tags.length > 0) {
        taggedCount++;
        for (const tag of tags) {
          if (counts[tag] !== undefined) {
            counts[tag]++;
          }
        }
      } else {
        untaggedCount++;
      }
    }

    const entries = HYPERCUBE_FACE_TAGS.map((face) => ({
      face,
      count: counts[face],
      color: HYPERCUBE_FACE_COLORS[face],
    }));

    const mostDeveloped = entries.reduce((a, b) => (b.count > a.count ? b : a), entries[0]);
    const leastDeveloped = entries.filter((e) => e.count > 0).reduce((a, b) => (b.count < a.count ? b : a), entries.find((e) => e.count > 0) || entries[0]);

    return { counts, entries, taggedCount, untaggedCount, mostDeveloped, leastDeveloped };
  }, [elements]);

  return (
    <div className="space-y-6">
      {/* Interactive 3D Hypercube — only the rotating cube, no UI */}
      <div className="hypercube-readonly rounded-xl overflow-hidden border border-purple-500/15 h-[280px] sm:h-[400px] relative" style={{ background: 'rgba(5,2,12,0.8)' }}>
        <Hypercube3D
          project={project}
          onSelectSection={noop}
          onCoreClick={noop}
          selectedSection={null}
        />
      </div>

      {faceData.taggedCount === 0 ? (
        <div className="text-sm text-white/30 italic">No elements tagged to hypercube faces yet</div>
      ) : (
      <>
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Boxes className="w-4 h-4" />} label="Tagged Elements" value={faceData.taggedCount} />
        <StatCard
          icon={<div className="w-3 h-3 rounded-full" style={{ backgroundColor: faceData.mostDeveloped.color }} />}
          label="Most Developed"
          value={faceData.mostDeveloped.face.split(' ')[0]}
        />
        <StatCard
          icon={<div className="w-3 h-3 rounded-full" style={{ backgroundColor: faceData.leastDeveloped?.color || '#666' }} />}
          label="Least Developed"
          value={faceData.leastDeveloped?.face.split(' ')[0] || '--'}
        />
        <StatCard icon={<Layers className="w-4 h-4" />} label="Untagged" value={faceData.untaggedCount} />
      </div>

      {/* Radar chart - Experience Design Coverage */}
      <ChartCard title="Experience Design Coverage">
        <ReactEChartsCore
          echarts={echarts}
          option={buildHypercubeRadarOption(faceData.entries)}
          style={{ height: 'min(300px, 65vw)' }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>

      {/* Donut chart - Face Distribution */}
      <ChartCard title="Face Distribution">
        <ReactEChartsCore
          echarts={echarts}
          option={buildHypercubeDonutOption(faceData.entries)}
          style={{ height: 'min(280px, 70vw)' }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>

      {/* Horizontal bar chart - Elements per Face */}
      <ChartCard title="Elements per Face">
        <ReactEChartsCore
          echarts={echarts}
          option={buildHypercubeBarOption(faceData.entries)}
          style={{ height: `${Math.max(200, faceData.entries.length * 40 + 60)}px` }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>
      </>
      )}
    </div>
  );
}

/* ── section definitions ─────────────────────────────────────────── */

interface SectionDef {
  id: string;
  title: string;
  icon: React.ReactNode;
  hasData: (project: CXDProject) => boolean;
  renderContent: (project: CXDProject) => React.ReactNode;
}

const SECTIONS: SectionDef[] = [
  {
    id: 'overview',
    title: 'Overview',
    icon: <Home className="w-4 h-4" />,
    hasData: () => true,
    renderContent: () => null, // rendered separately
  },
  {
    id: 'intention',
    title: 'Intention Core',
    icon: <Target className="w-4 h-4" />,
    hasData: (p) => !!(p.intentionCore?.projectName || p.intentionCore?.mainConcept || p.intentionCore?.coreMessage),
    renderContent: (p) => (
      <div className="space-y-4">
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
    hasData: (p) => !!(p.desiredChange?.insights || p.desiredChange?.feelings || p.desiredChange?.states || p.desiredChange?.knowledge),
    renderContent: (p) => (
      <div className="space-y-4">
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
    hasData: (p) => !!(p.humanContext?.audienceNeeds || p.humanContext?.audienceDesires || p.humanContext?.userRole),
    renderContent: (p) => (
      <div className="space-y-4">
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
    hasData: (p) => !!(p.contextAndMeaning?.world && p.contextAndMeaning.world.trim()),
    renderContent: (p) => (
      <ReadOnlyField label="World Description" value={p.contextAndMeaning?.world} />
    ),
  },
  {
    id: 'story',
    title: 'Story',
    icon: <BookOpen className="w-4 h-4" />,
    hasData: (p) => !!(p.contextAndMeaning?.story && p.contextAndMeaning.story.trim()),
    renderContent: (p) => (
      <ReadOnlyField label="Narrative Arc" value={p.contextAndMeaning?.story} />
    ),
  },
  {
    id: 'magic',
    title: 'Magic',
    icon: <Wand2 className="w-4 h-4" />,
    hasData: (p) => !!(p.contextAndMeaning?.magic && p.contextAndMeaning.magic.trim()),
    renderContent: (p) => (
      <ReadOnlyField label="Transformation Mechanism" value={p.contextAndMeaning?.magic} />
    ),
  },
  {
    id: 'flow',
    title: 'Experience Flow',
    icon: <Route className="w-4 h-4" />,
    hasData: (p) => !!(p.experienceFlowStages && p.experienceFlowStages.length > 0),
    renderContent: (p) => <FlowSectionContent project={p} />,
  },
  {
    id: 'reality',
    title: 'Reality Planes',
    icon: <Layers className="w-4 h-4" />,
    hasData: (p) => !!(p.realityPlanesV2 && p.realityPlanesV2.some((pl) => pl.enabled)),
    renderContent: (p) => <WizardRealityPlanesSection project={p} />,
  },
  {
    id: 'sensory',
    title: 'Sensory Domains',
    icon: <Eye className="w-4 h-4" />,
    hasData: (p) => SENSORY_DOMAINS.some((d) => (p.sensoryDomains[d.code] ?? 0) > 0),
    renderContent: (p) => <WizardSensorySection project={p} />,
  },
  {
    id: 'presence',
    title: 'Presence Types',
    icon: <Radio className="w-4 h-4" />,
    hasData: (p) => PRESENCE_TYPES.some((pt) => (p.presenceTypes[pt.code] ?? 0) > 0),
    renderContent: (p) => <WizardPresenceSection project={p} />,
  },
  {
    id: 'state',
    title: 'State Mapping',
    icon: <Brain className="w-4 h-4" />,
    hasData: (p) => !!(p.stateMapping && Object.values(p.stateMapping).some((v) => v && v.trim())),
    renderContent: (p) => <WizardStateMappingSection project={p} />,
  },
  {
    id: 'trait',
    title: 'Trait Mapping',
    icon: <Heart className="w-4 h-4" />,
    hasData: (p) => !!(p.traitMapping && Object.values(p.traitMapping).some((v) => v && v.trim())),
    renderContent: (p) => <WizardTraitMappingSection project={p} />,
  },
  {
    id: 'planning',
    title: 'Planning',
    icon: <ListTodo className="w-4 h-4" />,
    hasData: (p) => !!(p.canvasLayout?.elements?.some((el) => el.type === 'freeform' && (el.cardType === 'task' || el.taskMetadata))),
    renderContent: (p) => <PlanningSection project={p} />,
  },
  {
    id: 'timeline',
    title: 'Timeline',
    icon: <CalendarDays className="w-4 h-4" />,
    hasData: (p) => !!(p.canvasLayout?.elements?.some((el) => el.type === 'freeform' && (el.cardType === 'task' || el.taskMetadata) && (el.taskMetadata?.startDate || el.taskMetadata?.dueDate))),
    renderContent: (p) => <TimelineSection project={p} />,
  },
  {
    id: 'hypercube',
    title: 'Hypercube Map',
    icon: <Boxes className="w-4 h-4" />,
    hasData: (p) => !!(p.canvasLayout?.elements?.some((el) => el.hypercubeTags && el.hypercubeTags.length > 0)),
    renderContent: (p) => <HypercubeMapSection project={p} />,
  },
];

/* ── chart option builders ──────────────────────────────────────── */

function buildSensoryRadarOption(project: CXDProject): echarts.EChartsCoreOption {
  const indicators = SENSORY_DOMAINS.map((d) => ({
    name: d.label,
    max: 100,
  }));
  const values = SENSORY_DOMAINS.map((d) => project.sensoryDomains[d.code] ?? 0);

  return {
    backgroundColor: 'transparent',
    textStyle: { color: CHART_TEXT_COLOR, fontFamily: CHART_FONT_FAMILY },
    tooltip: { ...tooltipStyle, trigger: 'item' },
    radar: {
      indicator: indicators,
      shape: 'polygon',
      axisName: { color: AXIS_LABEL_COLOR, fontSize: 11, fontFamily: CHART_FONT_FAMILY },
      splitArea: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: values,
            name: 'Sensory Intensity',
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(168, 85, 247, 0.25)' },
                { offset: 1, color: 'rgba(139, 92, 246, 0.05)' },
              ]),
              shadowColor: 'rgba(168, 85, 247, 0.3)',
              shadowBlur: 20,
            },
            lineStyle: {
              color: 'rgba(192, 132, 252, 0.7)',
              width: 2,
              shadowColor: 'rgba(168, 85, 247, 0.4)',
              shadowBlur: 8,
            },
            itemStyle: {
              color: '#fff',
              borderColor: 'rgba(192, 132, 252, 0.8)',
              borderWidth: 2,
              shadowColor: 'rgba(168, 85, 247, 0.5)',
              shadowBlur: 8,
            },
            symbol: 'circle',
            symbolSize: 6,
          },
        ],
      },
    ],
    animation: false,
  };
}

function buildPresenceRadarOption(project: CXDProject): echarts.EChartsCoreOption {
  const indicators = PRESENCE_TYPES.map((pt) => ({
    name: pt.label,
    max: 100,
  }));
  const values = PRESENCE_TYPES.map((pt) => project.presenceTypes[pt.code] ?? 0);

  return {
    backgroundColor: 'transparent',
    textStyle: { color: CHART_TEXT_COLOR, fontFamily: CHART_FONT_FAMILY },
    tooltip: { ...tooltipStyle, trigger: 'item' },
    radar: {
      indicator: indicators,
      shape: 'polygon',
      axisName: { color: AXIS_LABEL_COLOR, fontSize: 11, fontFamily: CHART_FONT_FAMILY },
      splitArea: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: values,
            name: 'Presence Level',
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(168, 85, 247, 0.25)' },
                { offset: 1, color: 'rgba(139, 92, 246, 0.05)' },
              ]),
              shadowColor: 'rgba(168, 85, 247, 0.3)',
              shadowBlur: 20,
            },
            lineStyle: {
              color: 'rgba(192, 132, 252, 0.7)',
              width: 2,
              shadowColor: 'rgba(168, 85, 247, 0.4)',
              shadowBlur: 8,
            },
            itemStyle: {
              color: '#fff',
              borderColor: 'rgba(192, 132, 252, 0.8)',
              borderWidth: 2,
              shadowColor: 'rgba(168, 85, 247, 0.5)',
              shadowBlur: 8,
            },
            symbol: 'circle',
            symbolSize: 6,
          },
        ],
      },
    ],
    animation: false,
  };
}

function buildTimelineOption(project: CXDProject): echarts.EChartsCoreOption {
  const stages = project.experienceFlowStages || [];
  const names = stages.map((s) => s.name);
  const minutes = stages.map((s) => s.estimatedMinutes ?? 0);

  return {
    backgroundColor: 'transparent',
    textStyle: { color: CHART_TEXT_COLOR, fontFamily: CHART_FONT_FAMILY },
    tooltip: {
      ...tooltipStyle,
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: 'rgba(139,92,246,0.2)' } },
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : params;
        const item = p as { name: string; value: number };
        return `<span style="color:rgba(255,255,255,0.7)">${item.name}</span><br/><span style="color:rgba(139,92,246,0.9);font-weight:bold">${item.value} min</span>`;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '8%',
      top: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: CHART_FONT_FAMILY, rotate: names.length > 6 ? 30 : 0 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'Minutes',
      nameTextStyle: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
      axisLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        data: minutes,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(139, 92, 246, 0.5)' },
            { offset: 0.4, color: 'rgba(88, 28, 135, 0.3)' },
            { offset: 0.7, color: 'rgba(30, 10, 60, 0.15)' },
            { offset: 1, color: 'rgba(0, 0, 0, 0)' },
          ]),
        },
        lineStyle: {
          color: 'rgba(192, 132, 252, 0.8)',
          width: 3,
          shadowColor: 'rgba(168, 85, 247, 0.5)',
          shadowBlur: 10,
        },
        symbolSize: 8,
        symbol: 'circle',
        itemStyle: {
          color: '#fff',
          borderColor: 'rgba(192, 132, 252, 0.8)',
          borderWidth: 2,
          shadowColor: 'rgba(168, 85, 247, 0.5)',
          shadowBlur: 8,
        },
      },
    ],
    animation: false,
  };
}

function buildEngagementOption(project: CXDProject): echarts.EChartsCoreOption {
  const stages = project.experienceFlowStages || [];
  // Average engagement across all stages
  const avgEngagement: Record<EngagementLevelCode, number> = {
    observer: 0,
    engager: 0,
    coCreator: 0,
    architect: 0,
  };

  if (stages.length > 0) {
    for (const stage of stages) {
      const dist = stage.engagementDistribution;
      avgEngagement.observer += dist.observer;
      avgEngagement.engager += dist.engager;
      avgEngagement.coCreator += dist.coCreator;
      avgEngagement.architect += dist.architect;
    }
    for (const key of Object.keys(avgEngagement) as EngagementLevelCode[]) {
      avgEngagement[key] = Math.round(avgEngagement[key] / stages.length);
    }
  }

  const ENGAGEMENT_COLORS = ['#8b5cf6', '#c084fc', '#34d399', '#a855f7']; // purple, light purple, emerald, violet

  const data = ENGAGEMENT_LEVELS.map((lvl, i) => ({
    value: avgEngagement[lvl.code],
    name: lvl.label,
    itemStyle: {
      color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
        { offset: 0, color: ENGAGEMENT_COLORS[i] },
        { offset: 1, color: ENGAGEMENT_COLORS[i] + 'AA' },
      ]),
      shadowColor: ENGAGEMENT_COLORS[i] + '60',
      shadowBlur: 12,
    },
  }));

  return {
    backgroundColor: 'transparent',
    textStyle: { color: CHART_TEXT_COLOR, fontFamily: CHART_FONT_FAMILY },
    tooltip: {
      ...tooltipStyle,
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number };
        return `<span style="color:rgba(255,255,255,0.7)">${p.name}</span><br/><span style="color:rgba(139,92,246,0.9);font-weight:bold">${p.value}%</span> <span style="color:rgba(255,255,255,0.3)">(${p.percent?.toFixed(0)}% share)</span>`;
      },
    },
    legend: {
      bottom: 0,
      textStyle: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: CHART_FONT_FAMILY },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 12,
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: { borderRadius: 4 },
        label: { show: false },
        emphasis: {
          label: { show: true, color: 'rgba(255,255,255,0.8)', fontSize: 12 },
          itemStyle: { shadowBlur: 20, shadowColor: 'rgba(139,92,246,0.4)' },
        },
        data,
      },
    ],
    animation: false,
  };
}

/* ── per-stage engagement stacked bar chart (used in flow section) ─ */

function buildStageEngagementStackedOption(project: CXDProject): echarts.EChartsCoreOption {
  const stages = project.experienceFlowStages || [];
  const names = stages.map((s) => s.name);

  const colors: Record<EngagementLevelCode, string> = {
    observer: 'rgba(139,92,246,0.7)',
    engager: 'rgba(139,92,246,0.7)',
    coCreator: 'rgba(52,211,153,0.7)',
    architect: 'rgba(52,211,153,0.7)',
  };

  const series = ENGAGEMENT_LEVELS.map((lvl) => ({
    name: lvl.label,
    type: 'bar' as const,
    stack: 'engagement',
    data: stages.map((s) => s.engagementDistribution[lvl.code]),
    itemStyle: { color: colors[lvl.code], borderRadius: 0 },
    barMaxWidth: 30,
  }));

  return {
    backgroundColor: 'transparent',
    textStyle: { color: CHART_TEXT_COLOR, fontFamily: CHART_FONT_FAMILY },
    tooltip: {
      ...tooltipStyle,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(139,92,246,0.04)' } },
    },
    legend: {
      bottom: 0,
      textStyle: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: CHART_FONT_FAMILY },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 12,
    },
    grid: { left: '3%', right: '4%', bottom: '16%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series,
    animation: false,
  };
}

/* ── per-stage presence heatmap-style bar chart (used in flow section) ─ */

function buildStagePresenceRadarOption(project: CXDProject): echarts.EChartsCoreOption {
  const stages = project.experienceFlowStages || [];
  if (stages.length === 0) {
    return { backgroundColor: 'transparent' };
  }

  const indicators = STAGE_PRESENCE_TYPES.map((pt) => ({
    name: pt.label,
    max: 100,
  }));

  const stageColors = [
    'rgba(139,92,246,0.6)',
    'rgba(99,102,241,0.6)',
    'rgba(168,85,247,0.6)',
    'rgba(192,132,252,0.6)',
    'rgba(124,58,237,0.6)',
    'rgba(79,70,229,0.6)',
    'rgba(147,51,234,0.6)',
  ];

  const data = stages.map((stage, i) => ({
    value: STAGE_PRESENCE_TYPES.map((pt) => stage.presenceTypes[pt.code as StagePresenceTypeCode] ?? 0),
    name: stage.name,
    lineStyle: {
      color: stageColors[i % stageColors.length],
      width: 2,
      shadowColor: 'rgba(168, 85, 247, 0.4)',
      shadowBlur: 8,
    },
    itemStyle: { color: stageColors[i % stageColors.length] },
    areaStyle: {
      color: stageColors[i % stageColors.length].replace('0.6', '0.08'),
      shadowColor: 'rgba(139, 92, 246, 0.2)',
      shadowBlur: 15,
    },
    symbol: 'circle',
    symbolSize: 4,
  }));

  return {
    backgroundColor: 'transparent',
    textStyle: { color: CHART_TEXT_COLOR, fontFamily: CHART_FONT_FAMILY },
    tooltip: { ...tooltipStyle, trigger: 'item' },
    legend: {
      bottom: 0,
      textStyle: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: CHART_FONT_FAMILY },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 8,
    },
    radar: {
      indicator: indicators,
      shape: 'polygon',
      radius: '60%',
      axisName: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: CHART_FONT_FAMILY },
      splitArea: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    },
    series: [{ type: 'radar', data }],
    animation: false,
  };
}

/* ── task gantt chart builder ───────────────────────────────────── */

function buildTaskGanttOption(
  tasks: { title: string; start: number | null; due: number | null; status: string }[],
  statusColors: Record<string, string>,
): echarts.EChartsCoreOption {
  // Find min/max date range
  const allDates = tasks.flatMap((t) => [t.start, t.due].filter(Boolean)) as number[];
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const range = maxDate - minDate || 86400000; // at least 1 day

  const names = tasks.map((t) => t.title);

  return {
    backgroundColor: 'transparent',
    textStyle: { color: CHART_TEXT_COLOR, fontFamily: CHART_FONT_FAMILY },
    tooltip: {
      ...tooltipStyle,
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number[]; dataIndex: number };
        const task = tasks[p.dataIndex];
        const startStr = task.start ? new Date(task.start).toLocaleDateString() : 'N/A';
        const dueStr = task.due ? new Date(task.due).toLocaleDateString() : 'N/A';
        return `<span style="color:rgba(255,255,255,0.8)">${task.title}</span><br/>Start: ${startStr}<br/>Due: ${dueStr}`;
      },
    },
    grid: { left: '3%', right: '6%', bottom: '12%', top: '4%', containLabel: true },
    xAxis: {
      type: 'time',
      min: minDate - range * 0.05,
      max: maxDate + range * 0.05,
      axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
    },
    yAxis: {
      type: 'category',
      data: names,
      inverse: true,
      axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10, width: 100, overflow: 'truncate' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    series: [{
      type: 'custom',
      encode: { x: [1, 2], y: 0 },
      data: tasks.map((t, i) => {
        const start = t.start || t.due || minDate;
        const due = t.due || t.start || maxDate;
        return {
          value: [i, start, due],
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: statusColors[t.status] || '#6B7280' },
              { offset: 1, color: (statusColors[t.status] || '#6B7280') + 'AA' },
            ]),
            borderRadius: 3,
            shadowColor: (statusColors[t.status] || '#6B7280') + '40',
            shadowBlur: 6,
          },
        };
      }),
      renderItem: (_params: unknown, api: {
        value: (idx: number) => number;
        coord: (vals: [number, number]) => number[];
        size: (vals: [number, number]) => number[];
        style: () => Record<string, unknown>;
      }) => {
        const categoryIndex = api.value(0);
        const start = api.coord([api.value(1), categoryIndex]);
        const end = api.coord([api.value(2), categoryIndex]);
        const height = api.size([0, 1])[1] * 0.6;
        const task = tasks[categoryIndex];
        const color = statusColors[task.status] || '#6B7280';
        return {
          type: 'rect',
          shape: {
            x: start[0],
            y: start[1] - height / 2,
            width: Math.max(end[0] - start[0], 4),
            height,
            r: 3,
          },
          style: {
            fill: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color },
              { offset: 1, color: color + 'AA' },
            ]),
            shadowColor: color + '40',
            shadowBlur: 6,
          },
        };
      },
    }],
    animation: false,
  };
}

/* ── hypercube chart builders ───────────────────────────────────── */

function buildHypercubeRadarOption(entries: { face: string; count: number; color: string }[]): echarts.EChartsCoreOption {
  const maxCount = Math.max(...entries.map((e) => e.count), 1);
  const indicators = entries.map((e) => ({
    name: e.face,
    max: maxCount,
  }));
  const values = entries.map((e) => e.count);

  return {
    backgroundColor: 'transparent',
    textStyle: { color: CHART_TEXT_COLOR, fontFamily: CHART_FONT_FAMILY },
    tooltip: { ...tooltipStyle, trigger: 'item' },
    radar: {
      indicator: indicators,
      shape: 'polygon',
      axisName: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: CHART_FONT_FAMILY },
      splitArea: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: values,
            name: 'Design Coverage',
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(139, 92, 246, 0.35)' },
                { offset: 1, color: 'rgba(99, 102, 241, 0.05)' },
              ]),
              shadowColor: 'rgba(139, 92, 246, 0.3)',
              shadowBlur: 20,
            },
            lineStyle: {
              color: 'rgba(192, 132, 252, 0.8)',
              width: 2,
              shadowColor: 'rgba(168, 85, 247, 0.5)',
              shadowBlur: 10,
            },
            itemStyle: {
              color: '#fff',
              borderColor: 'rgba(168, 85, 247, 0.8)',
              borderWidth: 2,
              shadowColor: 'rgba(168, 85, 247, 0.5)',
              shadowBlur: 8,
            },
            symbol: 'circle',
            symbolSize: 7,
          },
        ],
      },
    ],
    animation: false,
  };
}

function buildHypercubeDonutOption(entries: { face: string; count: number; color: string }[]): echarts.EChartsCoreOption {
  const filtered = entries.filter((e) => e.count > 0);
  const data = filtered.map((e) => ({
    value: e.count,
    name: e.face,
    itemStyle: {
      color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
        { offset: 0, color: '#1a0a30' },
        { offset: 0.4, color: e.color + '99' },
        { offset: 1, color: e.color },
      ]),
      shadowColor: e.color + '50',
      shadowBlur: 15,
      borderColor: 'rgba(0,0,0,0.3)',
      borderWidth: 1,
    },
  }));

  return {
    backgroundColor: 'transparent',
    textStyle: { color: CHART_TEXT_COLOR, fontFamily: CHART_FONT_FAMILY },
    tooltip: {
      ...tooltipStyle,
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number };
        return `<span style="color:rgba(255,255,255,0.7)">${p.name}</span><br/><span style="font-weight:bold">${p.value} elements</span> <span style="color:rgba(255,255,255,0.3)">(${p.percent?.toFixed(0)}%)</span>`;
      },
    },
    legend: {
      bottom: 0,
      textStyle: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: CHART_FONT_FAMILY },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 8,
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: { borderRadius: 4 },
        label: { show: false },
        emphasis: {
          label: { show: true, color: 'rgba(255,255,255,0.8)', fontSize: 12 },
          itemStyle: { shadowBlur: 20, shadowColor: 'rgba(139,92,246,0.4)' },
        },
        data,
      },
    ],
    animation: false,
  };
}

function buildHypercubeBarOption(entries: { face: string; count: number; color: string }[]): echarts.EChartsCoreOption {
  const names = entries.map((e) => e.face);
  const data = entries.map((e) => ({
    value: e.count,
    itemStyle: {
      color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
        { offset: 0, color: '#1a0a30' },
        { offset: 0.3, color: e.color + '88' },
        { offset: 1, color: e.color },
      ]),
      borderRadius: [0, 4, 4, 0],
      shadowColor: e.color + '50',
      shadowBlur: 12,
    },
  }));

  return {
    backgroundColor: 'transparent',
    textStyle: { color: CHART_TEXT_COLOR, fontFamily: CHART_FONT_FAMILY },
    tooltip: { ...tooltipStyle, trigger: 'axis' },
    grid: { left: '3%', right: '6%', bottom: '8%', top: '4%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 11 },
      splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      data: names,
      inverse: true,
      axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10, width: 120, overflow: 'truncate' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    series: [{
      type: 'bar',
      data,
      barMaxWidth: 24,
    }],
    animation: false,
  };
}

/* ── section-specific content with inline charts ───────────────── */

function FlowSectionContent({ project }: { project: CXDProject }) {
  const stages = project.experienceFlowStages || [];
  return (
    <div className="space-y-6">
      {/* Stage list */}
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

      {/* Timeline chart — smooth area curve */}
      {stages.some((s) => s.estimatedMinutes != null && s.estimatedMinutes > 0) && (
        <ChartCard title="Stage Duration Timeline">
          <ReactEChartsCore
            echarts={echarts}
            option={buildTimelineOption(project)}
            style={{ height: '220px' }}
            opts={{ renderer: 'canvas' }}
          />
        </ChartCard>
      )}

      {/* Engagement stacked bar */}
      <ChartCard title="Engagement Distribution by Stage">
        <ReactEChartsCore
          echarts={echarts}
          option={buildStageEngagementStackedOption(project)}
          style={{ height: '260px' }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>

      {/* Per-stage presence radar */}
      <ChartCard title="Presence Types by Stage">
        <ReactEChartsCore
          echarts={echarts}
          option={buildStagePresenceRadarOption(project)}
          style={{ height: 'min(300px, 65vw)' }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>
    </div>
  );
}

/* ── main component ──────────────────────────────────────────────── */

interface ShareFramingPresentationProps {
  project: CXDProject;
  defaultSection?: string;
}

export function ShareFramingPresentation({ project, defaultSection }: ShareFramingPresentationProps) {
  const [activeSection, setActiveSection] = useState<string>(defaultSection || 'overview');

  const stats = useMemo(() => {
    const stageCount = project.experienceFlowStages?.length || 5;
    const elementCount = project.canvasLayout?.elements?.length || 0;
    const enabledPlanes = project.realityPlanesV2?.filter((p) => p.enabled).length || 0;
    const activeSenses = SENSORY_DOMAINS.filter((d) => (project.sensoryDomains[d.code] ?? 0) > 0).length;
    const totalMinutes = (project.experienceFlowStages || []).reduce(
      (sum, s) => sum + (s.estimatedMinutes ?? 0),
      0,
    );
    return { stageCount, elementCount, enabledPlanes, activeSenses, totalMinutes };
  }, [project]);

  const coreMessage = project.intentionCore?.coreMessage;
  const mainConcept = project.intentionCore?.mainConcept;

  const currentSection = SECTIONS.find((s) => s.id === activeSection);

  /* ── overview dashboard ─────────────────────────────────── */
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
          {project.intentionCore?.projectName || project.name}
        </h1>

        {coreMessage && coreMessage.trim() && (
          <blockquote className="border-l-2 border-violet-500/40 pl-5 py-2">
            <p className="text-base sm:text-lg text-white/60 italic leading-relaxed">
              &ldquo;{coreMessage}&rdquo;
            </p>
          </blockquote>
        )}

        {mainConcept && mainConcept.trim() && (
          <p className="text-sm text-white/50 leading-relaxed">
            {mainConcept}
          </p>
        )}

        {(project.shareDescription || project.description) && (
          <div className="space-y-2">
            <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider">About This Experience</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              {project.shareDescription || project.description}
            </p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Route className="w-4 h-4" />} label="Flow Stages" value={stats.stageCount} />
        <StatCard icon={<Layers className="w-4 h-4" />} label="Reality Planes" value={stats.enabledPlanes} />
        <StatCard icon={<Eye className="w-4 h-4" />} label="Active Senses" value={stats.activeSenses} />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Total Duration"
          value={stats.totalMinutes > 0 ? `${stats.totalMinutes}m` : '--'}
        />
      </div>

      {/* Charts row 1: Two radars side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Sensory Domains">
          <ReactEChartsCore
            echarts={echarts}
            option={buildSensoryRadarOption(project)}
            style={{ height: '240px' }}
            opts={{ renderer: 'canvas' }}
          />
        </ChartCard>

        <ChartCard title="Presence Types">
          <ReactEChartsCore
            echarts={echarts}
            option={buildPresenceRadarOption(project)}
            style={{ height: '240px' }}
            opts={{ renderer: 'canvas' }}
          />
        </ChartCard>
      </div>

      {/* Charts row 2: Experience Flow Timeline (full width) — smooth area */}
      <ChartCard title="Experience Flow Timeline">
        <ReactEChartsCore
          echarts={echarts}
          option={buildTimelineOption(project)}
          style={{ height: '220px' }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>

      {/* Charts row 3: Engagement Distribution (full width) */}
      <ChartCard title="Engagement Distribution">
        <ReactEChartsCore
          echarts={echarts}
          option={buildEngagementOption(project)}
          style={{ height: 'min(260px, 65vw)' }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>

      {/* Experience flow description */}
      {project.experienceFlowDescription && project.experienceFlowDescription.trim() && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider">Experience Flow Overview</h2>
          <p className="text-sm text-white/50 leading-relaxed whitespace-pre-wrap">
            {project.experienceFlowDescription}
          </p>
        </div>
      )}
    </div>
  );

  /* ── section page ────────────────────────────────────────── */
  const renderSectionPage = () => {
    if (!currentSection || currentSection.id === 'overview') return renderOverview();
    return (
      <div className="space-y-6">
        {/* Section title + icon */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400">
            {currentSection.icon}
          </div>
          <h2 className="text-2xl font-bold text-white">{currentSection.title}</h2>
        </div>

        {/* Section content */}
        <div
          className="p-5 rounded-xl border border-purple-500/15 bg-transparent"
        >
          {currentSection.renderContent(project)}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-hidden relative">
      {/* ShimmerGrid background */}
      <ShimmerGrid
        dotSize={1.5}
        dotSpacing={24}
        baseColor="rgba(110, 56, 236, 0.1)"
        hoverColor="rgba(138, 99, 255, 0.5)"
        hoverSize={400}
        className="!absolute inset-0 !z-0"
      />

      {/* Centered container holding content + sidebar */}
      <div className="h-full flex flex-col lg:flex-row gap-0 lg:gap-6 mx-auto relative z-10 w-full px-4 sm:px-6 lg:px-0 lg:w-[80vw]" style={{ maxWidth: '1200px' }}>
        {/* Mobile sidebar - horizontal scroll row at top */}
        <div className="lg:hidden overflow-x-auto flex gap-2 py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 flex-shrink-0">
          {SECTIONS.filter((s) => s.id !== 'planning' && s.id !== 'timeline' && s.id !== 'hypercube').map((section) => {
            const isActive = activeSection === section.id;
            const hasData = section.id === 'overview' || section.hasData(project);
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-all duration-200 cursor-pointer whitespace-nowrap flex-shrink-0',
                  isActive
                    ? 'bg-violet-500/15 border-violet-500/30 text-white'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06]',
                  !hasData && !isActive && 'opacity-50',
                )}
              >
                <span className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-violet-400' : 'text-white/40',
                )}>
                  {section.icon}
                </span>
                <span className="font-medium">{section.title}</span>
              </button>
            );
          })}
        </div>

        {/* Main content area */}
        <div
          className="flex-1 min-w-0 overflow-y-auto py-4 lg:py-6 px-0 lg:px-4 bg-transparent"
        >
          {renderSectionPage()}
        </div>

        {/* Desktop sidebar buttons - floating next to content */}
        <div className="hidden lg:block w-[190px] flex-shrink-0 py-6 space-y-1.5 overflow-hidden">
          {SECTIONS.filter((s) => s.id !== 'planning' && s.id !== 'timeline' && s.id !== 'hypercube').map((section) => {
            const isActive = activeSection === section.id;
            const hasData = section.id === 'overview' || section.hasData(project);
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-4 py-3 text-sm rounded-lg border transition-all duration-200 cursor-pointer text-left',
                  isActive
                    ? 'bg-violet-500/15 border-violet-500/30 text-white'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06]',
                  !hasData && !isActive && 'opacity-50',
                )}
              >
                <span className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-violet-400' : 'text-white/40',
                )}>
                  {section.icon}
                </span>
                <span className="font-medium truncate">{section.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
