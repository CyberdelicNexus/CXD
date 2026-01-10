"use client";

import React, { useState } from "react";
import { CXDProject } from "@/types/cxd-schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
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
  ChevronDown,
  ChevronRight,
  Maximize2,
  X,
} from "lucide-react";

interface CXDReferencePanelProps {
  project: CXDProject;
  onSectionClick?: (sectionId: string) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

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
  physical: "Physical",
  social: "Social",
};

const TRAIT_QUADRANT_LABELS: Record<string, string> = {
  beliefs: "Beliefs",
  behaviors: "Behaviors",
  capabilities: "Capabilities",
  identity: "Identity",
};

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  onExpand?: () => void;
}

function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
  onExpand,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 p-3 hover:bg-secondary/30 transition-colors text-left"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-primary">{icon}</span>
        <span className="text-sm font-medium flex-1">{title}</span>
        {onExpand && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
          >
            <Maximize2 className="w-3 h-3" />
          </Button>
        )}
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function SliderDisplay({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-muted-foreground w-24 truncate">{label}</span>
      <div className="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${value}%`,
            background: color || "hsl(var(--primary))",
          }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">
        {value}%
      </span>
    </div>
  );
}

function TextDisplay({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="py-1">
      <span className="text-xs text-muted-foreground block mb-0.5">{label}</span>
      <p className="text-sm text-foreground/90 leading-relaxed">{value}</p>
    </div>
  );
}

export function CXDReferencePanel({
  project,
  onSectionClick,
  onCollapsedChange,
}: CXDReferencePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapsedChange?.(collapsed);
  };

  if (isCollapsed) {
    return (
      <div className="fixed right-0 top-16 bottom-0 w-12 bg-card/80 backdrop-blur-xl border-l border-border z-20 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleCollapse(false)}
          className="mb-4"
          title="Expand Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Separator className="w-8 mb-4" />
        <div className="flex flex-col gap-3 items-center">
          <Target className="w-4 h-4 text-primary/60" />
          <Sparkles className="w-4 h-4 text-primary/60" />
          <Users className="w-4 h-4 text-primary/60" />
          <Globe className="w-4 h-4 text-primary/60" />
          <Layers className="w-4 h-4 text-primary/60" />
          <Eye className="w-4 h-4 text-primary/60" />
          <Radio className="w-4 h-4 text-primary/60" />
          <Brain className="w-4 h-4 text-primary/60" />
          <Heart className="w-4 h-4 text-primary/60" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-16 bottom-0 w-[380px] bg-card/80 backdrop-blur-xl border-l border-border z-20 flex flex-col">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Experience Reference
          </h2>
          <p className="text-xs text-muted-foreground">CXD Structure Summary</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleCollapse(true)}
          title="Collapse Panel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* Intention Core */}
          <CollapsibleSection
            title="Intention Core"
            icon={<Target className="w-4 h-4" />}
            defaultOpen={true}
            onExpand={() => onSectionClick?.("intentionCore")}
          >
            <div className="space-y-2">
              <TextDisplay
                label="Project Name"
                value={project.intentionCore?.projectName}
              />
              <TextDisplay
                label="Main Concept"
                value={project.intentionCore?.mainConcept}
              />
              <TextDisplay
                label="Core Message"
                value={project.intentionCore?.coreMessage}
              />
            </div>
          </CollapsibleSection>

          {/* Desired Change */}
          <CollapsibleSection
            title="Desired Change"
            icon={<Sparkles className="w-4 h-4" />}
            defaultOpen={false}
            onExpand={() => onSectionClick?.("desiredChange")}
          >
            <div className="space-y-2">
              <TextDisplay
                label="Insights"
                value={project.desiredChange?.insights}
              />
              <TextDisplay
                label="Feelings"
                value={project.desiredChange?.feelings}
              />
              <TextDisplay label="States" value={project.desiredChange?.states} />
              <TextDisplay
                label="Knowledge"
                value={project.desiredChange?.knowledge}
              />
            </div>
          </CollapsibleSection>

          {/* Human Context */}
          <CollapsibleSection
            title="Human Context"
            icon={<Users className="w-4 h-4" />}
            defaultOpen={false}
            onExpand={() => onSectionClick?.("humanContext")}
          >
            <div className="space-y-2">
              <TextDisplay
                label="Audience Needs"
                value={project.humanContext?.audienceNeeds}
              />
              <TextDisplay
                label="Audience Desires"
                value={project.humanContext?.audienceDesires}
              />
              <TextDisplay
                label="User Role"
                value={project.humanContext?.userRole}
              />
            </div>
          </CollapsibleSection>

          {/* Context & Meaning */}
          <CollapsibleSection
            title="Meaning Architecture"
            icon={<Globe className="w-4 h-4" />}
            defaultOpen={false}
            onExpand={() => onSectionClick?.("contextAndMeaning")}
          >
            <div className="space-y-2">
              <TextDisplay label="World" value={project.contextAndMeaning?.world} />
              <TextDisplay label="Story" value={project.contextAndMeaning?.story} />
              <TextDisplay label="Magic" value={project.contextAndMeaning?.magic} />
            </div>
          </CollapsibleSection>

          {/* Reality Planes */}
          <CollapsibleSection
            title="Reality Planes"
            icon={<Layers className="w-4 h-4" />}
            defaultOpen={false}
            onExpand={() => onSectionClick?.("realityPlanes")}
          >
            <div className="space-y-1">
              {Object.entries(project.realityPlanes || {}).map(([code, value]) => (
                <SliderDisplay
                  key={code}
                  label={REALITY_PLANE_LABELS[code] || code}
                  value={value}
                  color="hsl(175 70% 45%)"
                />
              ))}
            </div>
          </CollapsibleSection>

          {/* Sensory Domains */}
          <CollapsibleSection
            title="Sensory Domains"
            icon={<Eye className="w-4 h-4" />}
            defaultOpen={false}
            onExpand={() => onSectionClick?.("sensoryDomains")}
          >
            <div className="space-y-1">
              {Object.entries(project.sensoryDomains || {}).map(([code, value]) => (
                <SliderDisplay
                  key={code}
                  label={SENSORY_DOMAIN_LABELS[code] || code}
                  value={value}
                  color="hsl(280 60% 50%)"
                />
              ))}
            </div>
          </CollapsibleSection>

          {/* Presence Types */}
          <CollapsibleSection
            title="Presence Types"
            icon={<Radio className="w-4 h-4" />}
            defaultOpen={false}
            onExpand={() => onSectionClick?.("presence")}
          >
            <div className="space-y-1">
              {Object.entries(project.presenceTypes || {}).map(([code, value]) => (
                <SliderDisplay
                  key={code}
                  label={PRESENCE_TYPE_LABELS[code] || code}
                  value={value}
                  color="hsl(200 70% 50%)"
                />
              ))}
            </div>
          </CollapsibleSection>

          {/* State Mapping */}
          <CollapsibleSection
            title="State Mapping"
            icon={<Brain className="w-4 h-4" />}
            defaultOpen={false}
            onExpand={() => onSectionClick?.("stateMapping")}
          >
            <div className="space-y-2">
              {Object.entries(project.stateMapping || {}).map(([code, value]) => (
                <TextDisplay
                  key={code}
                  label={STATE_QUADRANT_LABELS[code] || code}
                  value={value}
                />
              ))}
            </div>
          </CollapsibleSection>

          {/* Trait Mapping */}
          <CollapsibleSection
            title="Trait Mapping"
            icon={<Heart className="w-4 h-4" />}
            defaultOpen={false}
            onExpand={() => onSectionClick?.("traitMapping")}
          >
            <div className="space-y-2">
              {Object.entries(project.traitMapping || {}).map(([code, value]) => (
                <TextDisplay
                  key={code}
                  label={TRAIT_QUADRANT_LABELS[code] || code}
                  value={value}
                />
              ))}
            </div>
          </CollapsibleSection>
        </div>
      </ScrollArea>
    </div>
  );
}
