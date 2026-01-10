'use client';

import { useState, useEffect } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Plus, 
  Sparkles, 
  Layout, 
  Wand2, 
  Share2, 
  Trash2,
  Clock,
  FolderOpen
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { fetchUserProjects, ensureUserProfile } from '@/lib/supabase-projects';

interface DashboardContentProps {
  userId: string;
  userEmail: string;
}

export function DashboardContent({ userId, userEmail }: DashboardContentProps) {
  const router = useRouter();
  const { projects, createProject, loadProject, deleteProject, setProjects } = useCXDStore();
  const [newProjectName, setNewProjectName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserAndProjects = async () => {
      await ensureUserProfile(userId, userEmail);
      const userProjects = await fetchUserProjects(userId);
      if (userProjects.length > 0) {
        setProjects(userProjects);
      }
      setIsLoading(false);
    };
    
    loadUserAndProjects();
  }, [userId, userEmail, setProjects]);

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      createProject(newProjectName.trim(), userId);
      setNewProjectName('');
      setIsDialogOpen(false);
      router.push('/cxd');
    }
  };

  const handleOpenProject = (projectId: string) => {
    loadProject(projectId);
    router.push('/cxd');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <main className="w-full min-h-screen">
      <div className="container mx-auto px-4 py-8 flex flex-col gap-8 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-border mb-4 glow-purple">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            <span className="text-gradient">Your CXD Dashboard</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Manage your Cyberdelic Experience Design projects
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="gradient-border bg-card/50 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mb-2">
                <Wand2 className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-base">Initiation Wizard</CardTitle>
              <CardDescription className="text-sm">
                Guided questions for structured design
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="gradient-border bg-card/50 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center mb-2">
                <Layout className="w-5 h-5 text-accent" />
              </div>
              <CardTitle className="text-base">Infinite Canvas</CardTitle>
              <CardDescription className="text-sm">
                Spatial visualization with focus mode
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="gradient-border bg-card/50 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mb-2">
                <Share2 className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-base">Live Share</CardTitle>
              <CardDescription className="text-sm">
                Share with collaborators and stakeholders
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Projects Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Your CXD Maps</h2>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="glow-teal">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Map
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Create New CXD Map</DialogTitle>
                  <DialogDescription>
                    Give your experience design map a name to get started.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project Name</Label>
                    <Input
                      id="name"
                      placeholder="My Cyberdelic Experience"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                      className="bg-input border-border"
                    />
                  </div>
                  <Button 
                    onClick={handleCreateProject} 
                    className="w-full glow-teal"
                    disabled={!newProjectName.trim()}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Begin Initiation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-muted-foreground">Loading your projects...</div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && projects.length === 0 && (
            <Card className="gradient-border bg-card/50 backdrop-blur">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <FolderOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No projects yet</h3>
                <p className="text-muted-foreground text-center mb-4 max-w-md">
                  Create your first CXD map to start designing transformational experiences.
                </p>
                <Button onClick={() => setIsDialogOpen(true)} className="glow-teal">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Map
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Projects Grid */}
          {!isLoading && projects.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card 
                  key={project.id} 
                  className="gradient-border bg-card/50 backdrop-blur hover:bg-card/70 transition-colors cursor-pointer group"
                  onClick={() => handleOpenProject(project.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(project.updatedAt)}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(project.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description || 'No description'}
                    </p>
                    {/* Progress status removed - wizardStep no longer exists */}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
