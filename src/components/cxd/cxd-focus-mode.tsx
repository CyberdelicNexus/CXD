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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, AlertTriangle } from 'lucide-react';

interface CXDFocusModeProps {
  sectionId: CXDSectionId;
}

export function CXDFocusMode({ sectionId }: CXDFocusModeProps) {
  const {
    getCurrentProject,
    setFocusedSection,
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

  // Check for state-trait alignment warnings
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
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-lg font-semibold">Project Name</Label>
              <p className="text-sm text-muted-foreground">
                Name your experience to capture its essence.
              </p>
              <Input
                placeholder="Name your experience..."
                value={project.intentionCore?.projectName || project.name || ''}
                onChange={(e) => updateIntentionProjectName(e.target.value)}
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-lg font-semibold">Main Concept</Label>
              <p className="text-sm text-muted-foreground">
                What is the big idea behind this experience?
              </p>
              <Textarea
                placeholder="The central concept..."
                value={project.intentionCore?.mainConcept || ''}
                onChange={(e) => updateIntentionMainConcept(e.target.value)}
                className="min-h-[120px] bg-input border-border resize-none"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-lg font-semibold">Core Message</Label>
              <p className="text-sm text-muted-foreground">
                What essential message should participants receive? This becomes the center of your canvas.
              </p>
              <Textarea
                placeholder="The core message participants will take away..."
                value={project.intentionCore?.coreMessage || ''}
                onChange={(e) => updateIntentionCoreMessage(e.target.value)}
                className="min-h-[120px] bg-input border-border resize-none"
              />
            </div>
          </div>
        );

      case 'desiredChange':
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Define the transformation you want to create across cognitive, emotional, and somatic dimensions.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Insights</Label>
                <p className="text-sm text-muted-foreground">What insights should participants gain?</p>
                <Textarea
                  placeholder="New understanding, perspectives, realizations..."
                  value={project.desiredChange?.insights || ''}
                  onChange={(e) => updateDesiredInsights(e.target.value)}
                  className="min-h-[100px] bg-input border-border resize-none"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">Feelings</Label>
                <p className="text-sm text-muted-foreground">What feelings should be evoked?</p>
                <Textarea
                  placeholder="Emotional responses, sensations, affects..."
                  value={project.desiredChange?.feelings || ''}
                  onChange={(e) => updateDesiredFeelings(e.target.value)}
                  className="min-h-[100px] bg-input border-border resize-none"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">States</Label>
                <p className="text-sm text-muted-foreground">What states should be induced?</p>
                <Textarea
                  placeholder="Mental states, altered consciousness, flow..."
                  value={project.desiredChange?.states || ''}
                  onChange={(e) => updateDesiredStates(e.target.value)}
                  className="min-h-[100px] bg-input border-border resize-none"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">Knowledge</Label>
                <p className="text-sm text-muted-foreground">What knowledge should be imparted?</p>
                <Textarea
                  placeholder="Information, skills, understanding..."
                  value={project.desiredChange?.knowledge || ''}
                  onChange={(e) => updateDesiredKnowledge(e.target.value)}
                  className="min-h-[100px] bg-input border-border resize-none"
                />
              </div>
            </div>
          </div>
        );

      case 'humanContext':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-lg font-semibold">Audience Needs</Label>
              <p className="text-sm text-muted-foreground">
                What needs does your audience have that this experience addresses?
              </p>
              <Textarea
                placeholder="Unmet needs, pain points, aspirations..."
                value={project.humanContext?.audienceNeeds || ''}
                onChange={(e) => updateHumanAudienceNeeds(e.target.value)}
                className="min-h-[120px] bg-input border-border resize-none"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-lg font-semibold">Audience Desires</Label>
              <p className="text-sm text-muted-foreground">
                What desires drive your audience to seek this experience?
              </p>
              <Textarea
                placeholder="Motivations, wants, hopes..."
                value={project.humanContext?.audienceDesires || ''}
                onChange={(e) => updateHumanAudienceDesires(e.target.value)}
                className="min-h-[120px] bg-input border-border resize-none"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-lg font-semibold">User Role</Label>
              <p className="text-sm text-muted-foreground">
                What role does the participant play? (Observer, protagonist, co-creator?)
              </p>
              <Textarea
                placeholder="Describe participant agency and involvement..."
                value={project.humanContext?.userRole || ''}
                onChange={(e) => updateHumanUserRole(e.target.value)}
                className="min-h-[120px] bg-input border-border resize-none"
              />
            </div>
          </div>
        );

      case 'contextAndMeaning':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-lg font-semibold">World</Label>
              <p className="text-sm text-muted-foreground">
                Describe the environment participants will inhabit. What rules govern this world?
              </p>
              <Textarea
                placeholder="The world of your experience..."
                value={project.contextAndMeaning?.world || ''}
                onChange={(e) => updateContextWorld(e.target.value)}
                className="min-h-[120px] bg-input border-border resize-none"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-lg font-semibold">Story</Label>
              <p className="text-sm text-muted-foreground">
                What is the narrative arc? What journey will participants take?
              </p>
              <Textarea
                placeholder="The story of your experience..."
                value={project.contextAndMeaning?.story || ''}
                onChange={(e) => updateContextStory(e.target.value)}
                className="min-h-[120px] bg-input border-border resize-none"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-lg font-semibold">Magic</Label>
              <p className="text-sm text-muted-foreground">
                What mechanism creates transformation? How does change happen?
              </p>
              <Textarea
                placeholder="The magic of your experience..."
                value={project.contextAndMeaning?.magic || ''}
                onChange={(e) => updateContextMagic(e.target.value)}
                className="min-h-[120px] bg-input border-border resize-none"
              />
            </div>
          </div>
        );

      case 'realityPlanes':
        return (
          <div className="space-y-8">
            <p className="text-sm text-muted-foreground">
              Adjust the emphasis of each reality plane. These values are descriptive, not prescriptive—there is no requirement for them to sum to 100%.
            </p>
            {REALITY_PLANES.map((plane) => (
              <div key={plane.code} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">{plane.label}</Label>
                    <p className="text-sm text-muted-foreground">{plane.description}</p>
                  </div>
                  <span className="text-2xl font-mono text-primary">
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
          <div className="space-y-8">
            <p className="text-sm text-muted-foreground">
              Define the intensity of each sensory modality in your experience design.
            </p>
            {SENSORY_DOMAINS.map((domain) => (
              <div key={domain.code} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">{domain.label}</Label>
                    <p className="text-sm text-muted-foreground">{domain.description}</p>
                  </div>
                  <span className="text-2xl font-mono text-primary">
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
          <div className="space-y-8">
            <p className="text-sm text-muted-foreground">
              Configure the types of presence you want to cultivate in your experience.
            </p>
            {PRESENCE_TYPES.map((presence) => (
              <div key={presence.code} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">{presence.label}</Label>
                    <p className="text-sm text-muted-foreground">{presence.description}</p>
                  </div>
                  <span className="text-2xl font-mono text-primary">
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
          <div className="space-y-6">
            <div className="flex items-end justify-between h-40 gap-4 p-4 rounded-lg bg-secondary/20">
              {EXPERIENCE_FLOW_STAGES.map((stage) => (
                <div key={stage.code} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full bg-gradient-to-t from-primary to-accent rounded-t transition-all"
                    style={{ height: `${project.experienceFlow[stage.code].engagementLevel}%` }}
                  />
                  <span className="text-xs text-muted-foreground text-center font-medium">{stage.label}</span>
                </div>
              ))}
            </div>

            <Tabs defaultValue="preparation" className="w-full">
              <TabsList className="grid grid-cols-5 w-full">
                {EXPERIENCE_FLOW_STAGES.map((stage) => (
                  <TabsTrigger key={stage.code} value={stage.code} className="text-xs">
                    {stage.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {EXPERIENCE_FLOW_STAGES.map((stage) => (
                <TabsContent key={stage.code} value={stage.code} className="space-y-6 mt-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Engagement Level</Label>
                      <span className="text-xl font-mono text-primary">
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

                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Narrative Notes</Label>
                    <Textarea
                      placeholder={`What happens during ${stage.label.toLowerCase()}?`}
                      value={project.experienceFlow[stage.code].narrativeNotes}
                      onChange={(e) => updateExperienceFlowNarrative(stage.code, e.target.value)}
                      className="min-h-[100px] bg-input border-border resize-none"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Design Intent</Label>
                    <Textarea
                      placeholder={`What is the design intent for ${stage.label.toLowerCase()}?`}
                      value={project.experienceFlow[stage.code].designIntent}
                      onChange={(e) => updateExperienceFlowIntent(stage.code, e.target.value)}
                      className="min-h-[100px] bg-input border-border resize-none"
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        );

      case 'stateMapping':
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Define the transient states you want to design for across the four quadrants.
            </p>
            <div className="grid grid-cols-2 gap-6">
              {STATE_QUADRANTS.map((quadrant) => (
                <div key={quadrant.code} className="space-y-3">
                  <Label className="text-base font-semibold">{quadrant.label}</Label>
                  <p className="text-sm text-muted-foreground">{quadrant.description}</p>
                  <Textarea
                    placeholder={`Describe ${quadrant.label.toLowerCase()} states...`}
                    value={project.stateMapping[quadrant.code]}
                    onChange={(e) => updateStateMapping(quadrant.code, e.target.value)}
                    className="min-h-[150px] bg-input border-border resize-none"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'traitMapping':
        const warnings = getAlignmentWarnings();
        return (
          <div className="space-y-6">
            {warnings.length > 0 && (
              <div className="p-4 rounded-lg bg-amber-500/20 border border-amber-500/50">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span className="font-medium text-amber-500">Alignment Warnings</span>
                </div>
                <ul className="space-y-1">
                  {warnings.map((warning, i) => (
                    <li key={i} className="text-sm text-amber-200">{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground">
              Define the lasting traits that should emerge from the experience. States lead to traits.
            </p>
            <div className="grid grid-cols-2 gap-6">
              {TRAIT_QUADRANTS.map((quadrant) => (
                <div key={quadrant.code} className="space-y-3">
                  <Label className="text-base font-semibold">{quadrant.label}</Label>
                  <p className="text-sm text-muted-foreground">{quadrant.description}</p>
                  <Textarea
                    placeholder={`Describe ${quadrant.label.toLowerCase()} traits...`}
                    value={project.traitMapping[quadrant.code]}
                    onChange={(e) => updateTraitMapping(quadrant.code, e.target.value)}
                    className="min-h-[150px] bg-input border-border resize-none"
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
    <div className="fixed inset-0 top-16 bg-background/95 backdrop-blur-xl z-40">
      <div className="h-full max-w-4xl mx-auto px-4 py-8">
        <Card className="h-full gradient-border bg-card/50 backdrop-blur flex flex-col">
          <CardHeader className="flex-none flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{section.label}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFocusedSection(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-4">
              {renderSectionContent()}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
