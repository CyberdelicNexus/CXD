"use client";

import { CXDProject, REALITY_PLANES, SENSORY_DOMAINS, PRESENCE_TYPES, STATE_QUADRANTS, TRAIT_QUADRANTS } from "@/types/cxd-schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Target,
  Sparkles,
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
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CXDShareSummaryProps {
  project: CXDProject;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function CollapsibleSection({ title, icon, children, defaultExpanded = true }: SectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card className="gradient-border bg-card/80 backdrop-blur overflow-hidden">
      <CardHeader
        className="cursor-pointer hover:bg-primary/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center glow-purple">
              {icon}
            </div>
            <span className="text-gradient">{title}</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <CardContent className="pt-0">{children}</CardContent>
        </div>
      </div>
    </Card>
  );
}

function SliderDisplay({ label, value, description }: { label: string; value: number; description?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="outline" className="font-mono">
          {value}%
        </Badge>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <Progress value={value} className="h-2" />
    </div>
  );
}

function TextDisplay({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export function CXDShareSummary({ project }: CXDShareSummaryProps) {
  return (
    <ScrollArea className="h-full">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-gradient">{project.name}</h1>
          <p className="text-muted-foreground">CXD Experience Design Summary</p>
        </div>

        {/* 1. Intention Core */}
        <CollapsibleSection
          title="Intention Core"
          icon={<Target className="w-5 h-5 text-primary" />}
        >
          <div className="space-y-4">
            <TextDisplay label="Project Name" value={project.intentionCore?.projectName || project.name} />
            <TextDisplay label="Main Concept" value={project.intentionCore?.mainConcept || ""} />
            <TextDisplay label="Core Message" value={project.intentionCore?.coreMessage || ""} />
          </div>
        </CollapsibleSection>

        {/* 2. Desired Change */}
        <CollapsibleSection
          title="Desired Change"
          icon={<Sparkles className="w-5 h-5 text-primary" />}
        >
          <div className="grid grid-cols-2 gap-4">
            <TextDisplay label="Insights" value={project.desiredChange?.insights || ""} />
            <TextDisplay label="Feelings" value={project.desiredChange?.feelings || ""} />
            <TextDisplay label="States" value={project.desiredChange?.states || ""} />
            <TextDisplay label="Knowledge" value={project.desiredChange?.knowledge || ""} />
          </div>
        </CollapsibleSection>

        {/* 3. Human Context */}
        <CollapsibleSection
          title="Human Context"
          icon={<Users className="w-5 h-5 text-primary" />}
        >
          <div className="space-y-4">
            <TextDisplay label="Audience Needs" value={project.humanContext?.audienceNeeds || ""} />
            <TextDisplay label="Audience Desires" value={project.humanContext?.audienceDesires || ""} />
            <TextDisplay label="User Role" value={project.humanContext?.userRole || ""} />
          </div>
        </CollapsibleSection>

        {/* 4. Context & Meaning */}
        <CollapsibleSection
          title="Context & Meaning"
          icon={<Globe className="w-5 h-5 text-primary" />}
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <span className="font-medium">World</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {project.contextAndMeaning?.world || "Not defined"}
              </p>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="font-medium">Story</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {project.contextAndMeaning?.story || "Not defined"}
              </p>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-primary" />
                <span className="font-medium">Magic</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {project.contextAndMeaning?.magic || "Not defined"}
              </p>
            </div>
          </div>
        </CollapsibleSection>

        {/* 5. Reality Planes */}
        <CollapsibleSection
          title="Reality Planes"
          icon={<Layers className="w-5 h-5 text-primary" />}
        >
          {project.realityPlanesV2 && project.realityPlanesV2.length > 0 ? (
            <div className="space-y-4">
              {project.realityPlanesV2
                .filter((plane) => plane.enabled)
                .sort((a, b) => a.priority - b.priority)
                .map((plane) => {
                  const planeInfo = REALITY_PLANES.find((p) => p.code === plane.code);
                  return (
                    <div key={plane.code} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
                      <Badge variant="outline" className="font-mono">
                        #{plane.priority + 1}
                      </Badge>
                      <div className="flex-1">
                        <span className="font-medium">{planeInfo?.label || plane.code}</span>
                        {plane.interfaceModality && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {plane.interfaceModality}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              {project.realityPlanesV2.filter((p) => p.enabled).length === 0 && (
                <p className="text-sm text-muted-foreground">No reality planes enabled</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {REALITY_PLANES.map((plane) => {
                const value = project.realityPlanes?.[plane.code] || 0;
                if (value === 0) return null;
                return (
                  <SliderDisplay
                    key={plane.code}
                    label={plane.label}
                    value={value}
                    description={plane.description}
                  />
                );
              })}
            </div>
          )}
        </CollapsibleSection>

        {/* 6. Sensory Domains */}
        <CollapsibleSection
          title="Sensory Domains"
          icon={<Eye className="w-5 h-5 text-primary" />}
        >
          <div className="space-y-4">
            {SENSORY_DOMAINS.map((domain) => {
              const value = project.sensoryDomains?.[domain.code] || 0;
              return (
                <SliderDisplay
                  key={domain.code}
                  label={domain.label}
                  value={value}
                  description={domain.description}
                />
              );
            })}
          </div>
        </CollapsibleSection>

        {/* 7. Presence Types */}
        <CollapsibleSection
          title="Presence Types"
          icon={<Radio className="w-5 h-5 text-primary" />}
        >
          <div className="space-y-4">
            {PRESENCE_TYPES.map((presence) => {
              const value = project.presenceTypes?.[presence.code] || 0;
              return (
                <SliderDisplay
                  key={presence.code}
                  label={presence.label}
                  value={value}
                  description={presence.description}
                />
              );
            })}
          </div>
        </CollapsibleSection>

        {/* 8. Experience Flow */}
        {project.experienceFlowV2 && project.experienceFlowV2.length > 0 && (
          <CollapsibleSection
            title="Experience Flow"
            icon={<Radio className="w-5 h-5 text-primary" />}
          >
            <div className="space-y-4">
              {project.experienceFlowV2.map((stage, index) => (
                <div key={stage.id} className="p-4 rounded-lg bg-primary/5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {index + 1}
                    </Badge>
                    <span className="font-medium">{stage.name}</span>
                    {stage.estimatedMinutes && (
                      <Badge variant="secondary" className="ml-auto">
                        {stage.estimatedMinutes} min
                      </Badge>
                    )}
                  </div>
                  {stage.narrativeNotes && (
                    <p className="text-sm text-muted-foreground">{stage.narrativeNotes}</p>
                  )}
                  {stage.designIntent && (
                    <p className="text-xs text-muted-foreground italic">{stage.designIntent}</p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* 9. State Mapping */}
        <CollapsibleSection
          title="State Mapping"
          icon={<Brain className="w-5 h-5 text-primary" />}
        >
          <div className="grid grid-cols-2 gap-4">
            {STATE_QUADRANTS.map((quadrant) => {
              const value = project.stateMapping?.[quadrant.code] || "";
              if (!value) return null;
              return (
                <div key={quadrant.code} className="p-3 rounded-lg bg-primary/5">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    {quadrant.label}
                  </span>
                  <p className="text-sm mt-1">{value}</p>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>

        {/* 10. Trait Mapping */}
        <CollapsibleSection
          title="Trait Mapping"
          icon={<Heart className="w-5 h-5 text-primary" />}
        >
          <div className="grid grid-cols-2 gap-4">
            {TRAIT_QUADRANTS.map((quadrant) => {
              const value = project.traitMapping?.[quadrant.code] || "";
              if (!value) return null;
              return (
                <div key={quadrant.code} className="p-3 rounded-lg bg-primary/5">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    {quadrant.label}
                  </span>
                  <p className="text-sm mt-1">{value}</p>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>

        {/* Footer */}
        <div className="text-center pt-6 pb-10">
          <p className="text-xs text-muted-foreground">
            Generated from CXD Canvas • {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}
