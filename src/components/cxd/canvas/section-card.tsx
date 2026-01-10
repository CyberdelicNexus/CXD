'use client';

import { CXDSection, CXDProject, REALITY_PLANES, SENSORY_DOMAINS, PRESENCE_TYPES, EXPERIENCE_FLOW_STAGES, STATE_QUADRANTS, TRAIT_QUADRANTS } from '@/types/cxd-schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  BookOpen, 
  Wand2, 
  User, 
  Users,
  Layers, 
  Eye, 
  Radio, 
  Activity, 
  Brain, 
  Heart,
  Maximize2,
  Target,
  Lightbulb
} from 'lucide-react';

interface SectionCardProps {
  section: CXDSection;
  project: CXDProject;
  position: { x: number; y: number };
  onClick: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  isDragging?: boolean;
}

const sectionIcons: Record<string, React.ReactNode> = {
  intentionCore: <Target className="w-5 h-5" />,
  desiredChange: <Lightbulb className="w-5 h-5" />,
  humanContext: <Users className="w-5 h-5" />,
  contextAndMeaning: <Globe className="w-5 h-5" />,
  realityPlanes: <Layers className="w-5 h-5" />,
  sensoryDomains: <Eye className="w-5 h-5" />,
  presence: <Radio className="w-5 h-5" />,
  experienceFlow: <Activity className="w-5 h-5" />,
  stateMapping: <Brain className="w-5 h-5" />,
  traitMapping: <Heart className="w-5 h-5" />,
};

const sectionColors: Record<string, string> = {
  intentionCore: 'from-amber-500/20 to-yellow-500/20',
  desiredChange: 'from-rose-500/20 to-pink-500/20',
  humanContext: 'from-sky-500/20 to-blue-500/20',
  contextAndMeaning: 'from-purple-500/20 to-indigo-500/20',
  realityPlanes: 'from-teal-500/20 to-cyan-500/20',
  sensoryDomains: 'from-pink-500/20 to-rose-500/20',
  presence: 'from-blue-500/20 to-sky-500/20',
  experienceFlow: 'from-orange-500/20 to-amber-500/20',
  stateMapping: 'from-violet-500/20 to-purple-500/20',
  traitMapping: 'from-emerald-500/20 to-teal-500/20',
};

export function SectionCard({ section, project, position, onClick, onMouseDown, onMouseUp, onDoubleClick, isDragging }: SectionCardProps) {
  const renderPreview = () => {
    switch (section.id) {
      case 'intentionCore':
        return (
          <div className="space-y-2 text-xs">
            {project.intentionCore?.coreMessage && (
              <div className="p-2 rounded bg-primary/10 border border-primary/20">
                <span className="text-muted-foreground line-clamp-2 text-center italic">"{project.intentionCore.coreMessage}"</span>
              </div>
            )}
            {project.intentionCore?.mainConcept && (
              <div className="flex items-start gap-2">
                <Target className="w-3 h-3 mt-0.5 text-muted-foreground" />
                <span className="text-muted-foreground line-clamp-1">{project.intentionCore.mainConcept}</span>
              </div>
            )}
            {!project.intentionCore?.coreMessage && !project.intentionCore?.mainConcept && (
              <p className="text-muted-foreground italic">Click to define intention...</p>
            )}
          </div>
        );

      case 'desiredChange':
        return (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {['insights', 'feelings', 'states', 'knowledge'].map((key) => (
              <div key={key} className="p-1 rounded bg-secondary/30">
                <span className="text-[10px] text-muted-foreground capitalize block">{key}</span>
                <span className="line-clamp-1">
                  {project.desiredChange?.[key as keyof typeof project.desiredChange] || '—'}
                </span>
              </div>
            ))}
          </div>
        );

      case 'humanContext':
        return (
          <div className="space-y-2 text-xs">
            {project.humanContext?.audienceNeeds && (
              <div className="flex items-start gap-2">
                <Users className="w-3 h-3 mt-0.5 text-muted-foreground" />
                <span className="text-muted-foreground line-clamp-1">{project.humanContext.audienceNeeds}</span>
              </div>
            )}
            {project.humanContext?.userRole && (
              <div className="flex items-start gap-2">
                <User className="w-3 h-3 mt-0.5 text-muted-foreground" />
                <span className="text-muted-foreground line-clamp-1">{project.humanContext.userRole}</span>
              </div>
            )}
            {!project.humanContext?.audienceNeeds && !project.humanContext?.userRole && (
              <p className="text-muted-foreground italic">Click to define audience...</p>
            )}
          </div>
        );

      case 'contextAndMeaning':
        return (
          <div className="space-y-2 text-xs">
            {project.contextAndMeaning?.world && (
              <div className="flex items-start gap-2">
                <Globe className="w-3 h-3 mt-0.5 text-muted-foreground" />
                <span className="text-muted-foreground line-clamp-1">{project.contextAndMeaning.world}</span>
              </div>
            )}
            {project.contextAndMeaning?.story && (
              <div className="flex items-start gap-2">
                <BookOpen className="w-3 h-3 mt-0.5 text-muted-foreground" />
                <span className="text-muted-foreground line-clamp-1">{project.contextAndMeaning.story}</span>
              </div>
            )}
            {project.contextAndMeaning?.magic && (
              <div className="flex items-start gap-2">
                <Wand2 className="w-3 h-3 mt-0.5 text-muted-foreground" />
                <span className="text-muted-foreground line-clamp-1">{project.contextAndMeaning.magic}</span>
              </div>
            )}
            {!project.contextAndMeaning?.world && !project.contextAndMeaning?.story && (
              <p className="text-muted-foreground italic">Click to define context...</p>
            )}
          </div>
        );

      case 'realityPlanes':
        return (
          <div className="space-y-1">
            {REALITY_PLANES.map((plane) => (
              <div key={plane.code} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-8">{plane.code}</span>
                <Progress value={project.realityPlanes[plane.code]} className="h-1.5 flex-1" />
                <span className="text-xs font-mono text-muted-foreground w-8">
                  {project.realityPlanes[plane.code]}%
                </span>
              </div>
            ))}
          </div>
        );

      case 'sensoryDomains':
        return (
          <div className="space-y-1">
            {SENSORY_DOMAINS.map((domain) => (
              <div key={domain.code} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16 capitalize">{domain.code}</span>
                <Progress value={project.sensoryDomains[domain.code]} className="h-1.5 flex-1" />
                <span className="text-xs font-mono text-muted-foreground w-8">
                  {project.sensoryDomains[domain.code]}%
                </span>
              </div>
            ))}
          </div>
        );

      case 'presence':
        return (
          <div className="grid grid-cols-2 gap-1">
            {PRESENCE_TYPES.map((presence) => (
              <div key={presence.code} className="flex items-center gap-1">
                <div 
                  className="w-2 h-2 rounded-full bg-primary"
                  style={{ opacity: project.presenceTypes[presence.code] / 100 }}
                />
                <span className="text-xs text-muted-foreground capitalize truncate">
                  {presence.code}
                </span>
              </div>
            ))}
          </div>
        );

      case 'experienceFlow':
        return (
          <div className="flex items-end justify-between h-16 gap-1">
            {EXPERIENCE_FLOW_STAGES.map((stage) => (
              <div key={stage.code} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full bg-primary rounded-t transition-all"
                  style={{ height: `${project.experienceFlow[stage.code].engagementLevel * 0.6}px` }}
                />
                <span className="text-[8px] text-muted-foreground">{stage.code.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        );

      case 'stateMapping':
        return (
          <div className="grid grid-cols-2 gap-2">
            {STATE_QUADRANTS.map((quadrant) => (
              <div key={quadrant.code} className="p-1 rounded bg-secondary/30">
                <span className="text-[10px] text-muted-foreground capitalize block mb-0.5">{quadrant.code}</span>
                <span className="text-xs line-clamp-2">
                  {project.stateMapping[quadrant.code] || '—'}
                </span>
              </div>
            ))}
          </div>
        );

      case 'traitMapping':
        return (
          <div className="grid grid-cols-2 gap-2">
            {TRAIT_QUADRANTS.map((quadrant) => (
              <div key={quadrant.code} className="p-1 rounded bg-secondary/30">
                <span className="text-[10px] text-muted-foreground capitalize block mb-0.5">{quadrant.code}</span>
                <span className="text-xs line-clamp-2">
                  {project.traitMapping[quadrant.code] || '—'}
                </span>
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
      className={`absolute select-none ${isDragging ? 'z-50' : 'z-10'}`}
      style={{ 
        left: position.x, 
        top: position.y,
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
      }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
      }}
    >
      <Card 
        className={`w-[300px] gradient-border bg-gradient-to-br ${sectionColors[section.id]} backdrop-blur transition-all group ${
          isDragging 
            ? 'scale-105 shadow-2xl ring-2 ring-primary/50 cursor-move' 
            : 'hover:glow-teal cursor-grab active:cursor-grabbing'
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                {sectionIcons[section.id]}
              </div>
              <div>
                <CardTitle className="text-sm">{section.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{section.description}</p>
              </div>
            </div>
            <div title="Double-click to edit">
              <Maximize2 className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {renderPreview()}
        </CardContent>
      </Card>
    </div>
  );
}
