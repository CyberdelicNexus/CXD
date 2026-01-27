'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import DashboardNavbar from '@/components/dashboard-navbar';
import { 
  FileText, 
  ChevronRight,
  Sparkles,
  Layout,
  Layers,
  Wand2,
  Share2,
  Settings,
  BookOpen
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
          <h1 className="text-3xl font-bold mb-4 text-gradient">Welcome to CXD Canvas</h1>
          <p className="text-muted-foreground mb-4">
            The Cyberdelic Experience Design Canvas is a comprehensive digital tool for designing transformational experiences.
            It helps you hold complex experiential variables, translate intention into designed states, and communicate 
            experience logic to collaborators.
          </p>
        </div>
        
        <div>
          <h2 className="text-2xl font-semibold mb-3">What is CXD?</h2>
          <p className="text-muted-foreground mb-4">
            CXD is a methodology and framework for designing experiences that produce specific states and integrate into lasting traits.
            It combines technology, story, and human psychology into a coherent design system.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">Core Principles</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li><strong>Schema First, Expression Second</strong> — The CXD structure is fixed. Freedom lives inside it.</li>
            <li><strong>States Lead to Traits</strong> — Every design choice should trace forward to integration.</li>
            <li><strong>Quantification Without Reductionism</strong> — Sliders reveal emphasis, not truth.</li>
            <li><strong>Guidance Without Authority</strong> — The system asks better questions, it does not decide.</li>
            <li><strong>Design Is Navigation</strong> — Users steer systems, they do not control outcomes.</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'wizard',
    title: 'Initiation Wizard',
    icon: <Wand2 className="w-4 h-4" />,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient">Initiation Wizard</h1>
          <p className="text-muted-foreground mb-4">
            The Initiation Wizard guides you through the initial creation of your experience design map.
            It asks structured questions that help you think through each dimension of the experience.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">How It Works</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <h3 className="font-semibold mb-2">Step 1: Project Setup</h3>
              <p className="text-sm text-muted-foreground">
                Give your experience a name and describe its core intention. What transformation are you designing for?
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
              <h3 className="font-semibold mb-2">Step 2: Reality Planes</h3>
              <p className="text-sm text-muted-foreground">
                Define the mix of reality types (Physical, Augmented, Virtual, Mixed, Generative, Biological, Conscious) 
                that make up your experience.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h3 className="font-semibold mb-2">Step 3: Context & Meaning</h3>
              <p className="text-sm text-muted-foreground">
                Establish the world, story, magic system, and user role that frame the experience.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-teal-500/10 border border-teal-500/20">
              <h3 className="font-semibold mb-2">Step 4: States & Traits</h3>
              <p className="text-sm text-muted-foreground">
                Map the intended experiential states and the lasting traits they should integrate into.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">Tips</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>You can skip questions and return to them later</li>
            <li>Your progress is automatically saved</li>
            <li>Use voice input for faster ideation</li>
            <li>The wizard populates the canvas, which you can then refine</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'canvas',
    title: 'Infinite Canvas',
    icon: <Layout className="w-4 h-4" />,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient">Infinite Canvas</h1>
          <p className="text-muted-foreground mb-4">
            The Infinite Canvas is your spatial workspace where all CXD dimensions are visualized and can be edited.
            It preserves the systemic relationships between different aspects of your experience design.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">Navigation</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-mono">⌘</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm">Pan & Zoom</h3>
                <p className="text-xs text-muted-foreground">Click and drag to pan. Scroll or pinch to zoom.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-mono">⇧</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm">Select & Edit</h3>
                <p className="text-xs text-muted-foreground">Click any section to view details. Double-click to enter Focus Mode.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-mono">M</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm">Minimap</h3>
                <p className="text-xs text-muted-foreground">Toggle minimap to see your position on the canvas.</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">Canvas Sections</h2>
          <p className="text-muted-foreground mb-3">
            The canvas is organized into spatial clusters for each CXD dimension:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li><strong>Reality Planes</strong> — PR, AR, VR, MR, GR, BR, CR composition</li>
            <li><strong>Sensory Domains</strong> — Visual, Auditory, Olfactory, Gustatory, Haptic intensity</li>
            <li><strong>Presence Types</strong> — Six types of presence with individual controls</li>
            <li><strong>Experience Flow</strong> — Five stages from Threshold to Return</li>
            <li><strong>State/Trait Mapping</strong> — Four quadrants for states and traits</li>
            <li><strong>Context & Meaning</strong> — World, Story, Magic, User Role</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'hypercube',
    title: 'Hypercube View',
    icon: <Layers className="w-4 h-4" />,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient">Hypercube View</h1>
          <p className="text-muted-foreground mb-4">
            The Hypercube is a 3D visualization that shows your experience design across multiple dimensions simultaneously.
            It helps you understand the relationships and balance between different aspects of your design.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">What It Shows</h2>
          <p className="text-muted-foreground mb-4">
            The Hypercube represents your experience design as a multidimensional space where:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Each axis represents a different dimension of experience (Reality, Sensory, Presence, etc.)</li>
            <li>The shape and color reveal balance and emphasis across dimensions</li>
            <li>You can rotate and explore the design from different perspectives</li>
            <li>Hexagonal faces show individual dimension details</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">Interactions</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <h3 className="font-semibold mb-2">Rotate View</h3>
              <p className="text-sm text-muted-foreground">
                Click and drag to rotate the hypercube and see your design from different angles.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
              <h3 className="font-semibold mb-2">Inspect Faces</h3>
              <p className="text-sm text-muted-foreground">
                Click on any hexagonal face to see detailed information about that dimension.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h3 className="font-semibold mb-2">Compare Layers</h3>
              <p className="text-sm text-muted-foreground">
                Use layer controls to show/hide different dimensions and compare their relationships.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'focus-mode',
    title: 'Focus Mode',
    icon: <Sparkles className="w-4 h-4" />,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient">Focus Mode</h1>
          <p className="text-muted-foreground mb-4">
            Focus Mode allows you to dive deep into any single dimension of your experience design.
            It isolates the section you're working on while maintaining context with the broader design.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">Entering Focus Mode</h2>
          <p className="text-muted-foreground mb-4">
            You can enter Focus Mode in several ways:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Double-click any section on the canvas</li>
            <li>Click a section and press <code className="px-2 py-1 bg-background rounded">F</code></li>
            <li>Use the Focus button in the section's detail panel</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">What You Can Edit</h2>
          <p className="text-muted-foreground mb-4">
            In Focus Mode, you have access to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li><strong>Sliders</strong> — Adjust intensity, emphasis, and mix across dimensions</li>
            <li><strong>Text Fields</strong> — Write detailed descriptions and design intent</li>
            <li><strong>Structured Editors</strong> — Work with states, traits, and flow stages</li>
            <li><strong>Validation</strong> — Real-time feedback on design coherence</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">Exiting Focus Mode</h2>
          <p className="text-muted-foreground">
            Press <code className="px-2 py-1 bg-background rounded">ESC</code> or click the Exit button to return to the canvas.
            Your changes are automatically saved and reflected in the global view.
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
          <h1 className="text-3xl font-bold mb-4 text-gradient">Sharing & Export</h1>
          <p className="text-muted-foreground mb-4">
            Share your experience design with collaborators, stakeholders, and team members.
            Export for documentation, presentation, or integration with other tools.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">Live Share Links</h2>
          <p className="text-muted-foreground mb-4">
            Generate a live, read-only view of your canvas that updates in real-time:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Click the Share button in the canvas toolbar</li>
            <li>Toggle "Enable Live Sharing"</li>
            <li>Copy the generated link</li>
            <li>Share with anyone — no login required</li>
          </ol>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">Export Options</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <h3 className="font-semibold mb-2">PDF Export</h3>
              <p className="text-sm text-muted-foreground">
                Export a formatted PDF document with all sections, descriptions, and visualizations.
                Ideal for presentations and documentation.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
              <h3 className="font-semibold mb-2">JSON Export</h3>
              <p className="text-sm text-muted-foreground">
                Export the raw data structure for integration with other tools, version control, or programmatic access.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'settings',
    title: 'Settings & Preferences',
    icon: <Settings className="w-4 h-4" />,
    content: (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient">Settings & Preferences</h1>
          <p className="text-muted-foreground mb-4">
            Customize your CXD Canvas experience to match your workflow and preferences.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">Canvas Preferences</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li><strong>Grid Display</strong> — Toggle canvas grid visibility</li>
            <li><strong>Auto-Save Interval</strong> — Set how frequently changes are saved</li>
            <li><strong>Zoom Sensitivity</strong> — Adjust zoom speed for your preference</li>
            <li><strong>Theme</strong> — Choose between dark, light, or system theme</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3">Keyboard Shortcuts</h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
              <span className="text-sm">Pan Canvas</span>
              <code className="px-2 py-1 bg-muted rounded text-xs">Space + Drag</code>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
              <span className="text-sm">Enter Focus Mode</span>
              <code className="px-2 py-1 bg-muted rounded text-xs">F</code>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
              <span className="text-sm">Exit Focus Mode</span>
              <code className="px-2 py-1 bg-muted rounded text-xs">ESC</code>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
              <span className="text-sm">Toggle Minimap</span>
              <code className="px-2 py-1 bg-muted rounded text-xs">M</code>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
              <span className="text-sm">Save</span>
              <code className="px-2 py-1 bg-muted rounded text-xs">⌘ + S</code>
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
    <div className="min-h-screen bg-gradient-radial">
      <DashboardNavbar />
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">
            <span className="text-gradient">Documentation</span>
          </h1>
          <p className="text-muted-foreground">
            Learn how to use the CXD Canvas to design transformational experiences
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar - 20% */}
          <div className="col-span-12 md:col-span-3">
            <Card className="gradient-border bg-card/50 backdrop-blur sticky top-20">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="p-4 space-y-1">
                  {docSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setSelectedSection(section)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                        selectedSection.id === section.id
                          ? 'bg-primary/20 text-foreground'
                          : 'hover:bg-background/50 text-muted-foreground'
                      }`}
                    >
                      {section.icon}
                      <span className="text-sm font-medium">{section.title}</span>
                      {selectedSection.id === section.id && (
                        <ChevronRight className="w-4 h-4 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* Content - 80% */}
          <div className="col-span-12 md:col-span-9">
            <Card className="gradient-border bg-card/50 backdrop-blur">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="p-8">
                  {selectedSection.content}
                </div>
              </ScrollArea>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
