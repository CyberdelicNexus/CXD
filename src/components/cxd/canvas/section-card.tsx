'use client';

import { CXDSection, CXDProject, REALITY_PLANES, SENSORY_DOMAINS, PRESENCE_TYPES, EXPERIENCE_FLOW_STAGES, STATE_QUADRANTS, TRAIT_QUADRANTS, DEFAULT_REALITY_PLANES_V2 } from '@/types/cxd-schema';
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
  Lightbulb,
  Ear,
  Wind,
  Apple,
  Fingerprint,
  PersonStanding,
  Zap,
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
  presence: 'from-blue-600/20 to-indigo-600/20',
  experienceFlow: 'from-orange-600/20 to-amber-600/20',
  stateMapping: 'from-violet-600/20 to-purple-600/20',
  traitMapping: 'from-emerald-600/20 to-green-600/20',
};

const SENSORY_METADATA: Record<string, { icon: React.ReactNode; color: string }> = {
  visual: { icon: <Eye className="w-3 h-3" />, color: "bg-blue-500" },
  auditory: { icon: <Ear className="w-3 h-3" />, color: "bg-indigo-500" },
  olfactory: { icon: <Wind className="w-3 h-3" />, color: "bg-teal-500" },
  gustatory: { icon: <Apple className="w-3 h-3" />, color: "bg-rose-500" },
  haptic: { icon: <Fingerprint className="w-3 h-3" />, color: "bg-purple-500" },
};

const PRESENCE_METADATA: Record<string, { icon: React.ReactNode; color: string }> = {
  mental: { icon: <Brain className="w-3 h-3" />, color: "bg-blue-500" },
  emotional: { icon: <Heart className="w-3 h-3" />, color: "bg-red-500" },
  social: { icon: <Users className="w-3 h-3" />, color: "bg-violet-500" },
  embodied: { icon: <PersonStanding className="w-3 h-3" />, color: "bg-orange-500" },
  environmental: { icon: <Globe className="w-3 h-3" />, color: "bg-emerald-500" },
  active: { icon: <Zap className="w-3 h-3" />, color: "bg-yellow-500" },
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
        const realityPlanesV2 = project.realityPlanesV2 || DEFAULT_REALITY_PLANES_V2;
        const sortedPlanes = [...realityPlanesV2].sort((a, b) => a.priority - b.priority);
        const enabledPlanes = sortedPlanes.filter(p => p.enabled);
        return (
          <div className="space-y-1">
            {enabledPlanes.length > 0 ? (
              enabledPlanes.map((plane, idx) => {
                const planeInfo = REALITY_PLANES.find(p => p.code === plane.code);
                return (
                  <div key={plane.code} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-primary w-6">{idx + 1}</span>
                    <span className="text-xs text-foreground">{plane.code}</span>
                    <span className="text-xs text-muted-foreground flex-1 truncate">
                      {plane.interfaceModality || planeInfo?.label || ''}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground italic">No planes enabled</p>
            )}
          </div>
        );

      case 'sensoryDomains':
        return (
          <div className="space-y-1">
            {SENSORY_DOMAINS.map((domain) => {
              const meta = SENSORY_METADATA[domain.code];
              const value = project.sensoryDomains[domain.code];
              return (
                <div key={domain.code} className="flex items-center gap-2">
                  <div className="text-muted-foreground w-4">{meta.icon}</div>
                  <Progress
                    value={value}
                    className="h-1.5 flex-1"
                    indicatorClassName={`bg-gradient-to-r from-zinc-800 to-${meta.color.replace('bg-', '')}`}
                  />
                  <span className="text-[10px] font-mono text-muted-foreground w-8">
                    {value}%
                  </span>
                </div>
              );
            })}
          </div>
        );

      case 'presence':
        return (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            {PRESENCE_TYPES.map((presence) => {
              const meta = PRESENCE_METADATA[presence.code];
              const value = project.presenceTypes[presence.code];
              return (
                <div key={presence.code} className="flex items-center gap-1.5 p-1 rounded bg-white/5 border border-white/5">
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${meta.color} bg-opacity-20 text-white`}
                  >
                    {meta.icon}
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground capitalize leading-none">
                      {presence.code}
                    </span>
                    <div className="h-0.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${meta.color}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
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
        className={`w-[300px] gradient-border bg-gradient-to-br ${sectionColors[section.id]} backdrop-blur transition-all group ${isDragging
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
