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
} from "lucide-react";

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

export function CXDWizard() {
  const {
    getCurrentProject,
    setWizardStep,
    completeWizard,
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
    completeWizard();
    setCanvasViewMode(destination);
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
            <Textarea
              placeholder="Describe the central concept..."
              value={project.intentionCore?.mainConcept || ""}
              onChange={(e) => updateIntentionMainConcept(e.target.value)}
              className="min-h-[100px] bg-input border-border resize-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Core Message</Label>
            <p className="text-xs text-muted-foreground">
              What essential message should participants receive? This becomes
              the center of your canvas.
            </p>
            <Textarea
              placeholder="The core message participants will take away..."
              value={project.intentionCore?.coreMessage || ""}
              onChange={(e) => updateIntentionCoreMessage(e.target.value)}
              className="min-h-[100px] bg-input border-border resize-none focus:ring-2 focus:ring-primary/50"
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
            <Textarea
              placeholder="New understanding, perspectives, realizations..."
              value={project.desiredChange?.insights || ""}
              onChange={(e) => updateDesiredInsights(e.target.value)}
              className="min-h-[100px] bg-input border-border resize-none text-sm focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Feelings</Label>
            <p className="text-xs text-muted-foreground">
              What feelings should be evoked?
            </p>
            <Textarea
              placeholder="Emotional responses, sensations, affects..."
              value={project.desiredChange?.feelings || ""}
              onChange={(e) => updateDesiredFeelings(e.target.value)}
              className="min-h-[100px] bg-input border-border resize-none text-sm focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">States</Label>
            <p className="text-xs text-muted-foreground">
              What states should be induced?
            </p>
            <Textarea
              placeholder="Mental states, altered consciousness, flow..."
              value={project.desiredChange?.states || ""}
              onChange={(e) => updateDesiredStates(e.target.value)}
              className="min-h-[100px] bg-input border-border resize-none text-sm focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Knowledge</Label>
            <p className="text-xs text-muted-foreground">
              What knowledge should be imparted?
            </p>
            <Textarea
              placeholder="Information, skills, understanding..."
              value={project.desiredChange?.knowledge || ""}
              onChange={(e) => updateDesiredKnowledge(e.target.value)}
              className="min-h-[100px] bg-input border-border resize-none text-sm focus:ring-2 focus:ring-primary/50"
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
            <Textarea
              placeholder="Unmet needs, pain points, aspirations..."
              value={project.humanContext?.audienceNeeds || ""}
              onChange={(e) => updateHumanAudienceNeeds(e.target.value)}
              className="min-h-[100px] bg-input border-border resize-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Audience Desires</Label>
            <p className="text-xs text-muted-foreground">
              What desires drive your audience to seek this experience?
            </p>
            <Textarea
              placeholder="Motivations, wants, hopes..."
              value={project.humanContext?.audienceDesires || ""}
              onChange={(e) => updateHumanAudienceDesires(e.target.value)}
              className="min-h-[100px] bg-input border-border resize-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">User Role</Label>
            <p className="text-xs text-muted-foreground">
              What role will participants play? (Observer, protagonist,
              co-creator?)
            </p>
            <Textarea
              placeholder="Describe participant agency and involvement..."
              value={project.humanContext?.userRole || ""}
              onChange={(e) => updateHumanUserRole(e.target.value)}
              className="min-h-[100px] bg-input border-border resize-none focus:ring-2 focus:ring-primary/50"
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
          <Textarea
            placeholder="Describe your vision..."
            value={getValue()}
            onChange={(e) => handleChange(e.target.value)}
            className="min-h-[200px] bg-input border-border resize-none focus:ring-2 focus:ring-primary/50 w-full"
          />
          {step.subQuestions && (
            <div className="space-y-2 w-full">
              <p className="text-sm text-muted-foreground font-medium">
                Consider:
              </p>
              <ul className="space-y-1 w-full">
                {step.subQuestions.map((q, i) => (
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
            const currentValue = getClosestLevel(project.sensoryDomains[domain.code]);
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
              <Textarea
                placeholder={stateExamples[quadrant.code] || `Describe ${quadrant.label.toLowerCase()} states...`}
                value={project.stateMapping[quadrant.code]}
                onChange={(e) =>
                  updateStateMapping(quadrant.code, e.target.value)
                }
                className="min-h-[100px] bg-input border-border resize-none text-sm focus:ring-2 focus:ring-primary/50"
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
              <Textarea
                placeholder={traitExamples[quadrant.code] || `Describe ${quadrant.label.toLowerCase()} traits...`}
                value={project.traitMapping[quadrant.code]}
                onChange={(e) =>
                  updateTraitMapping(quadrant.code, e.target.value)
                }
                className="min-h-[100px] bg-input border-border resize-none text-sm focus:ring-2 focus:ring-primary/50"
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
      <div className="fixed left-[180px] top-1/2 -translate-y-1/2 z-20 flex flex-col items-start gap-3">
        {/* Progress bar with phase dots and labels */}
        <div className="relative flex items-center gap-3 h-[500px]">
          {/* Phase labels (horizontal text) - LEFT SIDE */}
          <div className="relative h-full w-24">
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

      {/* Content Container with gap */}
      <div className="flex gap-[10px] max-w-4xl w-full px-4 relative z-10">

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
              className="gradient-border backdrop-blur h-fit overflow-visible"
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
                      {currentStepData.title}
                    </CardTitle>
                    <CardDescription>{currentStepData.question}</CardDescription>
                  </div>
                </div>
                {/* Step Intent - explains why this step matters */}
                {currentStepData.intent && (
                  <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-sm text-muted-foreground italic">
                      <span className="text-primary font-medium">Intent:</span>{" "}
                      {currentStepData.intent}
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
        <div className="fixed right-[230px] top-1/2 -translate-y-1/2 z-20 w-16 flex flex-col items-center">
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
