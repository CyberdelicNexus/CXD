"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CXDProject } from "@/types/cxd-schema";
import { RealityPlanesEditor } from "@/components/cxd/reality-planes-editor";
import { useCXDStore } from "@/store/cxd-store";
import { useCollaborationContext } from "@/contexts/collaboration-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, extractCenterColor, hexToRgba } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Target,
  Sparkles,
  Users,
  Globe,
  Layers,
  Eye,
  Radio,
  Brain,
  Heart,
  X,
  Check,
  Loader2,
  Ear,
  Wind,
  Apple,
  Fingerprint,
  PersonStanding,
  Zap,
} from "lucide-react";

// Section type definition
export type InspectorSectionId =
  | "intentionCore"
  | "desiredChange"
  | "humanContext"
  | "contextAndMeaning"
  | "realityPlanes"
  | "sensoryDomains"
  | "presenceTypes"
  | "stateMapping"
  | "traitMapping";

interface InspectorSection {
  id: InspectorSectionId;
  label: string;
  icon: React.ReactNode;
}

export const INSPECTOR_SECTIONS: InspectorSection[] = [
  {
    id: "intentionCore",
    label: "Intention Core",
    icon: <Target className="w-5 h-5" />,
  },
  {
    id: "desiredChange",
    label: "Desired Change",
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    id: "humanContext",
    label: "Human Context",
    icon: <Users className="w-5 h-5" />,
  },
  {
    id: "contextAndMeaning",
    label: "Meaning Architecture",
    icon: <Globe className="w-5 h-5" />,
  },
  {
    id: "realityPlanes",
    label: "Reality Planes",
    icon: <Layers className="w-5 h-5" />,
  },
  {
    id: "sensoryDomains",
    label: "Sensory Domains",
    icon: <Eye className="w-5 h-5" />,
  },
  {
    id: "presenceTypes",
    label: "Presence Types",
    icon: <Radio className="w-5 h-5" />,
  },
  {
    id: "stateMapping",
    label: "State Mapping",
    icon: <Brain className="w-5 h-5" />,
  },
  {
    id: "traitMapping",
    label: "Trait Mapping",
    icon: <Heart className="w-5 h-5" />,
  },
];

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

const REALITY_PLANE_LABELS: Record<string, string> = {
  PR: "Physical Reality",
  AR: "Augmented Reality",
  VR: "Virtual Reality",
  MR: "Mixed Reality",
  GR: "Group Reality",
  BR: "Brain Reality",
  CR: "Consensus Reality",
};

const SENSORY_DOMAIN_LABELS: Record<string, string> = {
  visual: "Visual",
  auditory: "Auditory",
  olfactory: "Olfactory",
  gustatory: "Gustatory",
  haptic: "Haptic",
};

const PRESENCE_TYPE_LABELS: Record<string, string> = {
  mental: "Mental",
  emotional: "Emotional",
  social: "Social",
  embodied: "Embodied",
  environmental: "Environmental",
  active: "Active",
};

const STATE_QUADRANT_LABELS: Record<string, string> = {
  cognitive: "Cognitive",
  emotional: "Emotional",
  somatic: "Somatic",
  relational: "Relational",
};

const TRAIT_QUADRANT_LABELS: Record<string, string> = {
  cognitive: "Cognitive",
  emotional: "Emotional",
  somatic: "Somatic",
  relational: "Relational",
};

// Constants for layout
const PANEL_WIDTH = 480;
const RAIL_WIDTH = 64;
const GUTTER = 12;

// Icon Rail Component
interface ExperienceInspectorRailProps {
  activeSection: InspectorSectionId | null;
  onSectionClick: (sectionId: InspectorSectionId) => void;
  isPanelOpen: boolean;
  onStartDrag?: (
    sectionId: InspectorSectionId,
    clientX: number,
    clientY: number,
  ) => void;
}

export function ExperienceInspectorRail({
  activeSection,
  onSectionClick,
  isPanelOpen,
  onStartDrag,
}: ExperienceInspectorRailProps) {
  const [dragState, setDragState] = useState<{
    sectionId: InspectorSectionId | null;
    startX: number;
    startY: number;
  }>({ sectionId: null, startX: 0, startY: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, sectionId: InspectorSectionId) => {
      setDragState({
        sectionId,
        startX: e.clientX,
        startY: e.clientY,
      });
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragState.sectionId) {
        const deltaX = Math.abs(e.clientX - dragState.startX);
        const deltaY = Math.abs(e.clientY - dragState.startY);

        // If moved more than 5px, start drag
        if (deltaX > 5 || deltaY > 5) {
          if (onStartDrag) {
            onStartDrag(dragState.sectionId, e.clientX, e.clientY);
          }
          setDragState({ sectionId: null, startX: 0, startY: 0 });
        }
      }
    },
    [dragState, onStartDrag],
  );

  const handleMouseUp = useCallback(
    (sectionId: InspectorSectionId) => {
      // If mouse up without significant movement, treat as click
      if (dragState.sectionId === sectionId) {
        onSectionClick(sectionId);
      }
      setDragState({ sectionId: null, startX: 0, startY: 0 });
    },
    [dragState, onSectionClick],
  );

  return (
    <div
      className="fixed top-1/2 -translate-y-1/2 z-30 flex flex-col gap-y-6 transition-transform duration-300 ease-out"
      style={{
        right: "0px",
        width: `${RAIL_WIDTH}px`,
        transform: `translateY(-50%) translateX(${isPanelOpen ? -(PANEL_WIDTH + GUTTER) : 0}px)`,
      }}
      onMouseMove={handleMouseMove}
      onWheel={(e) => e.stopPropagation()}
      data-prevent-canvas-wheel="true"
      data-tour-id="canvas-experience-sidebar"
    >
      <div className="flex flex-col gap-1.5 px-3 gap-y-[26px] h-fit">
        {INSPECTOR_SECTIONS.map((section) => (
          <Button
            key={section.id}
            variant={activeSection === section.id ? "default" : "ghost"}
            size="icon"
            className={`
              w-10 h-10 rounded-lg transition-all duration-200 cursor-grab active:cursor-grabbing
              ${activeSection === section.id
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110"
                : "bg-card/90 backdrop-blur-sm border border-border/50 hover:bg-primary/20 hover:scale-105 hover:shadow-md hover:shadow-primary/20"
              }
            `}
            onMouseDown={(e) => handleMouseDown(e, section.id)}
            onMouseUp={() => handleMouseUp(section.id)}
            title={`${section.label} (drag to canvas)`}
          >
            {section.icon}
          </Button>
        ))}
      </div>
    </div>
  );
}

// Inspector Panel Component
interface ExperienceInspectorPanelProps {
  project: CXDProject;
  activeSection: InspectorSectionId;
  onClose: () => void;
  isOpen: boolean;
  className?: string;
}

export function ExperienceInspectorPanel({
  project,
  activeSection,
  onClose,
  isOpen,
}: ExperienceInspectorPanelProps) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [contentKey, setContentKey] = useState(activeSection);
  const [isContentFading, setIsContentFading] = useState(false);

  // Handle content transitions when section changes
  useEffect(() => {
    if (activeSection !== contentKey && isOpen) {
      setIsContentFading(true);
      const timeout = setTimeout(() => {
        setContentKey(activeSection);
        setIsContentFading(false);
      }, 150);
      return () => clearTimeout(timeout);
    } else if (isOpen) {
      setContentKey(activeSection);
    }
  }, [activeSection, contentKey, isOpen]);

  // Get all update functions from store
  const {
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
    updateContextWorld,
    updateContextStory,
    updateContextMagic,
    updateRealityPlane,
    updateStateMapping,
    updateTraitMapping,
  } = useCXDStore();

  // Get collaboration sync functions for fields that need real-time sync
  const {
    syncSensoryDomain,
    syncPresenceType,
    syncStateMapping,
    syncTraitMapping,
    syncIntentionCore,
    syncDesiredChange,
    syncHumanContext,
    syncContextMeaning,
  } = useCollaborationContext();

  // Handle keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Debounced save status
  const triggerSave = useCallback(() => {
    setSaveStatus("saving");
    const timeout = setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  // Get section info
  const sectionInfo = INSPECTOR_SECTIONS.find((s) => s.id === activeSection);

  // Dynamic background based on canvas background
  const canvasBackground = project?.canvasBackground || 'radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)';
  const centerColor = extractCenterColor(canvasBackground);
  const panelBgColor = hexToRgba(centerColor, 0.8);

  // Render section content
  const renderSectionContent = () => {
    switch (activeSection) {
      case "intentionCore":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projectName" className="text-sm font-medium">
                Project Name
              </Label>
              <Input
                id="projectName"
                placeholder="Enter project name..."
                value={project.intentionCore?.projectName || ""}
                onChange={(e) => {
                  updateIntentionProjectName(e.target.value);
                  triggerSave();
                }}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mainConcept" className="text-sm font-medium">
                Main Concept
              </Label>
              <Textarea
                id="mainConcept"
                placeholder="What is the central idea or concept?"
                value={project.intentionCore?.mainConcept || ""}
                onChange={(e) => {
                  updateIntentionMainConcept(e.target.value);
                  triggerSave();
                }}
                className="bg-secondary/50 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coreMessage" className="text-sm font-medium">
                Core Message
              </Label>
              <Textarea
                id="coreMessage"
                placeholder="What is the key message participants should take away?"
                value={project.intentionCore?.coreMessage || ""}
                onChange={(e) => {
                  updateIntentionCoreMessage(e.target.value);
                  triggerSave();
                }}
                className="bg-secondary/50 min-h-[80px]"
              />
            </div>
          </div>
        );

      case "desiredChange":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="insights" className="text-sm font-medium">
                Insights
              </Label>
              <Textarea
                id="insights"
                placeholder="What insights should participants gain?"
                value={project.desiredChange?.insights || ""}
                onChange={(e) => {
                  updateDesiredInsights(e.target.value);
                  triggerSave();
                }}
                className="bg-secondary/50 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feelings" className="text-sm font-medium">
                Feelings
              </Label>
              <Textarea
                id="feelings"
                placeholder="What feelings should the experience evoke?"
                value={project.desiredChange?.feelings || ""}
                onChange={(e) => {
                  updateDesiredFeelings(e.target.value);
                  triggerSave();
                }}
                className="bg-secondary/50 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="states" className="text-sm font-medium">
                States
              </Label>
              <Textarea
                id="states"
                placeholder="What states should participants enter?"
                value={project.desiredChange?.states || ""}
                onChange={(e) => {
                  updateDesiredStates(e.target.value);
                  triggerSave();
                }}
                className="bg-secondary/50 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="knowledge" className="text-sm font-medium">
                Knowledge
              </Label>
              <Textarea
                id="knowledge"
                placeholder="What knowledge should participants acquire?"
                value={project.desiredChange?.knowledge || ""}
                onChange={(e) => {
                  updateDesiredKnowledge(e.target.value);
                  triggerSave();
                }}
                className="bg-secondary/50 min-h-[80px]"
              />
            </div>
          </div>
        );

      case "humanContext":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="audienceNeeds" className="text-sm font-medium">
                Audience Needs
              </Label>
              <Textarea
                id="audienceNeeds"
                placeholder="What does your audience need?"
                value={project.humanContext?.audienceNeeds || ""}
                onChange={(e) => {
                  updateHumanAudienceNeeds(e.target.value);
                  triggerSave();
                }}
                className="bg-secondary/50 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audienceDesires" className="text-sm font-medium">
                Audience Desires
              </Label>
              <Textarea
                id="audienceDesires"
                placeholder="What does your audience desire?"
                value={project.humanContext?.audienceDesires || ""}
                onChange={(e) => {
                  updateHumanAudienceDesires(e.target.value);
                  triggerSave();
                }}
                className="bg-secondary/50 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userRole" className="text-sm font-medium">
                User Role
              </Label>
              <Textarea
                id="userRole"
                placeholder="What role does the user play in this experience?"
                value={project.humanContext?.userRole || ""}
                onChange={(e) => {
                  updateHumanUserRole(e.target.value);
                  triggerSave();
                }}
                className="bg-secondary/50 min-h-[80px]"
              />
            </div>
          </div>
        );

      case "contextAndMeaning":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="world" className="text-sm font-medium">
                World
              </Label>
              <Textarea
                id="world"
                placeholder="Describe the world of this experience..."
                value={project.contextAndMeaning?.world || ""}
                onChange={(e) => {
                  updateContextWorld(e.target.value);
                  triggerSave();
                }}
                className="bg-secondary/50 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="story" className="text-sm font-medium">
                Story
              </Label>
              <Textarea
                id="story"
                placeholder="What is the narrative arc?"
                value={project.contextAndMeaning?.story || ""}
                onChange={(e) => {
                  updateContextStory(e.target.value);
                  triggerSave();
                }}
                className="bg-secondary/50 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="magic" className="text-sm font-medium">
                Magic
              </Label>
              <Textarea
                id="magic"
                placeholder="What is the 'magic' mechanism?"
                value={project.contextAndMeaning?.magic || ""}
                onChange={(e) => {
                  updateContextMagic(e.target.value);
                  triggerSave();
                }}
                className="bg-secondary/50 min-h-[80px]"
              />
            </div>
          </div>
        );

      case "realityPlanes":
        return (
          <div className="space-y-4 w-full overflow-auto">
            <RealityPlanesEditor className="w-full" compact />
          </div>
        );

      case "sensoryDomains": {
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
          <div className="space-y-4 pb-32">
            {Object.entries(SENSORY_DOMAIN_LABELS).map(([code, label]) => {
              const currentValue = getClosestLevel(
                project.sensoryDomains?.[code as keyof typeof project.sensoryDomains] || 0
              );
              const meta = SENSORY_METADATA[code];
              return (
                <div key={code} className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${meta.color} bg-opacity-10 text-white shadow-inner`}>
                      {React.cloneElement(meta.icon as React.ReactElement, { className: "w-5 h-5" })}
                    </div>
                    <div className="flex flex-col">
                      <Label className="text-sm font-bold tracking-tight">{label}</Label>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-60">Sensory Modality</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 p-1 bg-black/20 rounded-lg">
                    {intensityLevels.map((level) => {
                      const isSelected = currentValue === level.value;
                      const isPrimary = level.label === "Primary" && isSelected;

                      return (
                        <button
                          key={level.value}
                          onClick={() => {
                            syncSensoryDomain(code as any, level.value);
                            triggerSave();
                          }}
                          className={cn(
                            "flex-1 py-2 px-1 text-[10px] uppercase tracking-wider font-bold rounded-md transition-all duration-300",
                            isSelected
                              ? `bg-gradient-to-br ${meta.color} text-white shadow-md`
                              : "bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
                            isPrimary && "scale-105 shadow-[0_0_15px_rgba(var(--primary),0.3)]",
                            !isSelected && "opacity-40"
                          )}
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

      case "presenceTypes": {
        const presenceLevels = [
          { value: 0, label: "None" },
          { value: 25, label: "Minimal" },
          { value: 50, label: "Moderate" },
          { value: 75, label: "Significant" },
          { value: 100, label: "Primary" },
        ];
        const getClosestPresenceLevel = (value: number) => {
          return presenceLevels.reduce((prev, curr) =>
            Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
          ).value;
        };
        return (
          <div className="space-y-4 pb-32">
            {Object.entries(PRESENCE_TYPE_LABELS).map(([code, label]) => {
              const currentValue = getClosestPresenceLevel(
                project.presenceTypes?.[code as keyof typeof project.presenceTypes] || 0
              );
              const meta = PRESENCE_METADATA[code];
              return (
                <div key={code} className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${meta.color} bg-opacity-10 text-white shadow-inner`}>
                      {React.cloneElement(meta.icon as React.ReactElement, { className: "w-5 h-5" })}
                    </div>
                    <div className="flex flex-col">
                      <Label className="text-sm font-bold tracking-tight">{label}</Label>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-60">Presence Type</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 p-1 bg-black/20 rounded-lg">
                    {presenceLevels.map((level) => {
                      const isSelected = currentValue === level.value;
                      const isPrimary = level.label === "Primary" && isSelected;

                      return (
                        <button
                          key={level.value}
                          onClick={() => {
                            syncPresenceType(code as any, level.value);
                            triggerSave();
                          }}
                          className={cn(
                            "flex-1 py-2 px-1 text-[10px] uppercase tracking-wider font-bold rounded-md transition-all duration-300",
                            isSelected
                              ? `bg-gradient-to-br ${meta.color} text-white shadow-md`
                              : "bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
                            isPrimary && "scale-105 shadow-[0_0_15px_rgba(var(--primary),0.3)]",
                            !isSelected && "opacity-40"
                          )}
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

      case "stateMapping":
        return (
          <div className="space-y-4">
            {Object.entries(STATE_QUADRANT_LABELS).map(([code, label]) => (
              <div key={code} className="space-y-2">
                <Label
                  htmlFor={`state-${code}`}
                  className="text-sm font-medium"
                >
                  {label}
                </Label>
                <Textarea
                  id={`state-${code}`}
                  placeholder={`Describe the ${label.toLowerCase()} state...`}
                  value={
                    project.stateMapping?.[
                    code as keyof typeof project.stateMapping
                    ] || ""
                  }
                  onChange={(e) => {
                    updateStateMapping(code as any, e.target.value);
                    triggerSave();
                  }}
                  className="bg-secondary/50 min-h-[60px]"
                />
              </div>
            ))}
          </div>
        );

      case "traitMapping":
        return (
          <div className="space-y-4">
            {Object.entries(TRAIT_QUADRANT_LABELS).map(([code, label]) => (
              <div key={code} className="space-y-2">
                <Label
                  htmlFor={`trait-${code}`}
                  className="text-sm font-medium"
                >
                  {label}
                </Label>
                <Textarea
                  id={`trait-${code}`}
                  placeholder={`Describe the ${label.toLowerCase()} trait...`}
                  value={
                    project.traitMapping?.[
                    code as keyof typeof project.traitMapping
                    ] || ""
                  }
                  onChange={(e) => {
                    updateTraitMapping(code as any, e.target.value);
                    triggerSave();
                  }}
                  className="bg-secondary/50 min-h-[60px]"
                />
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="fixed top-16 bottom-0 z-20 flex flex-col backdrop-blur-xl border-l border-border shadow-2xl shadow-black/20 transition-transform duration-300 ease-out"
      style={{
        right: "0px",
        width: `${PANEL_WIDTH}px`,
        maxWidth: "40vw",
        transform: `translateX(${isOpen ? "0%" : "100%"})`,
        backgroundColor: panelBgColor,
      }}
      onWheel={(e) => e.stopPropagation()}
      data-prevent-canvas-wheel="true"
    >
      {/* Vertical divider/glow when panel is open */}
      {isOpen && <></>}
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-primary">{sectionInfo?.icon}</span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {sectionInfo?.label}
            </h2>
            <div className="flex items-center gap-1.5">
              {saveStatus === "saving" && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Saving...
                  </span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <Check className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-500">Saved</span>
                </>
              )}
              {saveStatus === "idle" && (
                <span className="text-xs text-muted-foreground">
                  Auto-save enabled
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          title="Close Panel (Esc)"
          className="hover:bg-destructive/20"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      {/* Scrollable Content with fade transition */}
      <ScrollArea className="flex-1">
        <div
          className={`p-4 transition-opacity duration-150 ${isContentFading ? "opacity-0" : "opacity-100"}`}
        >
          {renderSectionContent()}
        </div>
      </ScrollArea>
    </div>
  );
}

// Combined Inspector Component
interface ExperienceInspectorProps {
  project: CXDProject;
  onPanelOpenChange?: (isOpen: boolean) => void;
  onStartDrag?: (
    sectionId: InspectorSectionId,
    clientX: number,
    clientY: number,
  ) => void;
  onOpenSection?: (sectionId: InspectorSectionId) => void;
  className?: string;
}

export function ExperienceInspector({
  project,
  onPanelOpenChange,
  onStartDrag,
  onOpenSection,
}: ExperienceInspectorProps) {
  const [activeSection, setActiveSection] = useState<InspectorSectionId | null>(
    null,
  );

  const isPanelOpen = activeSection !== null;

  // Allow programmatic opening from outside (e.g., double-clicking experience block)
  useEffect(() => {
    if (onOpenSection) {
      // This effect is just for type checking - actual logic is in handleSectionClick
    }
  }, [onOpenSection]);

  const handleSectionClick = (sectionId: InspectorSectionId) => {
    if (activeSection === sectionId) {
      // Clicking the same icon closes the panel
      setActiveSection(null);
      onPanelOpenChange?.(false);
    } else {
      // Clicking a different icon keeps panel open and swaps content
      setActiveSection(sectionId);
      if (!isPanelOpen) {
        onPanelOpenChange?.(true);
      }
    }
  };

  // Expose a way to programmatically open a section
  const handleOpenSection = useCallback(
    (sectionId: InspectorSectionId) => {
      setActiveSection(sectionId);
      onPanelOpenChange?.(true);
    },
    [onPanelOpenChange],
  );

  // Call onOpenSection when provided (for external control)
  useEffect(() => {
    if (onOpenSection) {
      // Wrap in a ref so parent can call it
      (window as any).__openExperienceSection = handleOpenSection;
    }
    return () => {
      delete (window as any).__openExperienceSection;
    };
  }, [handleOpenSection, onOpenSection]);

  const handleClose = () => {
    setActiveSection(null);
    onPanelOpenChange?.(false);
  };

  return (
    <>
      {/* Icon Rail - always visible, animates left when panel opens */}
      <ExperienceInspectorRail
        activeSection={activeSection}
        onSectionClick={handleSectionClick}
        isPanelOpen={isPanelOpen}
        onStartDrag={onStartDrag}
      />
      {/* Inspector Panel - always mounted but translated off-screen when closed */}
      {activeSection && (
        <ExperienceInspectorPanel
          project={project}
          activeSection={activeSection}
          onClose={handleClose}
          isOpen={isPanelOpen}
        />
      )}
    </>
  );
}
