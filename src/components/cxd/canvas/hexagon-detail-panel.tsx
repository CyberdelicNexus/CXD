'use client';

import { useCXDStore } from '@/store/cxd-store';
import { 
  CXDSectionId, 
  CXD_SECTIONS,
  REALITY_PLANES, 
  SENSORY_DOMAINS, 
  PRESENCE_TYPES, 
  EXPERIENCE_FLOW_STAGES,
  STATE_QUADRANTS,
  TRAIT_QUADRANTS
} from '@/types/cxd-schema';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, AlertTriangle } from 'lucide-react';

interface HexagonDetailPanelProps {
  sectionId: CXDSectionId;
  onClose: () => void;
}

export function HexagonDetailPanel({ sectionId, onClose }: HexagonDetailPanelProps) {
  const {
    getCurrentProject,
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
    updateExperienceFlowEngagement,
    updateExperienceFlowNarrative,
    updateExperienceFlowIntent,
    updateStateMapping,
    updateTraitMapping,
  } = useCXDStore();

  const project = getCurrentProject();
  const section = CXD_SECTIONS.find(s => s.id === sectionId);

  if (!project || !section) return null;

  const getAlignmentWarnings = () => {
    const warnings: string[] = [];
    
    STATE_QUADRANTS.forEach((quadrant) => {
      const stateContent = project.stateMapping[quadrant.code];
      const traitContent = project.traitMapping[quadrant.code];
      
      if (stateContent && !traitContent) {
        warnings.push(`${quadrant.label} state defined but no corresponding trait`);
      }
    });
    
    return warnings;
  };

  const renderSectionContent = () => {
    switch (sectionId) {
      case 'intentionCore':
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Project Name</Label>
              <Input
                placeholder="Name your experience..."
                value={project.intentionCore?.projectName || project.name || ''}
                onChange={(e) => updateIntentionProjectName(e.target.value)}
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Main Concept</Label>
              <Textarea
                placeholder="The central concept..."
                value={project.intentionCore?.mainConcept || ''}
                onChange={(e) => updateIntentionMainConcept(e.target.value)}
                className="min-h-[100px] bg-input border-border resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Core Message</Label>
              <Textarea
                placeholder="The core message participants will take away..."
                value={project.intentionCore?.coreMessage || ''}
                onChange={(e) => updateIntentionCoreMessage(e.target.value)}
                className="min-h-[100px] bg-input border-border resize-none"
              />
            </div>
          </div>
        );

      case 'desiredChange':
        return (
          <div className="space-y-5">
            <p className="text-xs text-muted-foreground">
              Define the transformation across cognitive, emotional, and somatic dimensions.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Insights</Label>
                <Textarea
                  placeholder="New understanding, perspectives..."
                  value={project.desiredChange?.insights || ''}
                  onChange={(e) => updateDesiredInsights(e.target.value)}
                  className="min-h-[80px] bg-input border-border resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Feelings</Label>
                <Textarea
                  placeholder="Emotional responses, sensations..."
                  value={project.desiredChange?.feelings || ''}
                  onChange={(e) => updateDesiredFeelings(e.target.value)}
                  className="min-h-[80px] bg-input border-border resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">States</Label>
                <Textarea
                  placeholder="Mental states, altered consciousness..."
                  value={project.desiredChange?.states || ''}
                  onChange={(e) => updateDesiredStates(e.target.value)}
                  className="min-h-[80px] bg-input border-border resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Knowledge</Label>
                <Textarea
                  placeholder="Information, skills, understanding..."
                  value={project.desiredChange?.knowledge || ''}
                  onChange={(e) => updateDesiredKnowledge(e.target.value)}
                  className="min-h-[80px] bg-input border-border resize-none"
                />
              </div>
            </div>
          </div>
        );

      case 'humanContext':
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Audience Needs</Label>
              <Textarea
                placeholder="Unmet needs, pain points, aspirations..."
                value={project.humanContext?.audienceNeeds || ''}
                onChange={(e) => updateHumanAudienceNeeds(e.target.value)}
                className="min-h-[100px] bg-input border-border resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Audience Desires</Label>
              <Textarea
                placeholder="Motivations, wants, hopes..."
                value={project.humanContext?.audienceDesires || ''}
                onChange={(e) => updateHumanAudienceDesires(e.target.value)}
                className="min-h-[100px] bg-input border-border resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">User Role</Label>
              <Textarea
                placeholder="Describe participant agency..."
                value={project.humanContext?.userRole || ''}
                onChange={(e) => updateHumanUserRole(e.target.value)}
                className="min-h-[100px] bg-input border-border resize-none"
              />
            </div>
          </div>
        );

      case 'contextAndMeaning':
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">World</Label>
              <Textarea
                placeholder="The world of your experience..."
                value={project.contextAndMeaning?.world || ''}
                onChange={(e) => updateContextWorld(e.target.value)}
                className="min-h-[100px] bg-input border-border resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Story</Label>
              <Textarea
                placeholder="The story of your experience..."
                value={project.contextAndMeaning?.story || ''}
                onChange={(e) => updateContextStory(e.target.value)}
                className="min-h-[100px] bg-input border-border resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Magic</Label>
              <Textarea
                placeholder="The magic of your experience..."
                value={project.contextAndMeaning?.magic || ''}
                onChange={(e) => updateContextMagic(e.target.value)}
                className="min-h-[100px] bg-input border-border resize-none"
              />
            </div>
          </div>
        );

      case 'realityPlanes':
        return (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">
              Adjust the emphasis of each reality plane.
            </p>
            {REALITY_PLANES.map((plane) => (
              <div key={plane.code} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">{plane.label}</Label>
                    <p className="text-xs text-muted-foreground">{plane.description}</p>
                  </div>
                  <span className="text-lg font-mono text-primary">
                    {project.realityPlanes[plane.code]}%
                  </span>
                </div>
                <Slider
                  value={[project.realityPlanes[plane.code]]}
                  onValueChange={([value]) => updateRealityPlane(plane.code, value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        );

      case 'sensoryDomains':
        return (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">
              Define the intensity of each sensory modality.
            </p>
            {SENSORY_DOMAINS.map((domain) => (
              <div key={domain.code} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">{domain.label}</Label>
                    <p className="text-xs text-muted-foreground">{domain.description}</p>
                  </div>
                  <span className="text-lg font-mono text-primary">
                    {project.sensoryDomains[domain.code]}%
                  </span>
                </div>
                <Slider
                  value={[project.sensoryDomains[domain.code]]}
                  onValueChange={([value]) => updateSensoryDomain(domain.code, value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        );

      case 'presence':
        return (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">
              Configure the types of presence you want to cultivate.
            </p>
            {PRESENCE_TYPES.map((presence) => (
              <div key={presence.code} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">{presence.label}</Label>
                    <p className="text-xs text-muted-foreground">{presence.description}</p>
                  </div>
                  <span className="text-lg font-mono text-primary">
                    {project.presenceTypes[presence.code]}%
                  </span>
                </div>
                <Slider
                  value={[project.presenceTypes[presence.code]]}
                  onValueChange={([value]) => updatePresenceType(presence.code, value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        );

      case 'experienceFlow':
        return (
          <div className="space-y-4">
            <div className="flex items-end justify-between h-28 gap-2 p-3 rounded-lg bg-secondary/20">
              {EXPERIENCE_FLOW_STAGES.map((stage) => (
                <div key={stage.code} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-gradient-to-t from-primary to-accent rounded-t transition-all"
                    style={{ height: `${project.experienceFlow[stage.code].engagementLevel}%` }}
                  />
                  <span className="text-[9px] text-muted-foreground text-center font-medium">{stage.label}</span>
                </div>
              ))}
            </div>

            <Tabs defaultValue="preparation" className="w-full">
              <TabsList className="grid grid-cols-5 w-full h-auto">
                {EXPERIENCE_FLOW_STAGES.map((stage) => (
                  <TabsTrigger key={stage.code} value={stage.code} className="text-[10px] px-1 py-1.5">
                    {stage.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {EXPERIENCE_FLOW_STAGES.map((stage) => (
                <TabsContent key={stage.code} value={stage.code} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Engagement Level</Label>
                      <span className="text-lg font-mono text-primary">
                        {project.experienceFlow[stage.code].engagementLevel}%
                      </span>
                    </div>
                    <Slider
                      value={[project.experienceFlow[stage.code].engagementLevel]}
                      onValueChange={([value]) => updateExperienceFlowEngagement(stage.code, value)}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Narrative Notes</Label>
                    <Textarea
                      placeholder={`What happens during ${stage.label.toLowerCase()}?`}
                      value={project.experienceFlow[stage.code].narrativeNotes}
                      onChange={(e) => updateExperienceFlowNarrative(stage.code, e.target.value)}
                      className="min-h-[70px] bg-input border-border resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Design Intent</Label>
                    <Textarea
                      placeholder={`Design intent for ${stage.label.toLowerCase()}...`}
                      value={project.experienceFlow[stage.code].designIntent}
                      onChange={(e) => updateExperienceFlowIntent(stage.code, e.target.value)}
                      className="min-h-[70px] bg-input border-border resize-none"
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        );

      case 'stateMapping':
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Define the transient states across four quadrants.
            </p>
            <div className="space-y-4">
              {STATE_QUADRANTS.map((quadrant) => (
                <div key={quadrant.code} className="space-y-2">
                  <Label className="text-sm font-semibold">{quadrant.label}</Label>
                  <p className="text-xs text-muted-foreground">{quadrant.description}</p>
                  <Textarea
                    placeholder={`Describe ${quadrant.label.toLowerCase()} states...`}
                    value={project.stateMapping[quadrant.code]}
                    onChange={(e) => updateStateMapping(quadrant.code, e.target.value)}
                    className="min-h-[80px] bg-input border-border resize-none"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'traitMapping':
        const warnings = getAlignmentWarnings();
        return (
          <div className="space-y-4">
            {warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/20 border border-amber-500/50">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-500">Alignment Warnings</span>
                </div>
                <ul className="space-y-0.5">
                  {warnings.map((warning, i) => (
                    <li key={i} className="text-xs text-amber-200">{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Define lasting traits that emerge from the experience.
            </p>
            <div className="space-y-4">
              {TRAIT_QUADRANTS.map((quadrant) => (
                <div key={quadrant.code} className="space-y-2">
                  <Label className="text-sm font-semibold">{quadrant.label}</Label>
                  <p className="text-xs text-muted-foreground">{quadrant.description}</p>
                  <Textarea
                    placeholder={`Describe ${quadrant.label.toLowerCase()} traits...`}
                    value={project.traitMapping[quadrant.code]}
                    onChange={(e) => updateTraitMapping(quadrant.code, e.target.value)}
                    className="min-h-[80px] bg-input border-border resize-none"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold">{section.label}</h2>
          <p className="text-xs text-muted-foreground">{section.description}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        {renderSectionContent()}
      </ScrollArea>
    </div>
  );
}
