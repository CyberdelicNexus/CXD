"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCXDStore } from "@/store/cxd-store";
import {
  WIZARD_STEPS,
  SENSORY_DOMAINS,
  PRESENCE_TYPES,
  STATE_QUADRANTS,
  TRAIT_QUADRANTS,
} from "@/types/cxd-schema";
import { RealityPlanesEditor } from "@/components/cxd/reality-planes-editor";
import { ShimmerGrid } from "@/components/ui/shimmer-grid";
import { cn, extractCenterColor, hexToRgba } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
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
  Target,
  Lightbulb,
  Users,
  Rocket,
  Layout,
  Map,
  ListTodo,
  ArrowRight,
  Maximize2,
  X,
  Palette,
  LayoutGrid,
  Square,
} from "lucide-react";
import { FRAMING_TYPES, getFramingType, type FramingStartMode } from "@/types/framing-types";
import { createPortal } from "react-dom";
import { NoteRichTextEditor } from "@/components/cxd/canvas/note-rich-text-editor";

const stepIcons: Record<string, React.ReactNode> = {
  "Intention Core": <Target className="w-5 h-5" />,
  "Desired Change": <Lightbulb className="w-5 h-5" />,
  "Human Context": <Users className="w-5 h-5" />,
  World: <Globe className="w-5 h-5" />,
  Story: <BookOpen className="w-5 h-5" />,
  Magic: <Wand2 className="w-5 h-5" />,
  "Reality Planes": <Layers className="w-5 h-5" />,
  "Sensory Domains": <Eye className="w-5 h-5" />,
  "Presence Types": <Radio className="w-5 h-5" />,
  "State Mapping": <Brain className="w-5 h-5" />,
  "Trait Mapping": <Heart className="w-5 h-5" />,
};

const SENSORY_METADATA: Record<string, { icon: React.ReactNode; color: string; colorRaw: string }> = {
  visual: { icon: <Eye className="w-5 h-5" />, color: "from-blue-950 to-blue-400", colorRaw: "59, 130, 246" },
  auditory: { icon: <Ear className="w-5 h-5" />, color: "from-indigo-950 to-indigo-400", colorRaw: "99, 102, 241" },
  olfactory: { icon: <Wind className="w-5 h-5" />, color: "from-teal-950 to-teal-400", colorRaw: "20, 184, 166" },
  gustatory: { icon: <Apple className="w-5 h-5" />, color: "from-rose-950 to-rose-400", colorRaw: "244, 63, 94" },
  haptic: { icon: <Fingerprint className="w-5 h-5" />, color: "from-purple-950 to-purple-400", colorRaw: "168, 85, 247" },
};

const PRESENCE_METADATA: Record<string, { icon: React.ReactNode; color: string; colorRaw: string }> = {
  mental: { icon: <Brain className="w-5 h-5" />, color: "from-blue-950 to-blue-400", colorRaw: "59, 130, 246" },
  emotional: { icon: <Heart className="w-5 h-5" />, color: "from-red-950 to-red-400", colorRaw: "239, 68, 68" },
  social: { icon: <Users className="w-5 h-5" />, color: "from-violet-950 to-violet-400", colorRaw: "139, 92, 246" },
  embodied: { icon: <PersonStanding className="w-5 h-5" />, color: "from-orange-950 to-orange-400", colorRaw: "249, 115, 22" },
  environmental: { icon: <Globe className="w-5 h-5" />, color: "from-emerald-950 to-emerald-400", colorRaw: "16, 185, 129" },
  active: { icon: <Zap className="w-5 h-5" />, color: "from-yellow-950 to-yellow-400", colorRaw: "234, 179, 8" },
};

// Group steps by phase for better cognitive organization
const WIZARD_PHASES = [
  { name: "Intent", steps: [0] },
  { name: "Objectives", steps: [1] },
  { name: "Audience", steps: [2] },
  { name: "Meaning", steps: [3, 4, 5] },
  { name: "Structure", steps: [6, 7, 8] },
  { name: "Transformation", steps: [9, 10] },
];

// Convert plain text to HTML paragraphs for the rich text editor
function textToHtml(text: string): string {
  if (!text) return "<p></p>";
  return text.split("\n").map(line => `<p>${line || "<br>"}</p>`).join("");
}

// Convert HTML back to plain text, preserving line breaks between paragraphs
function htmlToText(html: string): string {
  if (!html) return "";
  // Replace closing </p> tags with newline before stripping HTML
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p>/gi, "");
  const div = document.createElement("div");
  div.innerHTML = withBreaks;
  return (div.textContent || div.innerText || "").trim();
}

// Textarea with vertical resize and expand-to-fullscreen rich editor
function ExpandableTextarea({
  value,
  onChange,
  placeholder,
  className,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [richValue, setRichValue] = useState("");

  const handleOpen = useCallback(() => {
    setRichValue(textToHtml(value));
    setIsExpanded(true);
  }, [value]);

  const handleRichChange = useCallback((html: string) => {
    setRichValue(html);
    onChange(htmlToText(html));
  }, [onChange]);

  return (
    <>
      <div className="relative group/expand">
        <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("resize-y", className)}
        />
        <button
          type="button"
          onClick={handleOpen}
          className="absolute top-2 right-2 rounded bg-black/40 p-1 text-white/50 opacity-0 group-hover/expand:opacity-100 hover:bg-black/60 hover:text-white/80 transition-all"
          title="Expand editor"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {isExpanded && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-6"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setIsExpanded(false); }}
        >
          <div
            className="relative w-full max-w-3xl max-h-[85vh] overflow-visible rounded-xl border border-white/15 p-5 shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #1a0a2e 0%, #16082a 50%, #0d0618 100%)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 rounded bg-black/35 p-1 text-white/85 hover:bg-black/55 hover:text-white z-10"
              onClick={() => setIsExpanded(false)}
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="max-h-[calc(85vh-2.5rem)] overflow-y-auto pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(167,139,250,0.65)_rgba(255,255,255,0.08)]">
              <div className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold text-white/90 pr-8">{label || "Edit"}</h3>
                <div className="h-px bg-white/10" />
                <div className="min-h-[420px]">
                  <NoteRichTextEditor
                    value={richValue}
                    textColor="#e2e0ea"
                    isSelected
                    isFocusMode
                    onChange={handleRichChange}
                    onBlurCard={() => {}}
                    onFocusBody={() => {}}
                    onHeightChange={() => {}}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function CXDWizard() {
  const {
    getCurrentProject,
    setWizardStep,
    completeWizard,
    setFramingType,
    updateContextWorld,
    updateContextStory,
    updateContextMagic,
    updateIntentionProjectName,
    updateIntentionMainConcept,
    updateIntentionCoreMessage,
    updateDesiredInsights,
    updateDesiredFeelings,
    updateDesiredStates,
    updateDesiredKnowledge,
    updateHumanAudienceNeeds,
    updateHumanAudienceDesires,
    updateHumanUserRole,
    updateSensoryDomain,
    updatePresenceType,
    updateStateMapping,
    updateTraitMapping,
  } = useCXDStore();

  const project = getCurrentProject();
  const [currentStep, setCurrentStep] = useState(
    project?.currentWizardStep || 0,
  );
  const [showCompletion, setShowCompletion] = useState(false);
  const stepNavRef = useRef<HTMLDivElement>(null);
  const stepButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Get the canvas view mode setter for navigation
  const { setCanvasViewMode } = useCXDStore();

  // Auto-scroll step navigation to keep active step visible
  const scrollToStep = useCallback((stepIndex: number) => {
    const button = stepButtonRefs.current[stepIndex];
    const container = stepNavRef.current;
    if (button && container) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;
      const buttonCenter =
        buttonRect.left -
        containerRect.left +
        scrollLeft +
        buttonRect.width / 2;
      const containerCenter = containerRect.width / 2;
      const targetScroll = buttonCenter - containerCenter;
      container.scrollTo({ left: targetScroll, behavior: "smooth" });
    }
  }, []);

  // Scroll to active step when it changes
  useEffect(() => {
    scrollToStep(currentStep);
  }, [currentStep, scrollToStep]);

  if (!project) return null;

  // Dynamic background based on canvas background
  const canvasBackground = project.canvasBackground || 'radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)';
  const centerColor = extractCenterColor(canvasBackground);
  const cardBgColor = hexToRgba(centerColor, 0.7);

  const currentStepData = WIZARD_STEPS[currentStep];

  // ── Framing type theming ─────────────────────────────────────────
  // The chosen framing type re-words steps (labels/questions) without
  // changing the underlying schema. 'experience' has no overrides.
  const framingTypeDef = getFramingType(project?.framingType);
  const needsTypePick = !!project && !project.framingType && !project.wizardCompleted;
  const [startMode, setStartMode] = useState<FramingStartMode>('populate');

  const sectionSteps = WIZARD_STEPS.filter((s) => s.sectionId === currentStepData.sectionId);
  const stepIdxInSection = sectionSteps.findIndex((s) => s.id === currentStepData.id);
  const stepTheme = framingTypeDef.sectionThemes[currentStepData.sectionId];
  // Multi-step sections (World/Story/Magic) keep their per-step titles under a
  // themed prefix and draw per-step questions from the theme's subQuestions.
  const themedTitle = stepTheme
    ? sectionSteps.length > 1
      ? `${stepTheme.label}: ${currentStepData.title}`
      : stepTheme.label
    : currentStepData.title;
  const themedQuestion = stepTheme
    ? sectionSteps.length > 1
      ? stepTheme.subQuestions?.[stepIdxInSection] ?? currentStepData.question
      : stepTheme.question
    : currentStepData.question;
  const themedIntent = stepTheme?.intent ?? currentStepData.intent;

  // Progress starts at 0% for first step and reaches 100% on last step
  // Map steps 0-10 to 0%-100% progress
  const progress = currentStep === WIZARD_STEPS.length - 1
    ? 100  // Last step shows 100%
    : (currentStep / (WIZARD_STEPS.length - 1)) * 100;

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setWizardStep(nextStep);
    } else {
      // Show completion screen instead of immediately completing
      setShowCompletion(true);
    }
  };

  const handleComplete = (destination: 'canvas' | 'hexagon' | 'plan') => {
    completeWizard(startMode);
    setCanvasViewMode(destination);

    // AI Composer: pick the best-fitting template from the framing summary and
    // set it up on the (blank) canvas. Fire-and-forget — the canvas mounts
    // immediately; the template lands (and the viewport auto-frames onto it)
    // when the suggestion returns. Falls back to the Intention Core starter if
    // the AI is unavailable, so the choice never yields an empty canvas.
    if (startMode === 'ai-template') {
      const state = useCXDStore.getState();
      const project = state.getCurrentProject();
      if (!project) return;
      (async () => {
        let templateId = 'qs-intention-core';
        try {
          const { framingSummaryPrompt } = await import('@/lib/framing-to-canvas');
          const res = await fetch('/api/ai/suggest-template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary: framingSummaryPrompt(project), provider: 'gemini' }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.templateId) templateId = data.templateId;
          }
        } catch {
          // fall through to the default template
        }
        const { TEMPLATES, instantiateTemplate, templateBounds } = await import('@/lib/templates');
        const tpl = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
        const { elements, edges } = instantiateTemplate(tpl);
        const live = useCXDStore.getState();
        live.addCanvasElements(elements);
        if (edges.length > 0) live.addCanvasEdges(edges);
        const bbox = templateBounds(elements);
        if (bbox) live.setPendingCanvasFitBounds(bbox);
      })();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      setWizardStep(prevStep);
    }
  };

  const handleSkip = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setWizardStep(nextStep);
    }
  };

  const renderStepContent = () => {
    const step = currentStepData;

    // Intention Core step - Project Name, Main Concept, Core Message
    if (step.sectionId === "intentionCore") {
      return (
        <div className="space-y-6 !container">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Project Name</Label>
            <Input
              placeholder="Name your experience..."
              value={project.intentionCore?.projectName || project.name || ""}
              onChange={(e) => updateIntentionProjectName(e.target.value)}
              className="bg-input border-border focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Main Concept</Label>
            <p className="text-xs text-muted-foreground">
              What is the big idea behind this experience?
            </p>
            <ExpandableTextarea
              placeholder="Describe the central concept..."
              value={project.intentionCore?.mainConcept || ""}
              onChange={(v) => updateIntentionMainConcept(v)}
              label="Main Concept"
              className="min-h-[100px] bg-input border-border focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Core Message</Label>
            <p className="text-xs text-muted-foreground">
              What essential message should participants receive? This becomes
              the center of your canvas.
            </p>
            <ExpandableTextarea
              placeholder="The core message participants will take away..."
              value={project.intentionCore?.coreMessage || ""}
              onChange={(v) => updateIntentionCoreMessage(v)}
              label="Core Message"
              className="min-h-[100px] bg-input border-border focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      );
    }

    // Desired Change step - Insights, Feelings, States, Knowledge
    if (step.sectionId === "desiredChange") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 w-full max-w-5xl mx-auto">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Insights</Label>
            <p className="text-xs text-muted-foreground">
              What insights should participants gain?
            </p>
            <ExpandableTextarea
              placeholder="New understanding, perspectives, realizations..."
              value={project.desiredChange?.insights || ""}
              onChange={(v) => updateDesiredInsights(v)}
              label="Insights"
              className="min-h-[100px] bg-input border-border text-sm focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Feelings</Label>
            <p className="text-xs text-muted-foreground">
              What feelings should be evoked?
            </p>
            <ExpandableTextarea
              placeholder="Emotional responses, sensations, affects..."
              value={project.desiredChange?.feelings || ""}
              onChange={(v) => updateDesiredFeelings(v)}
              label="Feelings"
              className="min-h-[100px] bg-input border-border text-sm focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">States</Label>
            <p className="text-xs text-muted-foreground">
              What states should be induced?
            </p>
            <ExpandableTextarea
              placeholder="Mental states, altered consciousness, flow..."
              value={project.desiredChange?.states || ""}
              onChange={(v) => updateDesiredStates(v)}
              label="States"
              className="min-h-[100px] bg-input border-border text-sm focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Knowledge</Label>
            <p className="text-xs text-muted-foreground">
              What knowledge should be imparted?
            </p>
            <ExpandableTextarea
              placeholder="Information, skills, understanding..."
              value={project.desiredChange?.knowledge || ""}
              onChange={(v) => updateDesiredKnowledge(v)}
              label="Knowledge"
              className="min-h-[100px] bg-input border-border text-sm focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      );
    }

    // Human Context step - Audience Needs, Desires, User Role
    if (step.sectionId === "humanContext") {
      return (
        <div className="space-y-6 !container">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Audience Needs</Label>
            <p className="text-xs text-muted-foreground">
              What needs does your audience have that this experience addresses?
            </p>
            <ExpandableTextarea
              placeholder="Unmet needs, pain points, aspirations..."
              value={project.humanContext?.audienceNeeds || ""}
              onChange={(v) => updateHumanAudienceNeeds(v)}
              label="Audience Needs"
              className="min-h-[100px] bg-input border-border focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Audience Desires</Label>
            <p className="text-xs text-muted-foreground">
              What desires drive your audience to seek this experience?
            </p>
            <ExpandableTextarea
              placeholder="Motivations, wants, hopes..."
              value={project.humanContext?.audienceDesires || ""}
              onChange={(v) => updateHumanAudienceDesires(v)}
              label="Audience Desires"
              className="min-h-[100px] bg-input border-border focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">User Role</Label>
            <p className="text-xs text-muted-foreground">
              What role will participants play? (Observer, protagonist,
              co-creator?)
            </p>
            <ExpandableTextarea
              placeholder="Describe participant agency and involvement..."
              value={project.humanContext?.userRole || ""}
              onChange={(v) => updateHumanUserRole(v)}
              label="User Role"
              className="min-h-[100px] bg-input border-border focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      );
    }

    // Context and Meaning steps (World, Story, Magic)
    if (step.sectionId === "contextAndMeaning") {
      const getValue = () => {
        if (step.title === "World")
          return project.contextAndMeaning?.world || "";
        if (step.title === "Story")
          return project.contextAndMeaning?.story || "";
        return project.contextAndMeaning?.magic || "";
      };
      const handleChange = (value: string) => {
        if (step.title === "World") updateContextWorld(value);
        else if (step.title === "Story") updateContextStory(value);
        else updateContextMagic(value);
      };
      return (
        <div className="space-y-4 w-full">
          <ExpandableTextarea
            placeholder="Describe your vision..."
            value={getValue()}
            onChange={(v) => handleChange(v)}
            label={step.title}
            className="min-h-[200px] bg-input border-border focus:ring-2 focus:ring-primary/50 w-full"
          />
          {step.subQuestions && (
            <div className="space-y-2 w-full">
              <p className="text-sm text-muted-foreground font-medium">
                Consider:
              </p>
              <ul className="space-y-1 w-full">
                {(stepTheme && sectionSteps.length === 1
                  ? stepTheme.subQuestions ?? step.subQuestions
                  : step.subQuestions
                ).map((q, i) => (
                  <li
                    key={i}
                    className="text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <span className="text-primary">•</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // Reality Planes step (toggles with drag-and-drop reordering)
    if (step.sectionId === "realityPlanes") {
      return (
        <div className="space-y-6 w-full">
          <RealityPlanesEditor />
        </div>
      );
    }

    // Sensory Domains step - categorical scale
    if (step.sectionId === "sensoryDomains") {
      const intensityLevels = [
        { value: 0, label: "None" },
        { value: 25, label: "Minimal" },
        { value: 50, label: "Moderate" },
        { value: 75, label: "Significant" },
        { value: 100, label: "Primary" },
      ];

      const getClosestLevel = (value: number) => {
        return intensityLevels.reduce((prev, curr) =>
          Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
        ).value;
      };

      return (
        <div className="space-y-8 w-full">
          {SENSORY_DOMAINS.map((domain) => {
            const currentValue = getClosestLevel(project.sensoryDomains?.[domain.code] ?? 3);
            const meta = SENSORY_METADATA[domain.code];
            return (
              <div key={domain.code} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${meta.color} bg-opacity-10 text-white shadow-sm`}>
                    {meta.icon}
                  </div>
                  <div>
                    <Label className="text-base font-semibold tracking-tight">{domain.label}</Label>
                    <p className="text-xs text-muted-foreground">
                      {domain.description}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {intensityLevels.map((level) => {
                    const isSelected = currentValue === level.value;
                    const baseClass = `flex-1 py-2.5 px-3 text-sm rounded-xl transition-all duration-300 flex items-center justify-center`;
                    let intensityStyle = "";

                    if (isSelected) {
                      const color = meta.color;
                      const raw = meta.colorRaw;
                      if (level.value === 0) intensityStyle = "bg-zinc-600 text-white shadow-md";
                      else if (level.value === 25) intensityStyle = `bg-gradient-to-br ${color} opacity-70 text-white shadow-sm`;
                      else if (level.value === 50) intensityStyle = `bg-gradient-to-br ${color} opacity-90 text-white shadow-[0_0_15px_rgba(${raw},0.3)]`;
                      else if (level.value === 75) intensityStyle = `bg-gradient-to-br ${color} text-white shadow-[0_0_20px_rgba(${raw},0.4)]`;
                      else if (level.value === 100) intensityStyle = `bg-gradient-to-br ${color} text-white shadow-[0_0_30px_rgba(${raw},0.6)] scale-105 font-bold border border-white/20`;
                    } else {
                      intensityStyle = "bg-secondary/40 hover:bg-secondary/60 text-muted-foreground/70 hover:text-foreground";
                    }

                    return (
                      <button
                        key={level.value}
                        onClick={() => updateSensoryDomain(domain.code, level.value)}
                        className={`${baseClass} ${intensityStyle}`}
                      >
                        {level.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Presence Types step - categorical scale
    if (step.sectionId === "presence") {
      const presenceLevels = [
        { value: 0, label: "None" },
        { value: 25, label: "Minimal" },
        { value: 50, label: "Moderate" },
        { value: 75, label: "Significant" },
        { value: 100, label: "Primary" },
      ];

      const getClosestLevel = (value: number) => {
        return presenceLevels.reduce((prev, curr) =>
          Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
        ).value;
      };

      return (
        <div className="space-y-8 w-full">
          {PRESENCE_TYPES.map((presence) => {
            const currentValue = getClosestLevel(project.presenceTypes[presence.code]);
            const meta = PRESENCE_METADATA[presence.code];
            return (
              <div key={presence.code} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${meta.color} bg-opacity-10 text-white shadow-sm`}>
                    {meta.icon}
                  </div>
                  <div>
                    <Label className="text-base font-semibold tracking-tight">
                      {presence.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {presence.description}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {presenceLevels.map((level) => {
                    const isSelected = currentValue === level.value;
                    const baseClass = `flex-1 py-2.5 px-3 text-sm rounded-xl transition-all duration-300 flex items-center justify-center`;
                    let intensityStyle = "";

                    if (isSelected) {
                      const color = meta.color;
                      const raw = meta.colorRaw;
                      if (level.value === 0) intensityStyle = "bg-zinc-600 text-white shadow-md";
                      else if (level.value === 25) intensityStyle = `bg-gradient-to-br ${color} opacity-70 text-white shadow-sm`;
                      else if (level.value === 50) intensityStyle = `bg-gradient-to-br ${color} opacity-90 text-white shadow-[0_0_15px_rgba(${raw},0.3)]`;
                      else if (level.value === 75) intensityStyle = `bg-gradient-to-br ${color} text-white shadow-[0_0_20px_rgba(${raw},0.4)]`;
                      else if (level.value === 100) intensityStyle = `bg-gradient-to-br ${color} text-white shadow-[0_0_30px_rgba(${raw},0.6)] scale-105 font-bold border border-white/20`;
                    } else {
                      intensityStyle = "bg-secondary/40 hover:bg-secondary/60 text-muted-foreground/70 hover:text-foreground";
                    }

                    return (
                      <button
                        key={level.value}
                        onClick={() => updatePresenceType(presence.code, level.value)}
                        className={`${baseClass} ${intensityStyle}`}
                      >
                        {level.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // State Mapping step - with examples
    if (step.sectionId === "stateMapping") {
      const stateExamples: Record<string, string> = {
        cognitive: "e.g., Heightened focus, expanded awareness, curiosity, clarity, creative thinking, pattern recognition...",
        emotional: "e.g., Wonder, awe, joy, serenity, excitement, anticipation, gratitude, catharsis...",
        somatic: "e.g., Relaxation, energization, groundedness, lightness, tingling, warmth, breath awareness...",
        relational: "e.g., Connectedness, empathy, belonging, trust, vulnerability, presence with others...",
      };

      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 w-full max-w-5xl mx-auto">
          {STATE_QUADRANTS.map((quadrant) => (
            <div key={quadrant.code} className="space-y-2">
              <Label className="text-sm font-medium">{quadrant.label}</Label>
              <p className="text-xs text-muted-foreground">
                {quadrant.description}
              </p>
              <ExpandableTextarea
                placeholder={stateExamples[quadrant.code] || `Describe ${quadrant.label.toLowerCase()} states...`}
                value={project.stateMapping?.[quadrant.code] ?? ''}
                onChange={(v) => updateStateMapping(quadrant.code, v)}
                label={`State Mapping: ${quadrant.label}`}
                className="min-h-[100px] bg-input border-border text-sm focus:ring-2 focus:ring-primary/50"
              />
            </div>
          ))}
        </div>
      );
    }

    // Trait Mapping step
    if (step.sectionId === "traitMapping") {
      const traitExamples: Record<string, string> = {
        cognitive: "e.g., Strategic thinking, discernment, cognitive flexibility, systems thinking, creative confidence...",
        emotional: "e.g., Emotional regulation, resilience, compassion, gratitude, inner calm, optimism...",
        somatic: "e.g., Nervous system balance, embodied awareness, sustainable energy, grounded posture, restorative habits...",
        relational: "e.g., Deep listening, trust-building, authentic communication, healthy boundaries, collaborative leadership...",
      };

      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 h-fit w-full max-w-5xl mx-auto">
          {TRAIT_QUADRANTS.map((quadrant) => (
            <div key={quadrant.code} className="space-y-2">
              <Label className="text-sm font-medium">{quadrant.label}</Label>
              <p className="text-xs text-muted-foreground">
                {quadrant.description}
              </p>
              <ExpandableTextarea
                placeholder={traitExamples[quadrant.code] || `Describe ${quadrant.label.toLowerCase()} traits...`}
                value={project.traitMapping?.[quadrant.code] ?? ''}
                onChange={(v) => updateTraitMapping(quadrant.code, v)}
                label={`Trait Mapping: ${quadrant.label}`}
                className="min-h-[100px] bg-input border-border text-sm focus:ring-2 focus:ring-primary/50"
              />
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  // Find current phase
  const getCurrentPhase = () => {
    for (const phase of WIZARD_PHASES) {
      if (phase.steps.includes(currentStep)) return phase.name;
    }
    return "";
  };

  return (
    <div className="min-h-screen relative flex justify-center py-8" style={{ background: canvasBackground }}>
      {/* Interactive Shimmer Grid Background */}
      <ShimmerGrid
        dotSize={1.5}
        dotSpacing={24}
        baseColor="rgba(110, 56, 236, 0.1)"
        hoverColor="rgba(138, 99, 255, 0.5)"
        hoverSize={400}
        smoothing={60}
      />

      {/* Left Sidebar - Vertical Progress Bar (Fixed, centered vertically) */}
      <div className="fixed left-4 lg:left-[calc(50%-28rem)] 2xl:left-[180px] top-1/2 -translate-y-1/2 z-20 flex flex-col items-start gap-3">
        {/* Progress bar with phase dots and labels */}
        <div className="relative flex items-center gap-3 h-[500px]">
          {/* Phase labels (horizontal text) - LEFT SIDE — hidden below 2xl */}
          <div className="relative h-full w-24 hidden 2xl:block">
            {WIZARD_PHASES.map((phase, index) => {
              const phaseStartStep = phase.steps[0];
              const totalSteps = WIZARD_STEPS.length;
              const position = (phaseStartStep / totalSteps) * 100;

              const isCurrentPhase = phase.steps.includes(currentStep);
              const isCompletedPhase = phase.steps.every(s => s < currentStep);
              const isReached = progress >= position;

              return (
                <div
                  key={phase.name}
                  className="absolute right-0 -translate-y-1/2"
                  style={{ top: `${position}%` }}
                >
                  <span
                    className={cn(
                      "text-xs font-medium uppercase tracking-wider whitespace-nowrap transition-all duration-300",
                      isCurrentPhase
                        ? "text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 font-bold"
                        : isReached
                          ? "text-indigo-300"
                          : "text-muted-foreground/60"
                    )}
                  >
                    {phase.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Main vertical progress bar */}
          <div className="relative w-2 bg-secondary/50 rounded-full overflow-visible backdrop-blur-sm border border-white/5 h-full">
            <div
              className="absolute top-0 w-full rounded-full bg-gradient-to-b from-indigo-600 via-violet-500 to-indigo-400 transition-all duration-500 ease-out overflow-hidden"
              style={{ height: `${progress}%` }}
            />

            {/* Phase dots positioned along the bar */}
            {WIZARD_PHASES.map((phase, index) => {
              // Calculate position based on phase steps
              const phaseStartStep = phase.steps[0];
              const totalSteps = WIZARD_STEPS.length;
              const position = (phaseStartStep / totalSteps) * 100;

              const isCurrentPhase = phase.steps.includes(currentStep);
              const isCompletedPhase = phase.steps.every(s => s < currentStep);
              const isReached = progress >= position;

              return (
                <div
                  key={phase.name}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ top: `${position}%` }}
                >
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full border-2 transition-all duration-300",
                      isCurrentPhase
                        ? "bg-gradient-to-br from-indigo-400 to-purple-500 border-white shadow-lg shadow-purple-500/50 scale-125"
                        : isReached
                          ? "bg-indigo-500 border-indigo-300"
                          : "bg-secondary border-border"
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Container with gap — px adds space so sidebars don't overlap at smaller screens */}
      <div className="flex gap-[10px] max-w-4xl w-full px-16 2xl:px-4 relative z-10">

        {/* Center Column - Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="w-full">
            {/* Current step indicator */}
            <div className="mb-6 flex items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {getCurrentPhase()}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {WIZARD_STEPS.length}
              </span>
            </div>

            {/* Step Navigation - Horizontal scroll with hidden scrollbar */}
            <div
              ref={stepNavRef}
              className="w-full mb-8 overflow-x-auto scrollbar-hide"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div className="flex gap-2 pb-2 min-w-max">
                {WIZARD_STEPS.map((step, index) => (
                  <button
                    key={step.id}
                    ref={(el) => {
                      stepButtonRefs.current[index] = el;
                    }}
                    onClick={() => {
                      setCurrentStep(index);
                      setWizardStep(index);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all flex-shrink-0 ${index === currentStep
                      ? "bg-gradient-to-r from-indigo-700 to-purple-600 text-white glow-purple"
                      : index < currentStep
                        ? "bg-indigo-900/30 text-indigo-300 border border-purple-500/20"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                      }`}
                  >
                    {index < currentStep ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      stepIcons[step.title] || <Sparkles className="w-4 h-4" />
                    )}
                    {step.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content Card */}
            <Card
              className="glass-purple rounded-xl h-fit overflow-visible"
              style={{ backgroundColor: cardBgColor }}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    {stepIcons[currentStepData.title] || (
                      <Sparkles className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl">
                      {themedTitle}
                    </CardTitle>
                    <CardDescription>{themedQuestion}</CardDescription>
                  </div>
                </div>
                {/* Step Intent - explains why this step matters */}
                {themedIntent && (
                  <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-sm text-muted-foreground italic">
                      <span className="text-primary font-medium">Intent:</span>{" "}
                      {themedIntent}
                    </p>
                  </div>
                )}
              </CardHeader>
              <CardContent className="overflow-visible h-full flex">
                <div className="pr-4 pb-4 flex h-full w-full items-center justify-center flex-col mx-[0px] overflow-visible">
                  {renderStepContent()}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Right Sidebar - Navigation Buttons (Fixed, centered vertically) */}
        <div className="fixed right-4 lg:right-[calc(50%-28rem)] 2xl:right-[230px] top-1/2 -translate-y-1/2 z-20 w-16 flex flex-col items-center">
          <div className="flex flex-col gap-4 items-center">
            {/* Previous Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300",
                  "border backdrop-blur-sm",
                  currentStep === 0
                    ? "opacity-30 cursor-not-allowed bg-secondary/30 border-border/50"
                    : "bg-secondary/50 hover:bg-gradient-to-br hover:from-indigo-600/30 hover:to-purple-600/30 border-border/50 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/20 cursor-pointer hover:scale-105 active:scale-95"
                )}
              >
                <ChevronLeft className={cn(
                  "w-6 h-6 transition-colors",
                  currentStep === 0 ? "text-muted-foreground/50" : "text-foreground"
                )} />
              </button>
              <span className={cn(
                "text-[10px] text-center transition-colors uppercase tracking-wider",
                currentStep === 0 ? "text-muted-foreground/50" : "text-muted-foreground"
              )}>
                Previous
              </span>
            </div>

            {/* Current step indicator */}
            <div className="my-4 px-3 py-2 rounded-lg bg-secondary/50 backdrop-blur-sm border border-white/5">
              <div className="text-2xl font-bold text-center text-primary">
                {currentStep + 1}
              </div>
              <div className="text-[8px] text-muted-foreground text-center uppercase tracking-wider">
                of {WIZARD_STEPS.length}
              </div>
            </div>

            {/* Next/Complete Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleNext}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300",
                  "border border-purple-500/50 backdrop-blur-sm cursor-pointer",
                  "bg-gradient-to-br from-indigo-600 to-purple-600",
                  "hover:from-indigo-500 hover:to-purple-500",
                  "hover:shadow-lg hover:shadow-purple-500/40",
                  "hover:scale-105 active:scale-95"
                )}
              >
                {currentStep === WIZARD_STEPS.length - 1 ? (
                  <Check className="w-6 h-6 text-white" />
                ) : (
                  <ChevronRight className="w-6 h-6 text-white" />
                )}
              </button>
              <span className="text-[10px] text-center text-muted-foreground uppercase tracking-wider">
                {currentStep === WIZARD_STEPS.length - 1 ? "Complete" : "Next"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Framing Type Picker — shown once, before the first step */}
      {needsTypePick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="max-w-3xl w-full mx-4 rounded-2xl border border-border/50 p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300"
            style={{ backgroundColor: cardBgColor }}
          >
            <h2 className="text-2xl font-bold text-center mb-2">
              What are you framing?
            </h2>
            <p className="text-center text-muted-foreground mb-8 max-w-lg mx-auto">
              The hypercube methodology adapts its language to your practice.
              Same backbone, different lens. Pick the frame that fits.
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              {FRAMING_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setFramingType(t.id)}
                  className="group p-4 rounded-xl border border-border/50 bg-secondary/40 hover:bg-secondary/70 hover:border-violet-500/40 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none mt-0.5">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground group-hover:text-violet-300 transition-colors">
                        {t.name}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{t.tagline}</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1.5">{t.audience}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all mt-1" />
                  </div>
                </button>
              ))}
            </div>

            <p className="text-center text-[11px] text-muted-foreground/50 mt-6">
              Custom framings, building your own hypercube from a dimension library, are coming later.
            </p>
          </div>
        </div>
      )}

      {/* Completion Screen Overlay */}
      {showCompletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="max-w-2xl w-full mx-4 rounded-2xl border border-border/50 p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300"
            style={{ backgroundColor: cardBgColor }}
          >
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Check className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center mb-2">
              Experience Framework Complete!
            </h2>
            <p className="text-center text-muted-foreground mb-8 max-w-md mx-auto">
              You've defined the foundation of your experience. Now it's time to bring your vision to life.
            </p>

            {/* Start Mode — how the canvas begins */}
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-center">
                How should your canvas start?
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: 'populate' as FramingStartMode,
                      icon: LayoutGrid,
                      label: 'Framing blocks',
                      desc: 'Your framing as a connected board: live cards, personas, and prompts',
                      badge: 'Recommended',
                    },
                    {
                      id: 'ai-template' as FramingStartMode,
                      icon: Sparkles,
                      label: 'AI Composer',
                      desc: 'AI reads your framing and sets up the best-fitting template',
                    },
                    {
                      id: 'blank' as FramingStartMode,
                      icon: Square,
                      label: 'Blank',
                      desc: 'Start empty; drag blocks in anytime',
                    },
                  ]
                ).map((opt) => {
                  const OptIcon = opt.icon;
                  const selected = startMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setStartMode(opt.id)}
                      className={cn(
                        "relative p-3 rounded-xl border text-left transition-all duration-200",
                        selected
                          ? "border-violet-500/60 bg-violet-500/10 shadow-[0_0_16px_rgba(139,92,246,0.15)]"
                          : "border-border/50 bg-secondary/40 hover:bg-secondary/70 hover:border-border",
                      )}
                    >
                      {opt.badge && (
                        <span className="absolute -top-2 right-2 px-1.5 py-0.5 text-[9px] font-medium bg-violet-500/80 text-white rounded-full">
                          {opt.badge}
                        </span>
                      )}
                      <OptIcon className={cn("w-4 h-4 mb-1.5", selected ? "text-violet-400" : "text-muted-foreground")} />
                      <div className={cn("text-xs font-semibold", selected ? "text-foreground" : "text-foreground/80")}>
                        {opt.label}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* What's Next Section */}
            <div className="space-y-4 mb-8">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-center">
                What would you like to do next?
              </h3>

              {/* Destination Options */}
              <div className="grid gap-3">
                {/* Canvas - Primary CTA with gradient */}
                <button
                  onClick={() => handleComplete('canvas')}
                  className="group relative w-full p-4 rounded-xl text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                >
                  {/* Gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 opacity-90 group-hover:opacity-100 transition-opacity" />
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  {/* Glow */}
                  <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] rounded-xl" />

                  <div className="relative flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
                      <Layout className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">Open Canvas</span>
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-white/20 text-white rounded-full">
                          Recommended
                        </span>
                      </div>
                      <p className="text-sm text-white/80">
                        Start designing your experience with the infinite canvas
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Map View */}
                <button
                  onClick={() => handleComplete('hexagon')}
                  className="group w-full p-4 rounded-xl bg-secondary/50 hover:bg-secondary/80 border border-border/50 hover:border-border text-left transition-all duration-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Map className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold">Explore Map View</span>
                      <p className="text-sm text-muted-foreground">
                        Visualize your experience as a hypercube structure
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </div>
                </button>

                {/* Plan View */}
                <button
                  onClick={() => handleComplete('plan')}
                  className="group w-full p-4 rounded-xl bg-secondary/50 hover:bg-secondary/80 border border-border/50 hover:border-border text-left transition-all duration-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                      <ListTodo className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold">Start Planning</span>
                      <p className="text-sm text-muted-foreground">
                        Break down your experience into actionable tasks
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              </div>
            </div>

            {/* Back button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                onClick={() => setShowCompletion(false)}
                className="text-muted-foreground"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Go back and refine
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
