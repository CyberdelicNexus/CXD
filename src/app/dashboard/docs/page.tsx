'use client';

import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import DashboardNavbar from '@/components/dashboard-navbar';
import { ShimmerGrid } from '@/components/ui/shimmer-grid';
import {
  ChevronRight,
  BookOpen,
  LayoutDashboard,
  Compass,
  Layout,
  Layers,
  ClipboardList,
  Users,
  Share2
} from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

const docSections: DocSection[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    icon: <BookOpen className="w-4 h-4" />,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Welcome to CXD Canvas</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            The Cyberdelic Experience Design Canvas is a comprehensive spatial tool for designing transformational experiences.
            It helps you hold complex experiential variables, translate intention into designed states, and communicate
            experience logic to collaborators.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">What is CXD?</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            CXD is a methodology and framework for designing experiences that produce specific states and integrate into lasting traits.
            It combines technology, story, and human psychology into a coherent design system for experience creators.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Core Principles</h2>
          <ul className="space-y-3 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Schema First, Expression Second</strong> — The CXD structure provides a consistent framework. Creative freedom lives within it.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">States Lead to Traits</strong> — Every design choice should trace forward to lasting integration and transformation.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Quantification Without Reductionism</strong> — Sliders and values reveal emphasis and balance, not absolute truth.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Guidance Without Authority</strong> — The system asks better questions; it does not make decisions for you.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Design Is Navigation</strong> — Users steer systems and shape experiences, they do not control outcomes.</span>
            </li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Dashboard</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            The Dashboard is your home base in CXD Canvas. It provides an overview of all your experience design projects
            and quick access to create new ones.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Your Experience Maps</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            All your projects are displayed as visual cards with cover images. Each card shows:
          </p>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span>Project name and last modified date</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span>Owner or Collaborator badge indicating your role</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span>Quick actions: add cover image, invite collaborators, rename, or delete</span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Statistics & Quick Actions</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            The sidebar provides statistics about your projects and quick access to support, bug reporting,
            documentation, and video tutorials.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Creating a New Project</h2>
          <p className="text-white/60 leading-relaxed">
            Click "Create New Map" to start a new experience design. You'll be prompted to name your project,
            then taken directly to the Canvas to begin designing.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'framing',
    title: 'Framing',
    icon: <Compass className="w-4 h-4" />,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Framing</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            The Framing panel is where you define the foundational elements of your experience design.
            It establishes the context, intention, and audience before you begin detailed mapping.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Framing Elements</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h3 className="font-semibold mb-2 text-white">Experience Intention</h3>
              <p className="text-sm text-white/60">
                Define your core message and the transformation you want participants to experience.
                What should they feel, understand, or become?
              </p>
            </div>

            <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <h3 className="font-semibold mb-2 text-white">Target Audience</h3>
              <p className="text-sm text-white/60">
                Describe who this experience is designed for. Consider their background, expectations,
                and what they're bringing to the experience.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h3 className="font-semibold mb-2 text-white">Context & Setting</h3>
              <p className="text-sm text-white/60">
                Establish the world, story, and environment where the experience takes place.
                This includes the narrative framing and user's role within it.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <h3 className="font-semibold mb-2 text-white">Success Criteria</h3>
              <p className="text-sm text-white/60">
                Define what success looks like. How will you know the experience achieved its intention?
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Tips</h2>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span>Start with the transformation you want to create, then work backwards</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span>Be specific about your audience — generic experiences create generic results</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span>Return to framing whenever you feel lost in the details</span>
            </li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'canvas',
    title: 'Canvas',
    icon: <Layout className="w-4 h-4" />,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Canvas</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            The Canvas is your infinite spatial workspace where you design, visualize, and connect
            all elements of your experience. It's designed for creative exploration and systemic thinking.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Navigation</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-mono text-violet-300">⌘</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Pan & Zoom</h3>
                <p className="text-xs text-white/50">Click and drag to pan. Scroll or pinch to zoom in and out.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-mono text-cyan-300">+</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Add Elements</h3>
                <p className="text-xs text-white/50">Use the toolbar to add elements, containers, connectors, and more.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-mono text-purple-300">M</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Minimap</h3>
                <p className="text-xs text-white/50">Toggle the minimap to see your position on the canvas and navigate quickly.</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Canvas Tools</h2>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Elements</strong> — Create blocks for different aspects of your experience</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Connectors</strong> — Draw relationships and flows between elements</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Containers</strong> — Group related elements together</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Text & Images</strong> — Add annotations and visual references</span>
            </li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'map',
    title: 'Map',
    icon: <Layers className="w-4 h-4" />,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Hypercube Map</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            The Hypercube Map is a 3D visualization that shows your experience design across multiple dimensions simultaneously.
            It helps you understand the relationships and balance between different aspects of your design.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">What It Shows</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            The Hypercube represents your experience design as a multidimensional space:
          </p>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span>Each axis represents a different dimension (Reality Planes, Sensory Domains, Presence Types, etc.)</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span>The shape and color reveal balance and emphasis across dimensions</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span>Rotate and explore your design from different perspectives</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span>Hexagonal faces show individual dimension details on hover</span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">CXD Dimensions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h3 className="font-semibold text-sm text-white mb-1">Reality Planes</h3>
              <p className="text-xs text-white/50">PR, AR, VR, MR, GR, BR, CR composition</p>
            </div>
            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <h3 className="font-semibold text-sm text-white mb-1">Sensory Domains</h3>
              <p className="text-xs text-white/50">Visual, Auditory, Olfactory, Gustatory, Haptic</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h3 className="font-semibold text-sm text-white mb-1">Presence Types</h3>
              <p className="text-xs text-white/50">Six types of presence with individual controls</p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <h3 className="font-semibold text-sm text-white mb-1">Experience Flow</h3>
              <p className="text-xs text-white/50">Five stages from Threshold to Return</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Interactions</h2>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Rotate</strong> — Click and drag to rotate the hypercube</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Inspect</strong> — Click faces to see detailed information</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Layer Toggle</strong> — Show/hide different dimensions</span>
            </li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'plan',
    title: 'Plan',
    icon: <ClipboardList className="w-4 h-4" />,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Plan View</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            Plan View transforms your experience design into actionable tasks and timelines.
            It bridges the gap between creative design and practical execution.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Features</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h3 className="font-semibold mb-2 text-white">Task Generation</h3>
              <p className="text-sm text-white/60">
                Convert experience blocks into actionable tasks. Each element on your canvas can become
                a task with deadlines, assignees, and dependencies.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <h3 className="font-semibold mb-2 text-white">Timeline View</h3>
              <p className="text-sm text-white/60">
                See your experience production as a timeline. Organize phases, milestones,
                and dependencies in a linear view.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h3 className="font-semibold mb-2 text-white">Kanban Board</h3>
              <p className="text-sm text-white/60">
                Track progress with a kanban-style board. Move tasks through stages from
                planning to completion.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Pro Feature</h2>
          <p className="text-white/60 leading-relaxed">
            Plan View is available to Pro subscribers. Upgrade to unlock task management,
            timeline planning, and production tracking features.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'collaborate',
    title: 'Collaborate',
    icon: <Users className="w-4 h-4" />,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Collaboration</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            CXD Canvas supports real-time collaboration so you can design experiences together with your team.
            See live cursors, share feedback, and co-create seamlessly.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Inviting Collaborators</h2>
          <ol className="space-y-3 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">1</div>
              <span>Click the "Invite" button on your canvas card in the Dashboard</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">2</div>
              <span>Enter your collaborator's email address</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">3</div>
              <span>They'll receive an invitation to join your canvas</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">4</div>
              <span>Once accepted, they can view and edit the canvas with you</span>
            </li>
          </ol>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Real-Time Features</h2>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Live Cursors</strong> — See where collaborators are working in real-time</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Presence Indicators</strong> — Know who's currently viewing the canvas</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Instant Sync</strong> — Changes appear immediately for all collaborators</span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Permissions</h2>
          <p className="text-white/60 leading-relaxed">
            Canvas owners can invite collaborators and manage permissions. Collaborators have full editing access
            but cannot invite others or delete the canvas.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'sharing',
    title: 'Sharing & Export',
    icon: <Share2 className="w-4 h-4" />,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Sharing & Export</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            Share your experience design with stakeholders, clients, and team members.
            Export for documentation, presentation, or archival purposes.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Live Share Links</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            Generate a live, read-only view of your canvas that updates in real-time:
          </p>
          <ol className="space-y-3 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">1</div>
              <span>Click the Share button in the canvas toolbar</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">2</div>
              <span>Toggle "Enable Live Sharing"</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">3</div>
              <span>Copy the generated link</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">4</div>
              <span>Share with anyone — no login required to view</span>
            </li>
          </ol>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Export Options</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h3 className="font-semibold mb-2 text-white">PDF Export</h3>
              <p className="text-sm text-white/60">
                Export a formatted PDF document with all sections, descriptions, and visualizations.
                Ideal for presentations, documentation, and offline reference.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <h3 className="font-semibold mb-2 text-white">JSON Export</h3>
              <p className="text-sm text-white/60">
                Export the raw data structure for backup, version control, or integration with other tools.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h3 className="font-semibold mb-2 text-white">Image Export</h3>
              <p className="text-sm text-white/60">
                Export your canvas as a high-resolution PNG image for sharing on social media or embedding in documents.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
];

export default function DocsPage() {
  const [selectedSection, setSelectedSection] = useState(docSections[0]);

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
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            <span className="text-gradient-purple">Documentation</span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl">
            Learn how to use CXD Canvas to design transformational experiences
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Sidebar */}
          <div className="col-span-12 md:col-span-3">
            <div className="glass-card rounded-xl ">
              <ScrollArea className="h-[calc(100vh-180px)]">
                <div className="p-4 space-y-1">
                  {docSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setSelectedSection(section)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${selectedSection.id === section.id
                          ? 'bg-violet-500/20 text-white border border-violet-500/30'
                          : 'hover:bg-white/5 text-white/60 hover:text-white border border-transparent'
                        }`}
                    >
                      <span className={selectedSection.id === section.id ? 'text-violet-400' : 'text-white/40'}>
                        {section.icon}
                      </span>
                      <span className="text-sm font-medium">{section.title}</span>
                      {selectedSection.id === section.id && (
                        <ChevronRight className="w-4 h-4 ml-auto text-violet-400" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Content */}
          <div className="col-span-12 md:col-span-9">
            <div className="glass-card rounded-xl">
              <ScrollArea className="h-[calc(100vh-180px)]">
                <div className="p-8">
                  {selectedSection.content}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
