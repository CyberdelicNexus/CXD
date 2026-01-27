'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DashboardNavbar from '@/components/dashboard-navbar';
import { 
  PlayCircle,
  Clock,
  Wand2,
  Layout,
  Layers,
  Sparkles,
  Share2,
  Settings,
  ChevronRight
} from 'lucide-react';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  icon: React.ReactNode;
  thumbnail: string;
  topics: string[];
}

const tutorials: Tutorial[] = [
  {
    id: 'getting-started',
    title: 'Getting Started with CXD Canvas',
    description: 'Learn the basics of CXD Canvas, create your first project, and understand the core concepts of experience design.',
    duration: '8 min',
    difficulty: 'Beginner',
    icon: <Sparkles className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    topics: ['Project Setup', 'Interface Overview', 'First Steps']
  },
  {
    id: 'initiation-wizard',
    title: 'Mastering the Initiation Wizard',
    description: 'Deep dive into the Initiation Wizard. Learn how to answer questions effectively and set up your experience foundation.',
    duration: '12 min',
    difficulty: 'Beginner',
    icon: <Wand2 className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    topics: ['Wizard Steps', 'Voice Input', 'Best Practices']
  },
  {
    id: 'infinite-canvas',
    title: 'Navigating the Infinite Canvas',
    description: 'Master canvas navigation, understand spatial organization, and learn to efficiently work with large experience maps.',
    duration: '10 min',
    difficulty: 'Beginner',
    icon: <Layout className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    topics: ['Pan & Zoom', 'Section Editing', 'Minimap']
  },
  {
    id: 'hypercube-visualization',
    title: 'Understanding the Hypercube',
    description: 'Explore the 3D Hypercube view, learn to interpret multidimensional experience data, and use it for design insights.',
    duration: '15 min',
    difficulty: 'Intermediate',
    icon: <Layers className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    topics: ['3D Navigation', 'Layer Analysis', 'Design Balance']
  },
  {
    id: 'focus-mode',
    title: 'Deep Work with Focus Mode',
    description: 'Learn when and how to use Focus Mode for detailed editing of individual experience dimensions.',
    duration: '9 min',
    difficulty: 'Intermediate',
    icon: <Sparkles className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    topics: ['Entering Focus Mode', 'Sliders & Controls', 'Validation']
  },
  {
    id: 'reality-planes',
    title: 'Working with Reality Planes',
    description: 'Understand the seven reality planes (PR, AR, VR, MR, GR, BR, CR) and how to compose them effectively.',
    duration: '14 min',
    difficulty: 'Intermediate',
    icon: <Layers className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    topics: ['Reality Types', 'Mixing Realities', 'Best Practices']
  },
  {
    id: 'states-traits',
    title: 'Mapping States to Traits',
    description: 'Master the art of mapping experiential states to lasting traits. Design for transformation and integration.',
    duration: '16 min',
    difficulty: 'Advanced',
    icon: <Sparkles className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    topics: ['Four Quadrants', 'State Design', 'Trait Integration']
  },
  {
    id: 'experience-flow',
    title: 'Designing Experience Flow',
    description: 'Learn to design the five stages of experience flow from Threshold to Return, managing engagement and narrative.',
    duration: '13 min',
    difficulty: 'Intermediate',
    icon: <Layout className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    topics: ['Five Stages', 'Engagement Curves', 'Narrative Arc']
  },
  {
    id: 'collaboration',
    title: 'Collaboration & Sharing',
    description: 'Share your designs with team members, generate live links, and collaborate effectively on experience maps.',
    duration: '11 min',
    difficulty: 'Beginner',
    icon: <Share2 className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    topics: ['Live Sharing', 'Export Options', 'Team Workflows']
  },
  {
    id: 'advanced-techniques',
    title: 'Advanced Design Techniques',
    description: 'Explore advanced CXD techniques including presence types, sensory composition, and systemic coherence.',
    duration: '20 min',
    difficulty: 'Advanced',
    icon: <Settings className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    topics: ['Presence Design', 'Sensory Balance', 'System Thinking']
  },
];

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Beginner':
      return 'bg-green-500/20 text-green-400 border-green-500/20';
    case 'Intermediate':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
    case 'Advanced':
      return 'bg-red-500/20 text-red-400 border-red-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export default function TutorialsPage() {
  return (
    <div className="min-h-screen bg-gradient-radial">
      <DashboardNavbar />
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-gradient">Video Tutorials</span>
          </h1>
          <p className="text-muted-foreground">
            Learn how to use CXD Canvas with step-by-step video guides
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge variant="outline" className="cursor-pointer hover:bg-primary/20">
            All Tutorials
          </Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-primary/20">
            Beginner
          </Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-primary/20">
            Intermediate
          </Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-primary/20">
            Advanced
          </Badge>
        </div>

        {/* Tutorials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tutorials.map((tutorial) => (
            <Card 
              key={tutorial.id}
              className="gradient-border bg-card/50 backdrop-blur hover:bg-card/70 transition-all cursor-pointer group overflow-hidden"
            >
              {/* Thumbnail */}
              <div 
                className="h-40 relative overflow-hidden"
                style={{ background: tutorial.thumbnail }}
              >
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                    <PlayCircle className="w-8 h-8 text-white" />
                  </div>
                </div>
                {/* Icon Badge */}
                <div className="absolute top-3 left-3 w-10 h-10 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                  {tutorial.icon}
                </div>
                {/* Duration Badge */}
                <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm flex items-center gap-1 text-white text-xs">
                  <Clock className="w-3 h-3" />
                  {tutorial.duration}
                </div>
              </div>

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <CardTitle className="text-base line-clamp-2">{tutorial.title}</CardTitle>
                </div>
                <Badge variant="outline" className={`w-fit text-xs ${getDifficultyColor(tutorial.difficulty)}`}>
                  {tutorial.difficulty}
                </Badge>
              </CardHeader>

              <CardContent className="space-y-4">
                <CardDescription className="line-clamp-2 text-sm">
                  {tutorial.description}
                </CardDescription>

                {/* Topics */}
                <div className="flex flex-wrap gap-1">
                  {tutorial.topics.map((topic) => (
                    <Badge 
                      key={topic}
                      variant="outline" 
                      className="text-xs bg-background/50"
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>

                <Button className="w-full group/btn" variant="outline">
                  Watch Tutorial
                  <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Coming Soon Section */}
        <Card className="gradient-border bg-card/50 backdrop-blur mt-8">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">More Tutorials Coming Soon</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              We're constantly adding new tutorials to help you master CXD Canvas. 
              Check back regularly for updates.
            </p>
            <Button variant="outline">
              Request a Tutorial Topic
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
