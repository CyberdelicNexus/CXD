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
  LogIn,
  UserPlus
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '../../../supabase/client';
import { fetchUserProjects, ensureUserProfile } from '@/lib/supabase-projects';

export function CXDHome() {
  const { projects, createProject, loadProject, deleteProject, setProjects } = useCXDStore();
  const [newProjectName, setNewProjectName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserAndProjects = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserId(user.id);
        await ensureUserProfile(user.id, user.email || '');
        const userProjects = await fetchUserProjects(user.id);
        // Database is source of truth - replace local state entirely
        // This ensures reload restores exact state from DB
        if (userProjects.length > 0) {
          setProjects(userProjects);
        }
      }
      setIsLoading(false);
    };
    
    loadUserAndProjects();
  }, [setProjects]);

  const handleCreateProject = () => {
    if (newProjectName.trim() && userId) {
      createProject(newProjectName.trim(), userId);
      setNewProjectName('');
      setIsDialogOpen(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-border mb-6 glow-purple">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">Cyberdelic Experience Design</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your vision into a coherent experience map. Design states that become traits.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="gradient-border bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mb-2">
                <Wand2 className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Initiation Wizard</CardTitle>
              <CardDescription>
                Guided questions mapped 1:1 to CXD sections for structured design.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="gradient-border bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center mb-2">
                <Layout className="w-5 h-5 text-accent" />
              </div>
              <CardTitle className="text-lg">Infinite Canvas</CardTitle>
              <CardDescription>
                Spatial visualization of all CXD sections with pan, zoom, and focus mode.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="gradient-border bg-card/50 backdrop-blur">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mb-2">
                <Share2 className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Live Share</CardTitle>
              <CardDescription>
                Generate read-only links to communicate with collaborators and stakeholders.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Auth Section - Show when not logged in */}
        {!userId && !isLoading && (
          <Card className="gradient-border bg-card/50 backdrop-blur mb-8">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <UserPlus className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Sign in to Get Started</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Create an account or sign in to start designing transformational cyberdelic experiences.
              </p>
              <div className="flex gap-4">
                <Button asChild variant="outline" className="min-w-[120px]">
                  <Link href="/sign-in">
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </Link>
                </Button>
                <Button asChild className="glow-teal min-w-[120px]">
                  <Link href="/sign-up">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Sign Up
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projects Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Your CXD Maps</h2>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="glow-teal" disabled={!userId}>
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
                    disabled={!newProjectName.trim() || !userId}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Begin Initiation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <Card className="gradient-border bg-card/30 backdrop-blur">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 animate-pulse">
                  <Layout className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Loading your maps...</h3>
              </CardContent>
            </Card>
          ) : projects.length === 0 ? (
            <Card className="gradient-border bg-card/30 backdrop-blur">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Layout className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No maps yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first CXD map to start designing transformational experiences.
                </p>
                <Button onClick={() => setIsDialogOpen(true)} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Map
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card 
                  key={project.id} 
                  className="gradient-border bg-card/50 backdrop-blur hover:glow-teal transition-all cursor-pointer group"
                  onClick={() => loadProject(project.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {project.name}
                      </CardTitle>
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
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </div>
                      {project.wizardCompleted ? (
                        <span className="text-primary text-xs px-2 py-0.5 rounded-full bg-primary/20">
                          Complete
                        </span>
                      ) : (
                        <span className="text-accent text-xs px-2 py-0.5 rounded-full bg-accent/20">
                          In Progress
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
