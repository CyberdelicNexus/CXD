"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCXDStore } from "@/store/cxd-store";
import {
  WIZARD_STEPS,
  REALITY_PLANES,
  SENSORY_DOMAINS,
  PRESENCE_TYPES,
  STATE_QUADRANTS,
  TRAIT_QUADRANTS,
} from "@/types/cxd-schema";
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
import { Slider } from "@/components/ui/slider";
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
  Radio,
  Brain,
  Heart,
  Target,
  Lightbulb,
  Users,
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
    updateRealityPlane,
    updateSensoryDomain,
    updatePresenceType,
    updateStateMapping,
    updateTraitMapping,
  } = useCXDStore();

  const project = getCurrentProject();
  const [currentStep, setCurrentStep] = useState(
    project?.currentWizardStep || 0,
  );
  const stepNavRef = useRef<HTMLDivElement>(null);
  const stepButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

  const currentStepData = WIZARD_STEPS[currentStep];
  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setWizardStep(nextStep);
    } else {
      completeWizard();
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
        <div className="grid grid-cols-2 gap-4 !container">
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

    // Reality Planes step (sliders)
    if (step.sectionId === "realityPlanes") {
      return (
        <div className="space-y-6 w-full">
          {REALITY_PLANES.map((plane) => (
            <div key={plane.code} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">{plane.label}</Label>
                  <p className="text-xs text-muted-foreground">
                    {plane.description}
                  </p>
                </div>
                <span className="text-sm font-mono text-primary">
                  {project.realityPlanes[plane.code]}%
                </span>
              </div>
              <Slider
                value={[project.realityPlanes[plane.code]]}
                onValueChange={([value]) =>
                  updateRealityPlane(plane.code, value)
                }
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground italic">
            Note: These values are descriptive, not prescriptive. There is no
            requirement for them to sum to 100%.
          </p>
        </div>
      );
    }

    // Sensory Domains step
    if (step.sectionId === "sensoryDomains") {
      return (
        <div className="space-y-6 w-full">
          {SENSORY_DOMAINS.map((domain) => (
            <div key={domain.code} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">{domain.label}</Label>
                  <p className="text-xs text-muted-foreground">
                    {domain.description}
                  </p>
                </div>
                <span className="text-sm font-mono text-primary">
                  {project.sensoryDomains[domain.code]}%
                </span>
              </div>
              <Slider
                value={[project.sensoryDomains[domain.code]]}
                onValueChange={([value]) =>
                  updateSensoryDomain(domain.code, value)
                }
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          ))}
        </div>
      );
    }

    // Presence Types step
    if (step.sectionId === "presence") {
      return (
        <div className="space-y-6 w-full">
          {PRESENCE_TYPES.map((presence) => (
            <div key={presence.code} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">
                    {presence.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {presence.description}
                  </p>
                </div>
                <span className="text-sm font-mono text-primary">
                  {project.presenceTypes[presence.code]}%
                </span>
              </div>
              <Slider
                value={[project.presenceTypes[presence.code]]}
                onValueChange={([value]) =>
                  updatePresenceType(presence.code, value)
                }
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          ))}
        </div>
      );
    }

    // State Mapping step
    if (step.sectionId === "stateMapping") {
      return (
        <div className="grid grid-cols-2 gap-4 w-full">
          {STATE_QUADRANTS.map((quadrant) => (
            <div key={quadrant.code} className="space-y-2">
              <Label className="text-sm font-medium">{quadrant.label}</Label>
              <p className="text-xs text-muted-foreground">
                {quadrant.description}
              </p>
              <Textarea
                placeholder={`Describe ${quadrant.label.toLowerCase()} states...`}
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
      return (
        <div className="grid grid-cols-2 gap-4 h-fit w-full">
          {TRAIT_QUADRANTS.map((quadrant) => (
            <div key={quadrant.code} className="space-y-2">
              <Label className="text-sm font-medium">{quadrant.label}</Label>
              <p className="text-xs text-muted-foreground">
                {quadrant.description}
              </p>
              <Textarea
                placeholder={`Describe ${quadrant.label.toLowerCase()} traits...`}
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
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Progress Header with Phase indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {getCurrentPhase()}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {WIZARD_STEPS.length}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />

          {/* Phase Progress Indicators */}
          <div className="flex gap-1 mt-3">
            {WIZARD_PHASES.map((phase, idx) => {
              const isCurrentPhase = phase.steps.includes(currentStep);
              const isCompletedPhase = phase.steps.every(
                (s) => s < currentStep,
              );
              return (
                <div key={phase.name} className="flex-1 flex flex-col gap-1">
                  <div
                    className={`h-1 rounded-full transition-all ${
                      isCurrentPhase
                        ? "bg-primary glow-teal"
                        : isCompletedPhase
                          ? "bg-primary/60"
                          : "bg-secondary"
                    }`}
                  />
                  <span
                    className={`text-[10px] text-center ${
                      isCurrentPhase
                        ? "text-primary font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {phase.name}
                  </span>
                </div>
              );
            })}
          </div>
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
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                  index === currentStep
                    ? "bg-primary text-primary-foreground glow-teal"
                    : index < currentStep
                      ? "bg-primary/20 text-primary"
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
        <Card className="gradient-border bg-card/50 backdrop-blur h-fit">
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
            <div className="pr-4 pb-4 flex h-full w-full items-center justify-center flex-col mx-[0px] overflow-y-visible">
              {renderStepContent()}
            </div>
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-muted-foreground"
          >
            Skip for now
          </Button>

          <Button onClick={handleNext} className="glow-teal">
            {currentStep === WIZARD_STEPS.length - 1 ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Complete & View Canvas
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
