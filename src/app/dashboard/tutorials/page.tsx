'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DashboardNavbar from '@/components/dashboard-navbar';
import { ShimmerGrid } from '@/components/ui/shimmer-grid';
import {
  PlayCircle,
  Clock,
  Layout,
  Layers,
  Sparkles,
  ChevronRight,
  Compass,
  Palette,
  GitBranch,
  Users,
  Zap,
  ClipboardList,
  X
} from 'lucide-react';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  icon: React.ReactNode;
  thumbnail: string;
  category: string;
  // Video URL - supports YouTube, Vimeo, or direct video URLs
  // For YouTube: use format "https://www.youtube.com/embed/VIDEO_ID"
  // For Vimeo: use format "https://player.vimeo.com/video/VIDEO_ID"
  // For direct video: use the direct .mp4 URL
  videoUrl?: string;
  // Custom thumbnail image URL (optional) - if not provided, uses gradient
  // Place images in /public/images/tutorials/ and reference as "/images/tutorials/your-image.jpg"
  thumbnailUrl?: string;
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
    category: 'Getting Started',
    // TODO: Add your video URL here
    // videoUrl: 'https://www.youtube.com/embed/YOUR_VIDEO_ID',
    // thumbnailUrl: '/images/tutorials/getting-started.jpg',
  },
  {
    id: 'experience-framing',
    title: 'Experience Design Framing',
    description: 'Master the Framing panel to define your experience intention, audience, and transformational goals from the start.',
    duration: '10 min',
    difficulty: 'Beginner',
    icon: <Compass className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    category: 'Getting Started',
  },
  {
    id: 'canvas-tools',
    title: 'Navigating the Canvas Tools',
    description: 'Explore all canvas tools including elements, connectors, containers, and learn efficient spatial organization.',
    duration: '12 min',
    difficulty: 'Beginner',
    icon: <Layout className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    category: 'Canvas',
  },
  {
    id: 'hypercube-map',
    title: 'Understanding the Hypercube Map',
    description: 'Explore the 3D Hypercube visualization to see your experience design across multiple dimensions simultaneously.',
    duration: '15 min',
    difficulty: 'Intermediate',
    icon: <Layers className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    category: 'Map',
  },
  {
    id: 'states-traits',
    title: 'Mapping States to Traits',
    description: 'Master the art of mapping experiential states to lasting traits. Design for transformation and integration.',
    duration: '14 min',
    difficulty: 'Intermediate',
    icon: <Palette className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    category: 'Design',
  },
  {
    id: 'experience-flow',
    title: 'Designing Experience Flow',
    description: 'Learn to design the five stages of experience flow from Threshold to Return, managing engagement and narrative arc.',
    duration: '13 min',
    difficulty: 'Intermediate',
    icon: <GitBranch className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    category: 'Design',
  },
  {
    id: 'vision-to-plan',
    title: 'From Vision to Reality: Learn to Plan',
    description: 'Transform your experience designs into actionable plans using the Plan view. Create tasks, timelines, and track production progress.',
    duration: '16 min',
    difficulty: 'Intermediate',
    icon: <ClipboardList className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    category: 'Plan',
  },
  {
    id: 'collaboration-sharing',
    title: 'Collaboration & Sharing',
    description: 'Invite team members, collaborate in real-time with live cursors, and share your designs with stakeholders.',
    duration: '11 min',
    difficulty: 'Beginner',
    icon: <Users className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    category: 'Collaborate',
  },
  {
    id: 'advanced-techniques',
    title: 'Advanced Design Techniques',
    description: 'Explore advanced CXD techniques including reality planes composition, sensory domains, and presence types.',
    duration: '18 min',
    difficulty: 'Advanced',
    icon: <Zap className="w-6 h-6" />,
    thumbnail: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    category: 'Advanced',
  },
];

const categories = ['All', 'Getting Started', 'Canvas', 'Map', 'Design', 'Plan', 'Collaborate', 'Advanced'];

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Beginner':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'Intermediate':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'Advanced':
      return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    default:
      return 'bg-white/10 text-white/60 border-white/20';
  }
};

export default function TutorialsPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);

  const filteredTutorials = selectedCategory === 'All'
    ? tutorials
    : tutorials.filter(t => t.category === selectedCategory);

  const handleWatchTutorial = (tutorial: Tutorial) => {
    setSelectedTutorial(tutorial);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Interactive Shimmer Grid Background */}
      <ShimmerGrid
        dotSize={1.5}
        dotSpacing={24}
        baseColor="rgba(110, 56, 236, 0.1)"
        hoverColor="rgba(138, 99, 255, 0.5)"
        hoverSize={400}
        smoothing={60}
      />

      {/* Background gradient overlay */}
      <div className="fixed inset-0 hero-gradient pointer-events-none" />

      {/* Decorative orbs */}
      <div className="glow-orb" style={{ top: '10%', right: '10%', opacity: 0.3 }} />
      <div className="glow-orb glow-orb-cyan" style={{ bottom: '20%', left: '5%', opacity: 0.2 }} />

      <DashboardNavbar />

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            <span className="text-gradient-purple">Video Tutorials</span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl">
            Master CXD Canvas with step-by-step video guides designed to help you design transformational experiences.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-violet-500/30 text-violet-300 border border-violet-500/50'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Tutorials Grid - 3 columns */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTutorials.map((tutorial) => (
            <div
              key={tutorial.id}
              className="glass-card rounded-xl overflow-hidden hover:border-white/20 transition-all cursor-pointer group"
              onClick={() => handleWatchTutorial(tutorial)}
            >
              {/* Thumbnail */}
              <div
                className="h-40 relative overflow-hidden"
                style={{
                  background: tutorial.thumbnailUrl ? undefined : tutorial.thumbnail,
                }}
              >
                {tutorial.thumbnailUrl && (
                  <img
                    src={tutorial.thumbnailUrl}
                    alt={tutorial.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                    <PlayCircle className="w-7 h-7 text-white" />
                  </div>
                </div>
                {/* Icon Badge */}
                <div className="absolute top-3 left-3 w-9 h-9 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                  {tutorial.icon}
                </div>
                {/* Duration Badge */}
                <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm flex items-center gap-1 text-white text-xs">
                  <Clock className="w-3 h-3" />
                  {tutorial.duration}
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={`text-[10px] ${getDifficultyColor(tutorial.difficulty)}`}>
                    {tutorial.difficulty}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-white/5 text-white/50 border-white/10">
                    {tutorial.category}
                  </Badge>
                </div>

                <h3 className="font-semibold text-white mb-2 line-clamp-2 group-hover:text-violet-300 transition-colors">
                  {tutorial.title}
                </h3>

                <p className="text-sm text-white/50 line-clamp-2 mb-4">
                  {tutorial.description}
                </p>

                <Button
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white group/btn"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWatchTutorial(tutorial);
                  }}
                >
                  Watch Tutorial
                  <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Coming Soon Section */}
        <div className="glass-card rounded-xl mt-10 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-violet-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">More Tutorials Coming Soon</h3>
          <p className="text-white/50 mb-6 max-w-md mx-auto">
            We're constantly adding new tutorials to help you master CXD Canvas.
            Check back regularly for updates.
          </p>
          <Button className="bg-white/10 hover:bg-white/20 text-white border border-white/10">
            Request a Tutorial Topic
          </Button>
        </div>
      </div>

      {/* Video Player Dialog */}
      <Dialog open={!!selectedTutorial} onOpenChange={() => setSelectedTutorial(null)}>
        <DialogContent className="bg-zinc-900/95 border-white/10 text-white max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold pr-8">
                {selectedTutorial?.title}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {selectedTutorial && (
                <>
                  <Badge variant="outline" className={`text-xs ${getDifficultyColor(selectedTutorial.difficulty)}`}>
                    {selectedTutorial.difficulty}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-white/5 text-white/50 border-white/10">
                    {selectedTutorial.category}
                  </Badge>
                  <span className="text-xs text-white/40 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedTutorial.duration}
                  </span>
                </>
              )}
            </div>
          </DialogHeader>

          {/* Video Container - 16:9 aspect ratio */}
          <div className="relative w-full aspect-video bg-black mt-4">
            {selectedTutorial?.videoUrl ? (
              <iframe
                src={selectedTutorial.videoUrl}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-violet-900/50 to-purple-900/50">
                <PlayCircle className="w-16 h-16 text-white/30 mb-4" />
                <p className="text-white/50 text-center px-4">
                  Video coming soon
                </p>
                <p className="text-white/30 text-sm mt-2 text-center px-4 max-w-md">
                  To add a video, edit the tutorial's videoUrl property in tutorials/page.tsx
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="p-4 border-t border-white/10">
            <p className="text-white/60 text-sm">
              {selectedTutorial?.description}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/*
=== HOW TO ADD VIDEOS AND THUMBNAILS ===

1. VIDEO URLS:
   - For YouTube videos:
     videoUrl: 'https://www.youtube.com/embed/VIDEO_ID'
     (Replace VIDEO_ID with the actual YouTube video ID)

   - For Vimeo videos:
     videoUrl: 'https://player.vimeo.com/video/VIDEO_ID'

   - For self-hosted videos (.mp4):
     Place your video in /public/videos/ and use:
     videoUrl: '/videos/your-video.mp4'
     Note: For self-hosted, you'd need to change the iframe to a video element

2. THUMBNAIL IMAGES:
   - Place your thumbnail images in: /public/images/tutorials/
   - Reference them as: thumbnailUrl: '/images/tutorials/your-image.jpg'
   - Recommended size: 800x450px (16:9 aspect ratio)
   - Supported formats: .jpg, .png, .webp

3. EXAMPLE:
   {
     id: 'getting-started',
     title: 'Getting Started with CXD Canvas',
     ...
     videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
     thumbnailUrl: '/images/tutorials/getting-started.jpg',
   }
*/
