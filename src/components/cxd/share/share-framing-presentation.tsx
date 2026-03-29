'use client';

import { useState, useMemo } from 'react';
import {
  CXDProject,
  REALITY_PLANES,
  SENSORY_DOMAINS,
  PRESENCE_TYPES,
  ENGAGEMENT_LEVELS,
  STAGE_PRESENCE_TYPES,
} from '@/types/cxd-schema';
import type { EngagementLevelCode, StagePresenceTypeCode } from '@/types/cxd-schema';
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
  Radio,
  Brain,
  Heart,
  Clock,
  Route,
  Home,
} from 'lucide-react';

// ECharts tree-shakeable imports
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { RadarChart, BarChart, PieChart, LineChart } from 'echarts/charts';
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
const AXIS_LABEL_COLOR = 'rgba(255,255,255,0.4)';
const GRID_LINE_COLOR = 'rgba(255,255,255,0.06)';
const VIOLET_LINE = 'rgba(139,92,246,0.6)';
const VIOLET_AREA_START = 'rgba(139,92,246,0.2)';
const VIOLET_AREA_END = 'rgba(139,92,246,0.05)';
const INDIGO_LINE = 'rgba(99,102,241,0.6)';
const INDIGO_AREA_START = 'rgba(99,102,241,0.2)';
const INDIGO_AREA_END = 'rgba(99,102,241,0.05)';

const tooltipStyle = {
  backgroundColor: TOOLTIP_BG,
  borderColor: TOOLTIP_BORDER,
  borderWidth: 1,
  textStyle: { color: CHART_TEXT_COLOR, fontFamily: CHART_FONT_FAMILY, fontSize: 12 },
  extraCssText: 'backdrop-filter:blur(12px);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.4);',
};

/* ── helpers ─────────────────────────────────────────────────────── */

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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 backdrop-blur-sm flex-1 min-w-[100px]">
      <span className="text-violet-400">{icon}</span>
      <span className="text-xl font-bold text-white/90">{value}</span>
      <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('glass-purple rounded-xl p-4', className)}>
      <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">{title}</h3>
      {children}
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
    renderContent: (p) => {
      const v2 = p.realityPlanesV2;
      if (!v2 || v2.length === 0) return <div className="text-sm text-white/30 italic">Not yet defined</div>;
      const sorted = [...v2].sort((a, b) => a.priority - b.priority);
      return (
        <div className="space-y-2">
          {sorted.filter((pl) => pl.enabled).map((plane) => {
            const meta = REALITY_PLANES.find((r) => r.code === plane.code);
            return (
              <div key={plane.code} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
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
    hasData: (p) => SENSORY_DOMAINS.some((d) => (p.sensoryDomains[d.code] ?? 0) > 0),
    renderContent: (p) => <SensorySectionContent project={p} />,
  },
  {
    id: 'presence',
    title: 'Presence Types',
    icon: <Radio className="w-4 h-4" />,
    hasData: (p) => PRESENCE_TYPES.some((pt) => (p.presenceTypes[pt.code] ?? 0) > 0),
    renderContent: (p) => <PresenceSectionContent project={p} />,
  },
  {
    id: 'state',
    title: 'State Mapping',
    icon: <Brain className="w-4 h-4" />,
    hasData: (p) => !!(p.stateMapping && Object.values(p.stateMapping).some((v) => v && v.trim())),
    renderContent: (p) => (
      <div className="space-y-4">
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
    hasData: (p) => !!(p.traitMapping && Object.values(p.traitMapping).some((v) => v && v.trim())),
    renderContent: (p) => (
      <div className="space-y-4">
        <ReadOnlyField label="Cognitive" value={p.traitMapping?.cognitive} />
        <ReadOnlyField label="Emotional" value={p.traitMapping?.emotional} />
        <ReadOnlyField label="Somatic" value={p.traitMapping?.somatic} />
        <ReadOnlyField label="Relational" value={p.traitMapping?.relational} />
      </div>
    ),
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
      splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
      axisLine: { lineStyle: { color: GRID_LINE_COLOR } },
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
                { offset: 0, color: VIOLET_AREA_START },
                { offset: 1, color: VIOLET_AREA_END },
              ]),
            },
            lineStyle: { color: VIOLET_LINE, width: 2 },
            itemStyle: { color: VIOLET_LINE },
            symbol: 'circle',
            symbolSize: 5,
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
      splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
      axisLine: { lineStyle: { color: GRID_LINE_COLOR } },
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
                { offset: 0, color: INDIGO_AREA_START },
                { offset: 1, color: INDIGO_AREA_END },
              ]),
            },
            lineStyle: { color: INDIGO_LINE, width: 2 },
            itemStyle: { color: INDIGO_LINE },
            symbol: 'circle',
            symbolSize: 5,
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
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(139,92,246,0.06)' } },
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
      axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: CHART_FONT_FAMILY, rotate: names.length > 6 ? 30 : 0 },
      axisLine: { lineStyle: { color: GRID_LINE_COLOR } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'Minutes',
      nameTextStyle: { color: AXIS_LABEL_COLOR, fontSize: 10 },
      axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10 },
      splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: minutes.map((val) => ({
          value: val,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(139,92,246,0.8)' },
              { offset: 1, color: 'rgba(168,85,247,0.3)' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barMaxWidth: 40,
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

  const colors = [
    'rgba(139,92,246,0.7)',  // observer - violet
    'rgba(99,102,241,0.7)',  // engager - indigo
    'rgba(168,85,247,0.7)',  // coCreator - purple
    'rgba(192,132,252,0.7)', // architect - lighter purple
  ];

  const data = ENGAGEMENT_LEVELS.map((lvl, i) => ({
    value: avgEngagement[lvl.code],
    name: lvl.label,
    itemStyle: { color: colors[i] },
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
    engager: 'rgba(99,102,241,0.7)',
    coCreator: 'rgba(168,85,247,0.7)',
    architect: 'rgba(192,132,252,0.7)',
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
      axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10 },
      axisLine: { lineStyle: { color: GRID_LINE_COLOR } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10 },
      splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
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
    lineStyle: { color: stageColors[i % stageColors.length], width: 2 },
    itemStyle: { color: stageColors[i % stageColors.length] },
    areaStyle: { color: stageColors[i % stageColors.length].replace('0.6', '0.08') },
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
      splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
      axisLine: { lineStyle: { color: GRID_LINE_COLOR } },
    },
    series: [{ type: 'radar', data }],
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

      {/* Timeline chart */}
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
          style={{ height: '300px' }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>
    </div>
  );
}

function SensorySectionContent({ project }: { project: CXDProject }) {
  return (
    <div className="space-y-6">
      {/* Bar list */}
      <div className="space-y-2">
        {SENSORY_DOMAINS.map((domain) => {
          const val = project.sensoryDomains[domain.code] ?? 0;
          return (
            <div key={domain.code} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
              <span className="text-sm text-white/70 flex-1">{domain.label}</span>
              <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400" style={{ width: `${val}%` }} />
              </div>
              <span className="text-xs text-white/40 w-8 text-right">{val}%</span>
            </div>
          );
        })}
      </div>

      {/* Radar chart */}
      <ChartCard title="Sensory Profile">
        <ReactEChartsCore
          echarts={echarts}
          option={buildSensoryRadarOption(project)}
          style={{ height: '280px' }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>
    </div>
  );
}

function PresenceSectionContent({ project }: { project: CXDProject }) {
  return (
    <div className="space-y-6">
      {/* Bar list */}
      <div className="space-y-2">
        {PRESENCE_TYPES.map((presence) => {
          const val = project.presenceTypes[presence.code] ?? 0;
          return (
            <div key={presence.code} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
              <span className="text-sm text-white/70 flex-1">{presence.label}</span>
              <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400" style={{ width: `${val}%` }} />
              </div>
              <span className="text-xs text-white/40 w-8 text-right">{val}%</span>
            </div>
          );
        })}
      </div>

      {/* Radar chart */}
      <ChartCard title="Presence Profile">
        <ReactEChartsCore
          echarts={echarts}
          option={buildPresenceRadarOption(project)}
          style={{ height: '280px' }}
          opts={{ renderer: 'canvas' }}
        />
      </ChartCard>
    </div>
  );
}

/* ── main component ──────────────────────────────────────────────── */

interface ShareFramingPresentationProps {
  project: CXDProject;
}

export function ShareFramingPresentation({ project }: ShareFramingPresentationProps) {
  const [activeSection, setActiveSection] = useState<string>('overview');

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
            <p className="text-lg text-white/60 italic leading-relaxed">
              &ldquo;{coreMessage}&rdquo;
            </p>
          </blockquote>
        )}

        {mainConcept && mainConcept.trim() && (
          <p className="text-sm text-white/50 leading-relaxed">
            {mainConcept}
          </p>
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

      {/* Charts row 2: Experience Flow Timeline (full width) */}
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
          style={{ height: '260px' }}
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
        <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-sm">
          {currentSection.renderContent(project)}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex overflow-hidden relative">
      {/* ShimmerGrid background */}
      <ShimmerGrid
        dotSize={1.5}
        dotSpacing={24}
        baseColor="rgba(110, 56, 236, 0.1)"
        hoverColor="rgba(138, 99, 255, 0.5)"
        hoverSize={400}
        className="!absolute inset-0 !z-0"
      />

      {/* Centered container for sidebar + content */}
      <div className="relative z-10 flex w-full max-w-6xl mx-auto h-full">
        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 min-w-0">
          {renderSectionPage()}
        </main>

        {/* Right sidebar */}
        <aside className="w-[240px] flex-shrink-0 border-l border-white/[0.06] bg-white/[0.02] backdrop-blur-md overflow-y-auto">
          <div className="p-3 space-y-1">
            <h3 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2 px-1">
              Sections
            </h3>
            {SECTIONS.map((section) => {
              const isActive = activeSection === section.id;
              const hasData = section.id === 'overview' || section.hasData(project);
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all duration-200 cursor-pointer',
                    isActive
                      ? 'bg-violet-500/15 border-violet-500/30 text-white'
                      : 'bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/[0.04] hover:text-white/80',
                    !hasData && !isActive && 'opacity-50',
                  )}
                >
                  <span className={cn(
                    'flex-shrink-0 transition-colors',
                    isActive ? 'text-violet-400' : 'text-white/40',
                  )}>
                    {section.icon}
                  </span>
                  <span className="text-xs font-medium truncate">{section.title}</span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
