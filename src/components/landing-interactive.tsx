"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Image as ImageIcon, Layers, FolderOpen, Slash, Type, Link2,
  LayoutGrid, Table, MessageSquare, Clapperboard,
  Kanban, GanttChartSquare, CalendarDays, Table2, Rocket, CalendarCheck,
  Sparkles, Target, Users, Globe, Waves, Boxes,
} from 'lucide-react';

// ─── Shared section chrome (matches FeatureShowcase's title + divider) ───────

type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

export function SectionHeader({
  icon: Icon,
  label,
}: {
  icon: IconType;
  label: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-120px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center mb-14 md:mb-20"
    >
      <div className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-transparent border border-violet-500/30 shadow-[0_0_30px_-4px_rgba(139,92,246,0.35)] backdrop-blur-sm mb-5">
        <Icon className="w-7 h-7 md:w-8 md:h-8 text-violet-200" />
      </div>
      <h3 className="text-outline-purple text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-center leading-[0.95] overflow-visible">
        {label}
      </h3>
      <div className="mt-6 h-px w-[80vw] max-w-[1400px] bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />
    </motion.div>
  );
}

// Lightweight subtitle — used when a section already has its own big header
// (e.g. rendered above it by the caller) and only needs a small label for the
// block beneath it, not a full icon+outline+divider treatment.
export function SectionSubtitle({ icon: Icon, label }: { icon: IconType; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-violet-300/80" />
      <h4 className="text-xs md:text-sm font-semibold tracking-[0.2em] uppercase text-violet-300/80">
        {label}
      </h4>
    </div>
  );
}

// ─── 1. Interactive element toolkit ─────────────────────────────────────────
// A live replica of the canvas toolbar: hover (or tap) a tool and the panel
// beside it explains what that element brings to the infinite canvas.

interface ToolSpec {
  id: string;
  icon: IconType;
  name: string;
  blurb: string;
  detail: string;
  accent: string;
}

const TOOLS: ToolSpec[] = [
  {
    id: 'card', icon: FileText, name: 'Cards', accent: '#A78BFA',
    blurb: 'Notes, tasks and documents',
    detail: 'Rich note cards with titles and formatted bodies, task cards with subtasks and due dates that flow straight into your Plan, or compact document cards for long-form writing.',
  },
  {
    id: 'image', icon: ImageIcon, name: 'Images & Storyboards', accent: '#22D3EE',
    blurb: 'Plain images or framed storyboard cells',
    detail: 'Drop in references, crop and reframe them, or switch an image into a storyboard card: a framed cell with a caption underneath, styled to your own palette.',
  },
  {
    id: 'shape', icon: Layers, name: 'Shapes', accent: '#34D399',
    blurb: 'Rectangles, circles, diamonds and more',
    detail: 'Six shape types with gradient fills, outlines and text inside. Perfect for flow charts, decision forks and the transition beats between storyboard frames.',
  },
  {
    id: 'container', icon: FolderOpen, name: 'Containers', accent: '#F97316',
    blurb: 'Group work into tinted zones',
    detail: 'Draw a container around existing elements to capture them instantly. Containers nest, follow your colour palette, and move everything inside them as one unit.',
  },
  {
    id: 'line', icon: Slash, name: 'Lines & Connectors', accent: '#F472B6',
    blurb: 'Curved gradient relationships',
    detail: 'Connect any two elements with curved gradient connectors that follow them as they move. New connectors inherit the colour of the flow they extend.',
  },
  {
    id: 'text', icon: Type, name: 'Text', accent: '#C084FC',
    blurb: 'Titles, captions and gradient type',
    detail: 'Free-floating text with full typography control, including gradient-filled headings for section titles and guidance captions.',
  },
  {
    id: 'link', icon: Link2, name: 'Links & Files', accent: '#60A5FA',
    blurb: 'Bookmarks, embeds and uploads',
    detail: 'Paste any URL for a rich bookmark card, embed live content directly on the canvas, or attach files your team can preview without leaving the board.',
  },
  {
    id: 'board', icon: LayoutGrid, name: 'Boards', accent: '#8B5CF6',
    blurb: 'Infinite canvases inside your canvas',
    detail: 'Every board is a full canvas of its own. Double-click a hexagon portal to step inside — and with templates, they arrive pre-built with their own layouts.',
  },
  {
    id: 'table', icon: Table, name: 'Tables', accent: '#FB923C',
    blurb: 'Grids with per-cell colour',
    detail: 'Full data grids with resizable rows and columns, drag-to-reorder, gradient fills per cell, row, column or table, and cells that grow to fit your text.',
  },
  {
    id: 'comment', icon: MessageSquare, name: 'Comments', accent: '#2DD4BF',
    blurb: 'Threaded feedback, pinned in place',
    detail: 'Pin comment threads anywhere on the canvas. Teammates reply in context, right next to the thing being discussed.',
  },
];

export function ElementToolkitShowcase() {
  const [activeId, setActiveId] = useState<string>(TOOLS[0].id);
  const active = TOOLS.find((t) => t.id === activeId) ?? TOOLS[0];

  return (
    <section className="relative pt-0 pb-16 md:pb-20 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-5xl mx-auto"
      >
        <SectionSubtitle icon={Boxes} label="Everything you can place" />
        <p className="text-center text-white/60 text-sm md:text-base mb-10 max-w-2xl mx-auto">
          This is the real toolbar from the canvas. Hover any tool to see what it brings.
        </p>

        {/* Toolbar replica */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex-wrap justify-center max-w-full">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isActive = tool.id === activeId;
              return (
                <button
                  key={tool.id}
                  onMouseEnter={() => setActiveId(tool.id)}
                  onFocus={() => setActiveId(tool.id)}
                  onClick={() => setActiveId(tool.id)}
                  aria-label={tool.name}
                  className={`relative flex items-center justify-center w-11 h-11 rounded-lg transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-b from-violet-500/30 to-violet-950/60 border border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.4)]'
                      : 'border border-transparent hover:bg-violet-600/20'
                  }`}
                >
                  <Icon
                    className="w-5 h-5 transition-colors"
                    style={{ color: isActive ? tool.accent : 'rgba(255,255,255,0.55)' }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Explanation panel */}
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 md:p-8 overflow-hidden"
        >
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${active.accent}, transparent)` }}
          />
          <div className="flex items-start gap-4 md:gap-6">
            <div
              className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-xl flex-shrink-0 border"
              style={{
                background: `linear-gradient(135deg, ${active.accent}22, transparent)`,
                borderColor: `${active.accent}55`,
              }}
            >
              <active.icon className="w-6 h-6 md:w-7 md:h-7" style={{ color: active.accent }} />
            </div>
            <div className="min-w-0">
              <h4 className="text-xl md:text-2xl font-bold text-white mb-1">{active.name}</h4>
              <p className="text-sm font-medium mb-3" style={{ color: active.accent }}>
                {active.blurb}
              </p>
              <p className="text-white/70 text-sm md:text-base leading-relaxed">{active.detail}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── 2. Plan views + calendar sync ──────────────────────────────────────────

const PLAN_VIEWS = [
  { id: 'kanban', icon: Kanban, name: 'Kanban', accent: '#A78BFA', desc: 'Drag tasks between status columns. The board updates the canvas element behind every card.' },
  { id: 'gantt', icon: GanttChartSquare, name: 'Gantt', accent: '#22D3EE', desc: 'Timeline bars with dependencies. Drag to reschedule and watch the chain shift with it.' },
  { id: 'calendar', icon: CalendarDays, name: 'Calendar', accent: '#34D399', desc: 'Month view of everything due, so deadlines sit in the context of real weeks.' },
  { id: 'table', icon: Table2, name: 'Table', accent: '#F97316', desc: 'Sort, group and bulk-edit. The fastest way to triage a long backlog.' },
  { id: 'versions', icon: Rocket, name: 'Versions', accent: '#F472B6', desc: 'Milestones with OKRs and graduation criteria — ship v1 when the key results say so.' },
];

export function PlanViewsShowcase() {
  return (
    <section className="relative pt-0 pb-16 md:pb-20 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <SectionSubtitle icon={Kanban} label="Five ways to plan" />

      <div className="max-w-6xl mx-auto">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center text-white/60 text-sm md:text-base mb-12 max-w-2xl mx-auto"
        >
          The same tasks, five perspectives. Every view writes back to the element it came from on the canvas.
        </motion.p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLAN_VIEWS.map((view, i) => {
            const Icon = view.icon;
            return (
              <motion.div
                key={view.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 overflow-hidden hover:border-white/20 transition-colors"
              >
                <div
                  className="absolute inset-x-0 top-0 h-px opacity-60"
                  style={{ background: `linear-gradient(90deg, transparent, ${view.accent}, transparent)` }}
                />
                <div
                  className="flex items-center justify-center w-11 h-11 rounded-xl mb-4 border"
                  style={{
                    background: `linear-gradient(135deg, ${view.accent}22, transparent)`,
                    borderColor: `${view.accent}44`,
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: view.accent }} />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">{view.name}</h4>
                <p className="text-white/65 text-sm leading-relaxed">{view.desc}</p>
              </motion.div>
            );
          })}

          {/* Calendar sync — the payoff card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: PLAN_VIEWS.length * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-purple-500/[0.04] to-transparent backdrop-blur-xl p-6 overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
            <div className="flex items-center justify-center w-11 h-11 rounded-xl mb-4 border border-violet-400/40 bg-gradient-to-br from-violet-400/25 to-transparent">
              <CalendarCheck className="w-5 h-5 text-violet-200" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Sync to your calendar</h4>
            <p className="text-white/70 text-sm leading-relaxed">
              Subscribe to your plan from Google Calendar, Apple Calendar or Outlook. Deadlines land in the calendar you already live in, and stay up to date automatically.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── 3. Templates ───────────────────────────────────────────────────────────

const TEMPLATE_HIGHLIGHTS = [
  { id: 'intention', icon: Target, name: 'Intention Core', accent: '#C084FC', desc: 'Pulls, anti-vision and the evidence behind both.' },
  { id: 'world', icon: Globe, name: 'World · Story · Magic', accent: '#34D399', desc: 'Three portal walls for your meaning architecture.' },
  { id: 'personas', icon: Users, name: 'User Personas', accent: '#60A5FA', desc: 'Research zones that distill into persona sheets.' },
  { id: 'storyboard', icon: Clapperboard, name: 'Storyboard Flow', accent: '#F472B6', desc: 'Branching shot sequences with transition beats.' },
  { id: 'flow', icon: Waves, name: 'Experience Flow', accent: '#22D3EE', desc: 'Preparation through integration, stage by stage.' },
];

export function TemplatesShowcase() {
  return (
    <section className="relative py-16 md:py-24 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <SectionHeader icon={Sparkles} label="Start from a real design" />

      <div className="max-w-6xl mx-auto">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center text-white/60 text-sm md:text-base mb-12 max-w-2xl mx-auto"
        >
          22 templates, one for every part of the framework. Not empty boxes — tinted zones with guidance,
          connected flows, and cards already styled for you to edit.
        </motion.p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {TEMPLATE_HIGHLIGHTS.map((tpl, i) => {
            const Icon = tpl.icon;
            return (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 overflow-hidden hover:border-white/20 transition-colors"
              >
                <div
                  className="absolute inset-x-0 top-0 h-px opacity-60"
                  style={{ background: `linear-gradient(90deg, transparent, ${tpl.accent}, transparent)` }}
                />
                <div
                  className="flex items-center justify-center w-11 h-11 rounded-xl mb-4 border"
                  style={{
                    background: `linear-gradient(135deg, ${tpl.accent}22, transparent)`,
                    borderColor: `${tpl.accent}44`,
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: tpl.accent }} />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">{tpl.name}</h4>
                <p className="text-white/65 text-sm leading-relaxed">{tpl.desc}</p>
              </motion.div>
            );
          })}

          {/* Multilayer payoff card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: TEMPLATE_HIGHLIGHTS.length * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 via-violet-500/[0.04] to-transparent backdrop-blur-xl p-6 overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
            <div className="flex items-center justify-center w-11 h-11 rounded-xl mb-4 border border-cyan-300/40 bg-gradient-to-br from-cyan-300/25 to-transparent">
              <Boxes className="w-5 h-5 text-cyan-200" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Templates inside templates</h4>
            <p className="text-white/70 text-sm leading-relaxed">
              Portals inside a template open onto layouts of their own. Double-click Storyboard for a shot
              sequence, Moodboard for a reference wall, or a Persona for a full sheet — already built.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
