'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CXDProject,
  WIZARD_STEPS,
  REALITY_PLANES,
  SENSORY_DOMAINS,
  PRESENCE_TYPES,
  STATE_QUADRANTS,
  TRAIT_QUADRANTS,
  RealityPlaneCode,
} from '@/types/cxd-schema';
import { ShimmerGrid } from '@/components/ui/shimmer-grid';
import { cn, extractCenterColor, hexToRgba } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
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
} from 'lucide-react';

// Step icons — matches the wizard exactly
const stepIcons: Record<string, React.ReactNode> = {
  'Intention Core': <Target className="w-5 h-5" />,
  'Desired Change': <Lightbulb className="w-5 h-5" />,
  'Human Context': <Users className="w-5 h-5" />,
  World: <Globe className="w-5 h-5" />,
  Story: <BookOpen className="w-5 h-5" />,
  Magic: <Wand2 className="w-5 h-5" />,
  'Reality Planes': <Layers className="w-5 h-5" />,
  'Sensory Domains': <Eye className="w-5 h-5" />,
  'Presence Types': <Radio className="w-5 h-5" />,
  'State Mapping': <Brain className="w-5 h-5" />,
  'Trait Mapping': <Heart className="w-5 h-5" />,
};

// Sensory domain metadata — matches the wizard
const SENSORY_METADATA: Record<string, { icon: React.ReactNode; color: string; colorRaw: string }> = {
  visual: { icon: <Eye className="w-5 h-5" />, color: 'from-blue-950 to-blue-400', colorRaw: '59, 130, 246' },
  auditory: { icon: <Ear className="w-5 h-5" />, color: 'from-indigo-950 to-indigo-400', colorRaw: '99, 102, 241' },
  olfactory: { icon: <Wind className="w-5 h-5" />, color: 'from-teal-950 to-teal-400', colorRaw: '20, 184, 166' },
  gustatory: { icon: <Apple className="w-5 h-5" />, color: 'from-rose-950 to-rose-400', colorRaw: '244, 63, 94' },
  haptic: { icon: <Fingerprint className="w-5 h-5" />, color: 'from-purple-950 to-purple-400', colorRaw: '168, 85, 247' },
};

// Presence type metadata — matches the wizard
const PRESENCE_METADATA: Record<string, { icon: React.ReactNode; color: string; colorRaw: string }> = {
  mental: { icon: <Brain className="w-5 h-5" />, color: 'from-blue-950 to-blue-400', colorRaw: '59, 130, 246' },
  emotional: { icon: <Heart className="w-5 h-5" />, color: 'from-red-950 to-red-400', colorRaw: '239, 68, 68' },
  social: { icon: <Users className="w-5 h-5" />, color: 'from-violet-950 to-violet-400', colorRaw: '139, 92, 246' },
  embodied: { icon: <PersonStanding className="w-5 h-5" />, color: 'from-orange-950 to-orange-400', colorRaw: '249, 115, 22' },
  environmental: { icon: <Globe className="w-5 h-5" />, color: 'from-emerald-950 to-emerald-400', colorRaw: '16, 185, 129' },
  active: { icon: <Zap className="w-5 h-5" />, color: 'from-yellow-950 to-yellow-400', colorRaw: '234, 179, 8' },
};

// Phase groupings — matches the wizard
const WIZARD_PHASES = [
  { name: 'Intent', steps: [0] },
  { name: 'Objectives', steps: [1] },
  { name: 'Audience', steps: [2] },
  { name: 'Meaning', steps: [3, 4, 5] },
  { name: 'Structure', steps: [6, 7, 8] },
  { name: 'Transformation', steps: [9, 10] },
];

// Intensity level labels for sensory and presence
const INTENSITY_LEVELS = [
  { value: 0, label: 'None' },
  { value: 25, label: 'Minimal' },
  { value: 50, label: 'Moderate' },
  { value: 75, label: 'Significant' },
  { value: 100, label: 'Primary' },
];

function getClosestLevel(value: number) {
  return INTENSITY_LEVELS.reduce((prev, curr) =>
    Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev,
  );
}

// Read-only text block — shows content or "Not yet defined"
function ReadOnlyField({ label, description, value }: { label: string; description?: string; value: string | undefined }) {
  const hasContent = value && value.trim().length > 0;
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-foreground">{label}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div
        className={cn(
          'rounded-lg px-4 py-3 text-sm leading-relaxed border border-white/5 bg-white/5',
          hasContent ? 'text-foreground/90 whitespace-pre-wrap' : 'italic text-white/30',
        )}
      >
        {hasContent ? value : 'Not yet defined'}
      </div>
    </div>
  );
}

interface ShareFramingPresentationProps {
  project: CXDProject;
  onBack: () => void;
}

export function ShareFramingPresentation({ project, onBack }: ShareFramingPresentationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const stepNavRef = useRef<HTMLDivElement>(null);
  const stepButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Dynamic background based on canvas background
  const canvasBackground = project.canvasBackground || 'radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)';
  const centerColor = extractCenterColor(canvasBackground);
  const cardBgColor = hexToRgba(centerColor, 0.7);

  const currentStepData = WIZARD_STEPS[currentStep];
  const progress = currentStep === WIZARD_STEPS.length - 1
    ? 100
    : (currentStep / (WIZARD_STEPS.length - 1)) * 100;

  // Auto-scroll step navigation to keep active step visible
  const scrollToStep = useCallback((stepIndex: number) => {
    const button = stepButtonRefs.current[stepIndex];
    const container = stepNavRef.current;
    if (button && container) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;
      const buttonCenter =
        buttonRect.left - containerRect.left + scrollLeft + buttonRect.width / 2;
      const containerCenter = containerRect.width / 2;
      const targetScroll = buttonCenter - containerCenter;
      container.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToStep(currentStep);
  }, [currentStep, scrollToStep]);

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Find current phase
  const getCurrentPhase = () => {
    for (const phase of WIZARD_PHASES) {
      if (phase.steps.includes(currentStep)) return phase.name;
    }
    return '';
  };

  // Get plane label from the REALITY_PLANES constant
  const getPlaneLabel = (code: RealityPlaneCode) => {
    const plane = REALITY_PLANES.find((p) => p.code === code);
    return plane?.label || code;
  };

  const getPlaneDescription = (code: RealityPlaneCode) => {
    const plane = REALITY_PLANES.find((p) => p.code === code);
    return plane?.description || '';
  };

  // Render read-only step content
  const renderStepContent = () => {
    const step = currentStepData;

    // Step 0: Intention Core
    if (step.sectionId === 'intentionCore') {
      return (
        <div className="space-y-6 w-full max-w-2xl mx-auto">
          <ReadOnlyField
            label="Project Name"
            value={project.intentionCore?.projectName || project.name}
          />
          <ReadOnlyField
            label="Main Concept"
            description="What is the big idea behind this experience?"
            value={project.intentionCore?.mainConcept}
          />
          <ReadOnlyField
            label="Core Message"
            description="What essential message should participants receive?"
            value={project.intentionCore?.coreMessage}
          />
        </div>
      );
    }

    // Step 1: Desired Change
    if (step.sectionId === 'desiredChange') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-5xl mx-auto">
          <ReadOnlyField
            label="Insights"
            description="What insights should participants gain?"
            value={project.desiredChange?.insights}
          />
          <ReadOnlyField
            label="Feelings"
            description="What feelings should be evoked?"
            value={project.desiredChange?.feelings}
          />
          <ReadOnlyField
            label="States"
            description="What states should be induced?"
            value={project.desiredChange?.states}
          />
          <ReadOnlyField
            label="Knowledge"
            description="What knowledge should be imparted?"
            value={project.desiredChange?.knowledge}
          />
        </div>
      );
    }

    // Step 2: Human Context
    if (step.sectionId === 'humanContext') {
      return (
        <div className="space-y-6 w-full max-w-2xl mx-auto">
          <ReadOnlyField
            label="Audience Needs"
            description="What needs does your audience have that this experience addresses?"
            value={project.humanContext?.audienceNeeds}
          />
          <ReadOnlyField
            label="Audience Desires"
            description="What desires drive your audience to seek this experience?"
            value={project.humanContext?.audienceDesires}
          />
          <ReadOnlyField
            label="User Role"
            description="What role will participants play?"
            value={project.humanContext?.userRole}
          />
        </div>
      );
    }

    // Steps 3-5: Context and Meaning (World, Story, Magic)
    if (step.sectionId === 'contextAndMeaning') {
      const getValue = () => {
        if (step.title === 'World') return project.contextAndMeaning?.world;
        if (step.title === 'Story') return project.contextAndMeaning?.story;
        return project.contextAndMeaning?.magic;
      };
      const content = getValue();
      const hasContent = content && content.trim().length > 0;

      return (
        <div className="space-y-4 w-full max-w-2xl mx-auto">
          <div
            className={cn(
              'rounded-lg px-4 py-4 text-sm leading-relaxed border border-white/5 bg-white/5 min-h-[120px]',
              hasContent ? 'text-foreground/90 whitespace-pre-wrap' : 'italic text-white/30',
            )}
          >
            {hasContent ? content : 'Not yet defined'}
          </div>
          {step.subQuestions && (
            <div className="space-y-2 w-full">
              <p className="text-sm text-muted-foreground font-medium">Consider:</p>
              <ul className="space-y-1 w-full">
                {step.subQuestions.map((q, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary">&#8226;</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // Step 6: Reality Planes
    if (step.sectionId === 'realityPlanes') {
      const planesV2 = project.realityPlanesV2;
      if (planesV2 && planesV2.length > 0) {
        const sorted = [...planesV2].sort((a, b) => a.priority - b.priority);
        return (
          <div className="space-y-3 w-full max-w-2xl mx-auto">
            <p className="text-xs text-muted-foreground">
              Reality planes ordered by priority. Enabled planes are highlighted.
            </p>
            {sorted.map((plane, index) => (
              <div
                key={plane.code}
                className={cn(
                  'flex flex-col gap-2 p-3 rounded-lg border transition-all',
                  plane.enabled
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border/50 bg-card/30 opacity-60',
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium',
                      plane.enabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('font-mono font-semibold', plane.enabled ? 'text-primary' : 'text-muted-foreground')}>
                        {plane.code}
                      </span>
                      <span className="text-sm text-foreground">{getPlaneLabel(plane.code)}</span>
                      {plane.enabled && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{getPlaneDescription(plane.code)}</p>
                  </div>
                </div>
                {plane.enabled && plane.interfaceModality && plane.interfaceModality.trim() && (
                  <div className="ml-9 text-sm text-foreground/80 bg-white/5 rounded px-3 py-2 border border-white/5 whitespace-pre-wrap">
                    {plane.interfaceModality}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }
      // Fallback to legacy percentage-based display
      return (
        <div className="space-y-3 w-full max-w-2xl mx-auto">
          {REALITY_PLANES.map((plane) => {
            const value = project.realityPlanes[plane.code] || 0;
            return (
              <div key={plane.code} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/30">
                <span className="font-mono font-semibold text-primary w-8">{plane.code}</span>
                <span className="text-sm flex-1">{plane.label}</span>
                <span className="text-sm text-muted-foreground">{value}%</span>
              </div>
            );
          })}
        </div>
      );
    }

    // Step 7: Sensory Domains
    if (step.sectionId === 'sensoryDomains') {
      return (
        <div className="space-y-8 w-full max-w-2xl mx-auto">
          {SENSORY_DOMAINS.map((domain) => {
            const rawValue = project.sensoryDomains[domain.code] ?? 0;
            const closest = getClosestLevel(rawValue);
            const meta = SENSORY_METADATA[domain.code];
            return (
              <div key={domain.code} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${meta.color} bg-opacity-10 text-white shadow-sm`}>
                    {meta.icon}
                  </div>
                  <div>
                    <div className="text-base font-semibold tracking-tight">{domain.label}</div>
                    <p className="text-xs text-muted-foreground">{domain.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {INTENSITY_LEVELS.map((level) => {
                    const isSelected = closest.value === level.value;
                    const baseClass = 'flex-1 py-2.5 px-3 text-sm rounded-xl transition-all duration-300 flex items-center justify-center';
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
                      intensityStyle = 'bg-secondary/40 text-muted-foreground/50';
                    }

                    return (
                      <div key={level.value} className={`${baseClass} ${intensityStyle}`}>
                        {level.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Step 8: Presence Types
    if (step.sectionId === 'presence') {
      return (
        <div className="space-y-8 w-full max-w-2xl mx-auto">
          {PRESENCE_TYPES.map((presence) => {
            const rawValue = project.presenceTypes[presence.code] ?? 0;
            const closest = getClosestLevel(rawValue);
            const meta = PRESENCE_METADATA[presence.code];
            return (
              <div key={presence.code} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${meta.color} bg-opacity-10 text-white shadow-sm`}>
                    {meta.icon}
                  </div>
                  <div>
                    <div className="text-base font-semibold tracking-tight">{presence.label}</div>
                    <p className="text-xs text-muted-foreground">{presence.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {INTENSITY_LEVELS.map((level) => {
                    const isSelected = closest.value === level.value;
                    const baseClass = 'flex-1 py-2.5 px-3 text-sm rounded-xl transition-all duration-300 flex items-center justify-center';
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
                      intensityStyle = 'bg-secondary/40 text-muted-foreground/50';
                    }

                    return (
                      <div key={level.value} className={`${baseClass} ${intensityStyle}`}>
                        {level.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Step 9: State Mapping
    if (step.sectionId === 'stateMapping') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-5xl mx-auto">
          {STATE_QUADRANTS.map((quadrant) => (
            <ReadOnlyField
              key={quadrant.code}
              label={quadrant.label}
              description={quadrant.description}
              value={project.stateMapping[quadrant.code]}
            />
          ))}
        </div>
      );
    }

    // Step 10: Trait Mapping
    if (step.sectionId === 'traitMapping') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-5xl mx-auto">
          {TRAIT_QUADRANTS.map((quadrant) => (
            <ReadOnlyField
              key={quadrant.code}
              label={quadrant.label}
              description={quadrant.description}
              value={project.traitMapping[quadrant.code]}
            />
          ))}
        </div>
      );
    }

    return null;
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
        {/* Back button */}
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary/80 backdrop-blur-sm border border-white/5 text-sm text-muted-foreground hover:text-foreground transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden 2xl:inline">Back</span>
        </button>

        {/* Progress bar with phase dots and labels */}
        <div className="relative flex items-center gap-3 h-[500px]">
          {/* Phase labels (horizontal text) - LEFT SIDE — hidden below 2xl */}
          <div className="relative h-full w-24 hidden 2xl:block">
            {WIZARD_PHASES.map((phase) => {
              const phaseStartStep = phase.steps[0];
              const totalSteps = WIZARD_STEPS.length;
              const position = (phaseStartStep / totalSteps) * 100;
              const isCurrentPhase = phase.steps.includes(currentStep);
              const isReached = progress >= position;

              return (
                <div
                  key={phase.name}
                  className="absolute right-0 -translate-y-1/2"
                  style={{ top: `${position}%` }}
                >
                  <span
                    className={cn(
                      'text-xs font-medium uppercase tracking-wider whitespace-nowrap transition-all duration-300',
                      isCurrentPhase
                        ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 font-bold'
                        : isReached
                          ? 'text-indigo-300'
                          : 'text-muted-foreground/60',
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
            {WIZARD_PHASES.map((phase) => {
              const phaseStartStep = phase.steps[0];
              const totalSteps = WIZARD_STEPS.length;
              const position = (phaseStartStep / totalSteps) * 100;
              const isCurrentPhase = phase.steps.includes(currentStep);
              const isReached = progress >= position;

              return (
                <div
                  key={phase.name}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ top: `${position}%` }}
                >
                  <div
                    className={cn(
                      'w-3 h-3 rounded-full border-2 transition-all duration-300',
                      isCurrentPhase
                        ? 'bg-gradient-to-br from-indigo-400 to-purple-500 border-white shadow-lg shadow-purple-500/50 scale-125'
                        : isReached
                          ? 'bg-indigo-500 border-indigo-300'
                          : 'bg-secondary border-border',
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex gap-[10px] max-w-4xl w-full px-16 2xl:px-4 relative z-10">
        {/* Center Column - Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="w-full">
            {/* Current step indicator */}
            <div className="mb-6 flex items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {getCurrentPhase()}
              </span>
              <span className="text-muted-foreground">&#8226;</span>
              <span className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {WIZARD_STEPS.length}
              </span>
            </div>

            {/* Step Navigation - Horizontal scroll with hidden scrollbar */}
            <div
              ref={stepNavRef}
              className="w-full mb-8 overflow-x-auto scrollbar-hide"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div className="flex gap-2 pb-2 min-w-max">
                {WIZARD_STEPS.map((step, index) => (
                  <button
                    key={step.id}
                    ref={(el) => {
                      stepButtonRefs.current[index] = el;
                    }}
                    onClick={() => setCurrentStep(index)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                      index === currentStep
                        ? 'bg-gradient-to-r from-indigo-700 to-purple-600 text-white glow-purple'
                        : index < currentStep
                          ? 'bg-indigo-900/30 text-indigo-300 border border-purple-500/20'
                          : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {stepIcons[step.title] || <Sparkles className="w-4 h-4" />}
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
                    <CardTitle className="text-xl">{currentStepData.title}</CardTitle>
                    <CardDescription>{currentStepData.question}</CardDescription>
                  </div>
                </div>
                {/* Step Intent */}
                {currentStepData.intent && (
                  <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-sm text-muted-foreground italic">
                      <span className="text-primary font-medium">Intent:</span>{' '}
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
        <div className="fixed right-4 lg:right-[calc(50%-28rem)] 2xl:right-[230px] top-1/2 -translate-y-1/2 z-20 w-16 flex flex-col items-center">
          <div className="flex flex-col gap-4 items-center">
            {/* Previous Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className={cn(
                  'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300',
                  'border backdrop-blur-sm',
                  currentStep === 0
                    ? 'opacity-30 cursor-not-allowed bg-secondary/30 border-border/50'
                    : 'bg-secondary/50 hover:bg-gradient-to-br hover:from-indigo-600/30 hover:to-purple-600/30 border-border/50 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/20 cursor-pointer hover:scale-105 active:scale-95',
                )}
              >
                <ChevronLeft
                  className={cn(
                    'w-6 h-6 transition-colors',
                    currentStep === 0 ? 'text-muted-foreground/50' : 'text-foreground',
                  )}
                />
              </button>
              <span
                className={cn(
                  'text-[10px] text-center transition-colors uppercase tracking-wider',
                  currentStep === 0 ? 'text-muted-foreground/50' : 'text-muted-foreground',
                )}
              >
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

            {/* Next Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleNext}
                disabled={currentStep === WIZARD_STEPS.length - 1}
                className={cn(
                  'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300',
                  'border backdrop-blur-sm',
                  currentStep === WIZARD_STEPS.length - 1
                    ? 'opacity-30 cursor-not-allowed bg-secondary/30 border-border/50'
                    : cn(
                        'border-purple-500/50 cursor-pointer',
                        'bg-gradient-to-br from-indigo-600 to-purple-600',
                        'hover:from-indigo-500 hover:to-purple-500',
                        'hover:shadow-lg hover:shadow-purple-500/40',
                        'hover:scale-105 active:scale-95',
                      ),
                )}
              >
                <ChevronRight
                  className={cn(
                    'w-6 h-6',
                    currentStep === WIZARD_STEPS.length - 1
                      ? 'text-muted-foreground/50'
                      : 'text-white',
                  )}
                />
              </button>
              <span
                className={cn(
                  'text-[10px] text-center uppercase tracking-wider',
                  currentStep === WIZARD_STEPS.length - 1
                    ? 'text-muted-foreground/50'
                    : 'text-muted-foreground',
                )}
              >
                Next
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
