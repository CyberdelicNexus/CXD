'use client';

import { useEffect, useState } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import { CXDProject, CXD_SECTIONS, REALITY_PLANES, SENSORY_DOMAINS, PRESENCE_TYPES, EXPERIENCE_FLOW_STAGES, STATE_QUADRANTS, TRAIT_QUADRANTS } from '@/types/cxd-schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
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
  Lock,
  Target
} from 'lucide-react';

export default function SharePage({ params }: { params: { token: string } }) {
  const { projects } = useCXDStore();
  const [project, setProject] = useState<CXDProject | null>(null);

  useEffect(() => {
    const found = projects.find(p => p.shareToken === params.token);
    setProject(found || null);
  }, [projects, params.token]);

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-radial flex items-center justify-center">
        <Card className="gradient-border bg-card/50 backdrop-blur max-w-md">
          <CardContent className="pt-6 text-center">
            <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Share Link Not Found</h2>
            <p className="text-muted-foreground">
              This share link may have expired or been revoked.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-radial">
      {/* Header */}
      <header className="h-16 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="h-full px-4 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-border flex items-center justify-center glow-teal">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="text-lg font-semibold text-gradient">CXD Canvas</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-muted-foreground">
              Read Only
            </Badge>
            <span className="text-sm text-foreground">{project.name}</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Intention Core */}
          {(project.intentionCore?.coreMessage || project.intentionCore?.mainConcept) && (
            <Card className="gradient-border bg-card/50 backdrop-blur lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  <CardTitle>Intention Core</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.intentionCore?.coreMessage && (
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
                    <p className="text-lg italic">"{project.intentionCore.coreMessage}"</p>
                  </div>
                )}
                {project.intentionCore?.mainConcept && (
                  <p className="text-muted-foreground">{project.intentionCore.mainConcept}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Human Context */}
          {(project.humanContext?.audienceNeeds || project.humanContext?.userRole) && (
            <Card className="gradient-border bg-card/50 backdrop-blur">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <CardTitle>Human Context</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.humanContext?.audienceNeeds && (
                  <div>
                    <span className="text-sm font-medium">Audience Needs</span>
                    <p className="text-sm text-muted-foreground">{project.humanContext.audienceNeeds}</p>
                  </div>
                )}
                {project.humanContext?.audienceDesires && (
                  <div>
                    <span className="text-sm font-medium">Audience Desires</span>
                    <p className="text-sm text-muted-foreground">{project.humanContext.audienceDesires}</p>
                  </div>
                )}
                {project.humanContext?.userRole && (
                  <div>
                    <span className="text-sm font-medium">User Role</span>
                    <p className="text-sm text-muted-foreground">{project.humanContext.userRole}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Context & Meaning */}
          <Card className="gradient-border bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                <CardTitle>Meaning Architecture</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.contextAndMeaning?.world && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">World</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{project.contextAndMeaning.world}</p>
                </div>
              )}
              {project.contextAndMeaning?.story && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Story</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{project.contextAndMeaning.story}</p>
                </div>
              )}
              {project.contextAndMeaning?.magic && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Wand2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Magic</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{project.contextAndMeaning.magic}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reality Planes */}
          <Card className="gradient-border bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <CardTitle>Reality Planes</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {REALITY_PLANES.map((plane) => (
                <div key={plane.code} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-20">{plane.label}</span>
                  <Progress value={project.realityPlanes[plane.code]} className="flex-1 h-2" />
                  <span className="text-sm font-mono w-12 text-right">{project.realityPlanes[plane.code]}%</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Sensory Domains */}
          <Card className="gradient-border bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                <CardTitle>Sensory Domains</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {SENSORY_DOMAINS.map((domain) => (
                <div key={domain.code} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-20 capitalize">{domain.code}</span>
                  <Progress value={project.sensoryDomains[domain.code]} className="flex-1 h-2" />
                  <span className="text-sm font-mono w-12 text-right">{project.sensoryDomains[domain.code]}%</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Presence Types */}
          <Card className="gradient-border bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-primary" />
                <CardTitle>Presence & Engagement</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {PRESENCE_TYPES.map((presence) => (
                <div key={presence.code} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-28">{presence.label}</span>
                  <Progress value={project.presenceTypes[presence.code]} className="flex-1 h-2" />
                  <span className="text-sm font-mono w-12 text-right">{project.presenceTypes[presence.code]}%</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Experience Flow */}
          <Card className="gradient-border bg-card/50 backdrop-blur lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <CardTitle>Experience Flow</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between h-32 gap-4 mb-6">
                {EXPERIENCE_FLOW_STAGES.map((stage) => (
                  <div key={stage.code} className="flex-1 flex flex-col items-center gap-2">
                    <div 
                      className="w-full bg-gradient-to-t from-primary to-accent rounded-t transition-all"
                      style={{ height: `${project.experienceFlow[stage.code].engagementLevel}%` }}
                    />
                    <span className="text-xs text-muted-foreground text-center">{stage.label}</span>
                    <span className="text-xs font-mono">{project.experienceFlow[stage.code].engagementLevel}%</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-4">
                {EXPERIENCE_FLOW_STAGES.map((stage) => (
                  <div key={stage.code} className="space-y-2">
                    <h4 className="text-sm font-medium">{stage.label}</h4>
                    {project.experienceFlow[stage.code].narrativeNotes && (
                      <p className="text-xs text-muted-foreground">{project.experienceFlow[stage.code].narrativeNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* State Mapping */}
          <Card className="gradient-border bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <CardTitle>State Mapping</CardTitle>
              </div>
              <CardDescription>Designed transient states</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {STATE_QUADRANTS.map((quadrant) => (
                  <div key={quadrant.code} className="p-3 rounded-lg bg-secondary/30">
                    <h4 className="text-sm font-medium mb-1 capitalize">{quadrant.code}</h4>
                    <p className="text-xs text-muted-foreground">
                      {project.stateMapping[quadrant.code] || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Trait Mapping */}
          <Card className="gradient-border bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                <CardTitle>Trait Mapping</CardTitle>
              </div>
              <CardDescription>Lasting transformations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {TRAIT_QUADRANTS.map((quadrant) => (
                  <div key={quadrant.code} className="p-3 rounded-lg bg-secondary/30">
                    <h4 className="text-sm font-medium mb-1 capitalize">{quadrant.code}</h4>
                    <p className="text-xs text-muted-foreground">
                      {project.traitMapping[quadrant.code] || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
