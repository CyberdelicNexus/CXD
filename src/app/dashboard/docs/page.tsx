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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Welcome to the Cyberdelic Design Canvas (CXD)</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            The Cyberdelic Design Canvas is a comprehensive spatial tool for designing meaningful experiences.
            Whether you're creating immersive installations, therapeutic journeys, interactive performances, or any experience
            meant to transform participants, CXD Canvas helps you organize complex variables and communicate your vision.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">What is CXD?</h2>
          <div className="text-white/60 mb-4 leading-relaxed space-y-4">
            <p>
              CXD is a methodology and framework for designing experiences that produce specific <strong className="text-white">states</strong> (temporary conditions)
              and integrate them into lasting <strong className="text-white">traits</strong> (permanent transformations).
            </p>

            <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <p className="text-sm text-white/70">
                <strong className="text-violet-300">Example:</strong> A meditation retreat might design for the <em>state</em> of deep relaxation during sessions,
                with the goal of cultivating the <em>trait</em> of sustained emotional regulation that participants carry into daily life.
              </p>
            </div>
            <p>
              It is a coherent design system to architect meaningful experiences between code and consciousness.
            </p>

            <p>
              It Draws from ontological design, learning experience design, integral psychology, context engineering, hyper-reality design, and humane technology design principles.
            </p>
            <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <p className="text-sm text-white/70">
                <strong className="text-violet-300">it embodies a core cybernetic principle: we shape our realities through feedback loops that, in turn, shape us back.</strong>

              </p>
            </div>
            <p>
              it embodies a core cybernetic principle: we shape our realities through feedback loops that, in turn, shape us back.
            </p>
          </div>

        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">The Four Views</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            CXD Canvas provides four interconnected views for designing your experience:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h3 className="font-semibold text-white mb-2">1. Framing (Wizard)</h3>
              <p className="text-sm text-white/60">Define your experience's intention, audience, and transformation goals through an 11-step guided process.</p>
            </div>
            <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <h3 className="font-semibold text-white mb-2">2. Canvas</h3>
              <p className="text-sm text-white/60">An infinite spatial workspace where you create, connect, and organize all elements of your experience design.</p>
            </div>
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <h3 className="font-semibold text-white mb-2">3. Map (Hypercube)</h3>
              <p className="text-sm text-white/60">A 3D visualization showing your design across 6 dimensions: Reality Planes, Sensory Domains, Presence Types, States, Traits, and Meaning.</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h3 className="font-semibold text-white mb-2">4. Plan</h3>
              <p className="text-sm text-white/60">Transform your design into actionable tasks with Kanban boards, timelines, calendars, and tables.</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Core Principles</h2>
          <ul className="space-y-4 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">1</div>
              <div>
                <strong className="text-white">Schema First, Expression Second</strong>
                <p className="text-sm mt-1">The CXD structure provides a consistent framework. Your creative freedom lives within this structure, ensuring nothing important is overlooked.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">2</div>
              <div>
                <strong className="text-white">States Lead to Traits</strong>
                <p className="text-sm mt-1">Every design choice should trace forward to lasting integration and transformation. Temporary states are stepping stones to permanent growth.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">3</div>
              <div>
                <strong className="text-white">Quantification Without Reductionism</strong>
                <p className="text-sm mt-1">Sliders and values reveal emphasis and balance, not absolute truth. Numbers help you see patterns, not define reality.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">4</div>
              <div>
                <strong className="text-white">Guidance Without Authority</strong>
                <p className="text-sm mt-1">The system asks better questions; it does not make decisions for you. You remain the author of your experience.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">5</div>
              <div>
                <strong className="text-white">Design Is Navigation</strong>
                <p className="text-sm mt-1">Users steer systems and shape experiences—they do not control outcomes. Design creates conditions for transformation, not guarantees.</p>
              </div>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Getting Started</h2>
          <ol className="space-y-3 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 text-xs text-cyan-300">1</div>
              <span><strong className="text-white">Create a new project</strong> from your Dashboard by clicking "Create New Map"</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 text-xs text-cyan-300">2</div>
              <span><strong className="text-white">Complete the Framing wizard</strong> to establish your experience's foundation across 11 guided steps</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 text-xs text-cyan-300">3</div>
              <span><strong className="text-white">Build on the Canvas</strong> using cards, shapes, containers, and connections to map your experience</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 text-xs text-cyan-300">4</div>
              <span><strong className="text-white">Explore the Hypercube Map</strong> to see your design across all 6 dimensions and identify gaps</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 text-xs text-cyan-300">5</div>
              <span><strong className="text-white">Use Plan view</strong> to convert your design into actionable tasks and track execution</span>
            </li>
          </ol>
        </div>
      </div>
    )
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    content: (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Dashboard</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            The Dashboard is your home base in CXD Canvas. Here you can view all your experience design projects,
            create new ones, manage your profile, and access learning resources.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Your Profile Header</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            At the top of your dashboard, you'll see your profile section with:
          </p>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Cover Image</strong> — Click the camera icon to upload a custom cover image. You can drag to reposition it.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Profile Picture</strong> — Click your avatar to upload a profile photo.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Plan Badge</strong> — Shows your current subscription (Free, Pro, Lifetime, or Beta Tester).</span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Your Experience Maps</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            All your projects are displayed as visual cards in a grid. Each card shows:
          </p>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="font-semibold text-white mb-2">Project Card Information</h3>
              <ul className="space-y-2 text-sm text-white/60">
                <li>• <strong className="text-white">Cover image</strong> — Visual thumbnail (or gradient if none set)</li>
                <li>• <strong className="text-white">Project name</strong> — Click the card to open the project</li>
                <li>• <strong className="text-white">Last modified date</strong> — Shows when the project was last updated</li>
                <li>• <strong className="text-white">Role badge</strong> — "Owner" (amber crown) or "Collaborator" (cyan users icon)</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="font-semibold text-white mb-2">Card Action Buttons (Bottom of Each Card)</h3>
              <ul className="space-y-2 text-sm text-white/60">
                <li>• <strong className="text-white">Image icon</strong> — Add or change the cover image (upload file or paste URL)</li>
                <li>• <strong className="text-white">User+ icon</strong> — Invite collaborators (Pro feature, owner only)</li>
                <li>• <strong className="text-white">Pencil icon</strong> — Rename the project</li>
                <li>• <strong className="text-white">Trash icon</strong> — Delete the project (owner only, cannot be undone)</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Creating a New Project</h2>
          <ol className="space-y-3 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 text-xs text-cyan-300">1</div>
              <span>Click the <strong className="text-white">"Create New Map"</strong> button at the top of your project grid</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 text-xs text-cyan-300">2</div>
              <span>Enter a name for your experience design project in the dialog that appears</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 text-xs text-cyan-300">3</div>
              <span>Click <strong className="text-white">"Create"</strong> or press Enter</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 text-xs text-cyan-300">4</div>
              <span>You'll be taken to the Framing wizard to begin designing your experience</span>
            </li>
          </ol>
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 mt-4">
            <p className="text-sm text-white/70">
              <strong className="text-amber-300">Free Plan Limit:</strong> Free accounts can create 1 project. Upgrade to Pro for unlimited projects.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Statistics Sidebar</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            The right sidebar displays four statistics about your projects:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h3 className="font-semibold text-sm text-white">Total Maps</h3>
              <p className="text-xs text-white/50">Number of projects you own or collaborate on</p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <h3 className="font-semibold text-sm text-white">Active</h3>
              <p className="text-xs text-white/50">Projects modified in the last 7 days</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h3 className="font-semibold text-sm text-white">This Month</h3>
              <p className="text-xs text-white/50">Projects created in the current month</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <h3 className="font-semibold text-sm text-white">Analytics</h3>
              <p className="text-xs text-white/50">Coming soon</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Quick Actions</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            Below the statistics, you'll find quick action buttons:
          </p>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Support</strong> — Contact the team for help</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Bug Report</strong> — Report any issues you encounter</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Docs</strong> — Access this documentation</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Tutorials</strong> — Watch video tutorials on using CXD Canvas</span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Navigation Bar</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            The top navigation bar provides access to:
          </p>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Dashboard</strong> — Return to your project list</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Tutorials</strong> — Access video learning content</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Documentation</strong> — Read the full documentation</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Bell icon</strong> — View notifications (invitations, updates, system messages)</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Help menu</strong> — Access support and bug reporting</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">User menu</strong> — Profile settings and sign out</span>
            </li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'framing',
    title: 'Framing',
    icon: <Compass className="w-4 h-4" />,
    content: (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Framing</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            The Framing wizard guides you through 11 steps to establish the foundation of your experience design.
            It's organized into 6 cognitive phases: Intent, Objectives, Audience, Meaning, Structure, and Transformation.
          </p>
          <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <p className="text-sm text-white/70">
              <strong className="text-violet-300">When to use:</strong> Complete the wizard when creating a new project. You can return anytime by clicking "Framing" in the navbar.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">The 11 Steps Overview</h2>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h3 className="font-semibold text-white text-sm">Phase 1: Intent</h3>
              <p className="text-xs text-white/50 mt-1"><strong>Step 1: Intention Core</strong> — Name your project, define the main concept, and craft your core message</p>
            </div>
            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <h3 className="font-semibold text-white text-sm">Phase 2: Objectives</h3>
              <p className="text-xs text-white/50 mt-1"><strong>Step 2: Desired Change</strong> — Define what insights, feelings, states, and knowledge participants should gain</p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <h3 className="font-semibold text-white text-sm">Phase 3: Audience</h3>
              <p className="text-xs text-white/50 mt-1"><strong>Step 3: Human Context</strong> — Describe audience needs, desires, and their role in the experience</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h3 className="font-semibold text-white text-sm">Phase 4: Meaning</h3>
              <p className="text-xs text-white/50 mt-1"><strong>Steps 4-6: World, Story, Magic</strong> — Build the narrative container: environment, journey, and transformation mechanism</p>
            </div>
            <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
              <h3 className="font-semibold text-white text-sm">Phase 5: Structure</h3>
              <p className="text-xs text-white/50 mt-1"><strong>Steps 7-9: Reality Planes, Sensory Domains, Presence Types</strong> — Configure the technical and sensory scaffolding</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <h3 className="font-semibold text-white text-sm">Phase 6: Transformation</h3>
              <p className="text-xs text-white/50 mt-1"><strong>Steps 10-11: State Mapping, Trait Mapping</strong> — Connect temporary states to lasting traits</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Step-by-Step Guide</h2>

          <div className="space-y-6">
            <div className="border-l-2 border-violet-500/50 pl-4">
              <h3 className="font-semibold text-white mb-2">Step 1: Intention Core</h3>
              <p className="text-sm text-white/60 mb-2">Define the heart of your experience:</p>
              <ul className="text-sm text-white/50 space-y-1">
                <li>• <strong className="text-white/70">Project Name</strong> — A memorable name for your experience</li>
                <li>• <strong className="text-white/70">Main Concept</strong> — The big idea driving the experience</li>
                <li>• <strong className="text-white/70">Core Message</strong> — The essential message participants receive (becomes your canvas center)</li>
              </ul>
            </div>

            <div className="border-l-2 border-indigo-500/50 pl-4">
              <h3 className="font-semibold text-white mb-2">Step 2: Desired Change</h3>
              <p className="text-sm text-white/60 mb-2">Define the transformation you want to create across 4 dimensions:</p>
              <ul className="text-sm text-white/50 space-y-1">
                <li>• <strong className="text-white/70">Insights</strong> — What should participants understand?</li>
                <li>• <strong className="text-white/70">Feelings</strong> — What emotional responses should be evoked?</li>
                <li>• <strong className="text-white/70">States</strong> — What mental/consciousness states should be induced?</li>
                <li>• <strong className="text-white/70">Knowledge</strong> — What information and skills should be imparted?</li>
              </ul>
            </div>

            <div className="border-l-2 border-cyan-500/50 pl-4">
              <h3 className="font-semibold text-white mb-2">Step 3: Human Context</h3>
              <p className="text-sm text-white/60 mb-2">Understand your participants:</p>
              <ul className="text-sm text-white/50 space-y-1">
                <li>• <strong className="text-white/70">Audience Needs</strong> — Unmet needs, pain points, aspirations</li>
                <li>• <strong className="text-white/70">Audience Desires</strong> — Motivations driving participation</li>
                <li>• <strong className="text-white/70">User Role</strong> — Are they Observer, Protagonist, or Co-Creator?</li>
              </ul>
            </div>

            <div className="border-l-2 border-purple-500/50 pl-4">
              <h3 className="font-semibold text-white mb-2">Steps 4-6: World, Story, Magic</h3>
              <p className="text-sm text-white/60 mb-2">Build the meaning architecture:</p>
              <ul className="text-sm text-white/50 space-y-1">
                <li>• <strong className="text-white/70">World (Step 4)</strong> — The environment/setting participants inhabit</li>
                <li>• <strong className="text-white/70">Story (Step 5)</strong> — The narrative arc and journey participants take</li>
                <li>• <strong className="text-white/70">Magic (Step 6)</strong> — The technology/practice enabling transformation</li>
              </ul>
            </div>

            <div className="border-l-2 border-pink-500/50 pl-4">
              <h3 className="font-semibold text-white mb-2">Step 7: Reality Planes</h3>
              <p className="text-sm text-white/60 mb-2">Configure which planes of reality your experience operates within:</p>
              <ul className="text-sm text-white/50 space-y-1">
                <li>• <strong className="text-white/70">PR (Physical)</strong> — Space, materials, nature, physical props</li>
                <li>• <strong className="text-white/70">VR (Virtual)</strong> — Headset-based immersive worlds</li>
                <li>• <strong className="text-white/70">AR (Augmented)</strong> — Mobile/headset overlays</li>
                <li>• <strong className="text-white/70">MR (Mixed)</strong> — Holographic projection, depth-sensing</li>
                <li>• <strong className="text-white/70">GR (Generative)</strong> — AI, procedural/algorithmic content</li>
                <li>• <strong className="text-white/70">BR (Biological)</strong> — Biometric feedback, neuro-interfaces</li>
                <li>• <strong className="text-white/70">CR (Cognitive)</strong> — Imagination, emotions, dreams</li>
              </ul>
              <p className="text-xs text-white/40 mt-2">Toggle planes on/off, drag to reorder priority, and describe interface modality for each.</p>
            </div>

            <div className="border-l-2 border-rose-500/50 pl-4">
              <h3 className="font-semibold text-white mb-2">Step 8: Sensory Domains</h3>
              <p className="text-sm text-white/60 mb-2">Set intensity levels (0-100%) for each sensory channel:</p>
              <ul className="text-sm text-white/50 space-y-1">
                <li>• <strong className="text-white/70">Visual</strong> — Sight and visual perception</li>
                <li>• <strong className="text-white/70">Auditory</strong> — Sound and acoustic perception</li>
                <li>• <strong className="text-white/70">Olfactory</strong> — Smell and scent</li>
                <li>• <strong className="text-white/70">Gustatory</strong> — Taste perception</li>
                <li>• <strong className="text-white/70">Haptic</strong> — Touch and tactile feedback</li>
              </ul>
            </div>

            <div className="border-l-2 border-emerald-500/50 pl-4">
              <h3 className="font-semibold text-white mb-2">Step 9: Presence Types</h3>
              <p className="text-sm text-white/60 mb-2">Set intensity levels for 6 types of presence:</p>
              <ul className="text-sm text-white/50 space-y-1">
                <li>• <strong className="text-white/70">Mental</strong> — Cognitive focus, lucidity, awareness</li>
                <li>• <strong className="text-white/70">Emotional</strong> — Affective engagement, empathy, awe</li>
                <li>• <strong className="text-white/70">Social</strong> — Connection with others, collective flow</li>
                <li>• <strong className="text-white/70">Embodied</strong> — Physical sensation, movement, grounding</li>
                <li>• <strong className="text-white/70">Environmental</strong> — Relationship with surroundings</li>
                <li>• <strong className="text-white/70">Active</strong> — Dynamic participation, agency, play</li>
              </ul>
            </div>

            <div className="border-l-2 border-amber-500/50 pl-4">
              <h3 className="font-semibold text-white mb-2">Steps 10-11: State & Trait Mapping</h3>
              <p className="text-sm text-white/60 mb-2">Connect temporary states to lasting traits across 4 quadrants:</p>
              <ul className="text-sm text-white/50 space-y-1">
                <li>• <strong className="text-white/70">Cognitive</strong> — Mental patterns, thought patterns, perspectives</li>
                <li>• <strong className="text-white/70">Emotional</strong> — Feeling states and emotional capacities</li>
                <li>• <strong className="text-white/70">Somatic</strong> — Body states, sensations, embodied habits</li>
                <li>• <strong className="text-white/70">Relational</strong> — Connection with self, others, world</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Navigation Tips</h2>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Progress bar</strong> at the top shows your completion percentage</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Step navigation</strong> at the bottom lets you jump to any step by clicking its icon</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">"Skip for now"</strong> lets you move forward without completing a step</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span>On the final step, click <strong className="text-white">"Complete & View Canvas"</strong> to finish and start building</span>
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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Canvas</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            The Canvas is your infinite spatial workspace where you design, visualize, and connect
            all elements of your experience. It supports freeform cards, shapes, images, boards, containers, and more.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Navigation Controls</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm text-violet-300">Pan</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Pan the Canvas</h3>
                <p className="text-xs text-white/50">Click and drag on empty canvas space to pan around. Works with mouse or touch.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm text-cyan-300">Zoom</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Zoom In/Out</h3>
                <p className="text-xs text-white/50">Scroll wheel to zoom (zooms toward cursor). Use +/- buttons in the left toolbar, or pinch on touch devices.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm text-purple-300">Fit</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Fit All / Reset View</h3>
                <p className="text-xs text-white/50">"Fit All" zooms to show all elements. "Reset View" returns to the origin point.</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Element Types (Toolbar)</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            The center toolbar lets you create 8 types of elements. Click a tool, then click on the canvas to place it.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h3 className="font-semibold text-sm text-white">Freeform Card (C)</h3>
              <p className="text-xs text-white/50">Post-it style cards for notes. Can be marked as tasks with subtasks.</p>
            </div>
            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <h3 className="font-semibold text-sm text-white">Text (T)</h3>
              <p className="text-xs text-white/50">Rich text elements with gradient text support and font selection.</p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <h3 className="font-semibold text-sm text-white">Shape (F)</h3>
              <p className="text-xs text-white/50">6 shapes: Rectangle, Circle, Diamond, Triangle, Hexagon, Star. Customizable colors.</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h3 className="font-semibold text-sm text-white">Image (I)</h3>
              <p className="text-xs text-white/50">Upload images or drag & drop. Supports crop, flip, and rotation.</p>
            </div>
            <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
              <h3 className="font-semibold text-sm text-white">Container (O)</h3>
              <p className="text-xs text-white/50">Group elements together. Children move with parent. Auto-expands to fit content.</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <h3 className="font-semibold text-sm text-white">Line (L)</h3>
              <p className="text-xs text-white/50">Connect elements with lines. Drag handles to adjust start/end points and bends.</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <h3 className="font-semibold text-sm text-white">Link (E)</h3>
              <p className="text-xs text-white/50">3 modes: Bookmark (URL preview), Embed (content viewer), or File (upload).</p>
            </div>
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <h3 className="font-semibold text-sm text-white">Board (B)</h3>
              <p className="text-xs text-white/50">Nested canvas boards. Double-click to enter. Navigate via breadcrumb path.</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Keyboard Shortcuts</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-white text-sm mb-2">Element Creation</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">T</kbd> Text</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">C</kbd> Card</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">B</kbd> Board</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">L</kbd> Line</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">I</kbd> Image</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">O</kbd> Container</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">E</kbd> Link</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">F</kbd> Shape</div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm mb-2">Edit Operations</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">Ctrl+Z</kbd> Undo</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">Ctrl+Shift+Z</kbd> Redo</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">Ctrl+C</kbd> Copy</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">Ctrl+V</kbd> Paste</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">Ctrl+D</kbd> Duplicate</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">Delete</kbd> Delete</div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm mb-2">Navigation</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">Arrow keys</kbd> Move 1px</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">Shift+Arrows</kbd> Move 10px</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">Esc</kbd> Deselect</div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm mb-2">Special Actions</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">Alt+Drag</kbd> Duplicate while dragging</div>
                <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">Shift+Drag</kbd> Marquee select multiple</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Selection & Editing</h2>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Single click</strong> selects an element (shows cyan selection ring)</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Shift+Click</strong> adds/removes from multi-selection</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Double-click</strong> to edit content (text, cards, links)</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Drag</strong> to move selected elements</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Right-click</strong> or <strong className="text-white">Shift+drag on background</strong> for marquee selection</span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Task Cards</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            Freeform cards can be converted to tasks that appear in Plan view:
          </p>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Markdown checkboxes</strong> — Type <code className="bg-white/10 px-1 rounded">- [ ]</code> to create subtasks</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Mark as Task button</strong> — Click the checkmark in the card toolbar</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Hypercube tags</strong> — Tag cards with any of the 6 dimensions</span>
            </li>
          </ul>
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 mt-4">
            <p className="text-sm text-white/70">
              <strong className="text-purple-300">Visual indicator:</strong> Task cards show a small purple dot in the top-right corner.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Hypercube Tagging</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            Tag canvas elements with the 6 Hypercube dimensions to organize them by experiential domain:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded bg-violet-500/10 border border-violet-500/20 text-white/70">Reality Planes</div>
            <div className="p-2 rounded bg-pink-500/10 border border-pink-500/20 text-white/70">Sensory Domains</div>
            <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/20 text-white/70">Presence Types</div>
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-white/70">State Mapping</div>
            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-white/70">Trait Mapping</div>
            <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-white/70">Meaning Architecture</div>
          </div>
          <p className="text-sm text-white/50 mt-3">Tagged elements appear in the Hypercube Map view for visualization and analysis.</p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Left Toolbar (Navigation)</h2>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Zoom In/Out</strong> — Adjust zoom level</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Zoom percentage</strong> — Shows current zoom level</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Reset View</strong> — Return to origin (0,0)</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Fit All</strong> — Zoom to show all elements</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Undo/Redo</strong> — Reverse or replay actions</span>
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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Hypercube Map</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            The Hypercube Map is a 3D visualization that shows your experience design across 6 dimensions simultaneously.
            It helps you understand balance, identify gaps, and see relationships between different aspects of your design.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">The 6 Dimensions (Faces)</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            Each face of the hypercube represents a different dimension of experience design. They're color-coded for easy identification:
          </p>
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h3 className="font-semibold text-white mb-1">Reality Planes <span className="text-violet-400">(Purple)</span></h3>
              <p className="text-sm text-white/60">The technical substrate — which realities does your experience operate in? PR, VR, AR, MR, GR, BR, CR.</p>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <h3 className="font-semibold text-white mb-1">Sensory Domains <span className="text-amber-400">(Amber)</span></h3>
              <p className="text-sm text-white/60">Embodied input — how are the senses engaged? Visual, Auditory, Olfactory, Gustatory, Haptic.</p>
            </div>
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <h3 className="font-semibold text-white mb-1">Presence Types <span className="text-cyan-400">(Cyan)</span></h3>
              <p className="text-sm text-white/60">Quality of being — what kinds of presence does the experience cultivate? Mental, Emotional, Social, Embodied, Environmental, Active.</p>
            </div>
            <div className="p-4 rounded-lg bg-teal-500/10 border border-teal-500/20">
              <h3 className="font-semibold text-white mb-1">State Mapping <span className="text-teal-400">(Teal)</span></h3>
              <p className="text-sm text-white/60">Momentary conditions — what temporary states will participants experience? Cognitive, Emotional, Somatic, Relational.</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h3 className="font-semibold text-white mb-1">Trait Mapping <span className="text-purple-400">(Violet)</span></h3>
              <p className="text-sm text-white/60">Lasting structure — what enduring traits should be cultivated? The transformation that persists after the experience ends.</p>
            </div>
            <div className="p-4 rounded-lg bg-pink-500/10 border border-pink-500/20">
              <h3 className="font-semibold text-white mb-1">Meaning Architecture <span className="text-pink-400">(Magenta)</span></h3>
              <p className="text-sm text-white/60">Story and context — World (environment), Story (narrative arc), Magic (transformation mechanism).</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Two Interaction Modes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h3 className="font-semibold text-white mb-2">Default Mode (Sensemaking)</h3>
              <ul className="text-sm text-white/60 space-y-2">
                <li>• Cube auto-rotates slowly for ambient viewing</li>
                <li>• Click <strong className="text-white">face buttons</strong> at the top to select a dimension</li>
                <li>• Selected face rotates to front</li>
                <li>• Shows tagged elements panel for that dimension</li>
                <li>• Use <strong className="text-white">arrow keys</strong> to navigate between faces</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <h3 className="font-semibold text-white mb-2">Exploration Mode</h3>
              <ul className="text-sm text-white/60 space-y-2">
                <li>• Click "Explore" button to enable</li>
                <li>• <strong className="text-white">Click and drag</strong> to freely rotate the cube</li>
                <li>• <strong className="text-white">Scroll</strong> to zoom in/out (50%-250%)</li>
                <li>• Press <strong className="text-white">Esc</strong> or "Exit" to return to default</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Visual Indicators</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            The hypercube communicates information through visual cues:
          </p>
          <ul className="space-y-3 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <div>
                <strong className="text-white">Face Color (Tint)</strong>
                <p className="text-sm">Each face has a unique color that never changes — purple for Reality Planes, amber for Sensory, etc.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <div>
                <strong className="text-white">Glow Intensity</strong>
                <p className="text-sm">Brighter glow = more developed dimension. Dim = undeveloped. Bright = well-populated.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <div>
                <strong className="text-white">Glow Pattern</strong>
                <ul className="text-sm mt-1 ml-4 space-y-1">
                  <li>• <strong className="text-white/80">Stable</strong> — Coherent, well-developed (steady glow)</li>
                  <li>• <strong className="text-white/80">Pulsing</strong> — Active but incomplete (slow pulse)</li>
                  <li>• <strong className="text-white/80">Fractured</strong> — Overloaded or conflicting (turbulent effect)</li>
                </ul>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <div>
                <strong className="text-white">Element Count Badge</strong>
                <p className="text-sm">Shows how many canvas elements are tagged with each dimension.</p>
              </div>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Working with Tagged Elements</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            When you select a face, you'll see all canvas elements tagged with that dimension:
          </p>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Quick View</strong> — Click the eye icon to preview element content in a modal</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">View on Canvas</strong> — Click the pin icon to navigate to the element on the canvas</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Open Link</strong> — For link elements, click to open the URL in a new tab</span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Keyboard Shortcuts</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">1-6</kbd> Select face</div>
            <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">0</kbd> Select core</div>
            <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">Arrows</kbd> Navigate faces</div>
            <div className="p-2 rounded bg-white/5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded">Esc</kbd> Exit mode</div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">The Core (Center)</h2>
          <p className="text-white/60 leading-relaxed">
            The inner cube represents your experience's <strong className="text-white">Intention Core</strong> — the foundational vision
            established in the Framing wizard. Click the "Core" button or press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">0</kbd> to
            select it. When selected, it glows electric purple.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'plan',
    title: 'Plan',
    icon: <ClipboardList className="w-4 h-4" />,
    content: (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Plan View</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            Plan View transforms your canvas cards into actionable tasks. It provides 4 different views
            to manage your experience production: Kanban, Table, Timeline, and Calendar.
          </p>
          <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <p className="text-sm text-white/70">
              <strong className="text-violet-300">Pro Feature:</strong> Plan View is available to Pro subscribers.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">How Cards Become Tasks</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            Canvas cards automatically appear in Plan View when they meet ANY of these conditions:
          </p>
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="font-semibold text-white mb-2">1. Markdown Checkboxes</h3>
              <p className="text-sm text-white/60 mb-2">Add checkbox syntax in your card content:</p>
              <div className="bg-black/30 p-3 rounded font-mono text-sm text-white/70">
                - [ ] Design wireframes<br />
                - [ ] Build prototype<br />
                - [x] Define requirements
              </div>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="font-semibold text-white mb-2">2. Mark as Task Button</h3>
              <p className="text-sm text-white/60">Select a card on the canvas and click the checkmark icon in the toolbar. A purple dot appears on the card corner.</p>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="font-semibold text-white mb-2">3. Hypercube Tags</h3>
              <p className="text-sm text-white/60">Cards tagged with any of the 6 hypercube dimensions will appear in Plan View.</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">The 4 Views</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <h3 className="font-semibold text-white mb-2">Kanban View</h3>
              <p className="text-sm text-white/60 mb-2">Drag-and-drop task cards across 4 status columns:</p>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-gray-500/20 text-white/70">To Do</span>
                <span className="px-2 py-1 rounded bg-blue-500/20 text-white/70">In Progress</span>
                <span className="px-2 py-1 rounded bg-red-500/20 text-white/70">Blocked</span>
                <span className="px-2 py-1 rounded bg-green-500/20 text-white/70">Done</span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <h3 className="font-semibold text-white mb-2">Table View</h3>
              <p className="text-sm text-white/60">Sortable spreadsheet-style view with columns for Status, Title, Hypercube Faces, Priority, Due Date, and Progress. Click column headers to sort.</p>
            </div>
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <h3 className="font-semibold text-white mb-2">Timeline View (Gantt)</h3>
              <p className="text-sm text-white/60">Gantt-style visualization. Tasks with start/due dates appear as horizontal bars. Drag bars to reschedule. Zoom: Day, Week, or Month.</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h3 className="font-semibold text-white mb-2">Calendar View</h3>
              <p className="text-sm text-white/60">Month, Week, or Day calendar. Tasks appear on their due dates. Double-click a date to zoom in. Drag tasks to reschedule.</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Task Properties</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            Select any task to open the detail panel on the right. You can edit:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded bg-white/5">
              <h4 className="font-semibold text-white text-sm">Status</h4>
              <p className="text-xs text-white/50">To Do, In Progress, Blocked, Done</p>
            </div>
            <div className="p-3 rounded bg-white/5">
              <h4 className="font-semibold text-white text-sm">Priority</h4>
              <p className="text-xs text-white/50">Low, Medium, High, Urgent</p>
            </div>
            <div className="p-3 rounded bg-white/5">
              <h4 className="font-semibold text-white text-sm">Due Date</h4>
              <p className="text-xs text-white/50">When the task should be completed</p>
            </div>
            <div className="p-3 rounded bg-white/5">
              <h4 className="font-semibold text-white text-sm">Start Date</h4>
              <p className="text-xs text-white/50">When work should begin</p>
            </div>
            <div className="p-3 rounded bg-white/5">
              <h4 className="font-semibold text-white text-sm">Assignee</h4>
              <p className="text-xs text-white/50">Who is responsible</p>
            </div>
            <div className="p-3 rounded bg-white/5">
              <h4 className="font-semibold text-white text-sm">Estimated Hours</h4>
              <p className="text-xs text-white/50">Time effort estimate</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Filtering Tasks</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            Click the filter icon to open the filter panel. You can filter by:
          </p>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Task Type</strong> — Markdown tasks, explicitly actionable, or hypercube-tagged</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Status</strong> — Filter by one or more status values</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Priority</strong> — Filter by priority level</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Hypercube Faces</strong> — Filter by dimension tags</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Show Completed</strong> — Toggle to show/hide completed tasks</span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Subtasks & Progress</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            Cards with markdown checkboxes have automatic subtask tracking:
          </p>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span>Each <code className="bg-white/10 px-1 rounded">- [ ]</code> line becomes a subtask</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span>Toggle subtasks complete in the detail panel</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span>Progress bar shows completion percentage</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span>Task auto-completes when all subtasks are checked</span>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Navigation</h2>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">View in Canvas</strong> — Click the arrow button on any task to jump to its location on the canvas. The element will be centered and briefly highlighted.</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Add Task</strong> — Click the + button in the header to create a new task card directly from Plan View.</span>
            </li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'collaborate',
    title: 'Collaborate',
    icon: <Users className="w-4 h-4" />,
    content: (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Collaboration</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            CXD Canvas supports real-time collaboration so you can design experiences together with your team.
            See live cursors, share feedback, and co-create seamlessly.
          </p>
          <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <p className="text-sm text-white/70">
              <strong className="text-violet-300">Pro Feature:</strong> Collaboration requires a Pro subscription. You can invite up to 3 collaborators per project.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Inviting Collaborators</h2>
          <ol className="space-y-3 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">1</div>
              <span>Click the <strong className="text-white">User+ icon</strong> on your project card in the Dashboard</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">2</div>
              <span>The Collaboration Panel opens — enter your collaborator's email address</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">3</div>
              <span>Click <strong className="text-white">Invite</strong> — they'll receive an email invitation</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">4</div>
              <span>They click "Accept Invitation" in the email (expires in 7 days)</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">5</div>
              <span>Once accepted, they appear as a collaborator and can edit the canvas</span>
            </li>
          </ol>
          <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20 mt-4">
            <p className="text-sm text-white/70">
              <strong className="text-cyan-300">Note:</strong> If the invited person already has a CXD account, they'll also receive an in-app notification.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Real-Time Features</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="font-semibold text-white mb-2">Live Cursors</h3>
              <p className="text-sm text-white/60">See where each collaborator's cursor is positioned on the canvas in real-time. Each person has a unique color and their name appears next to their cursor.</p>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="font-semibold text-white mb-2">Presence Indicators</h3>
              <p className="text-sm text-white/60">Collaborator avatars appear in the header. A green dot indicates they're currently online. Click the avatars to open the collaboration panel.</p>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="font-semibold text-white mb-2">Instant Sync</h3>
              <p className="text-sm text-white/60">All changes sync instantly: element creation, editing, moving, deleting, and even Framing wizard updates. Everyone sees the same canvas state.</p>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <h3 className="font-semibold text-white mb-2">Selection Tracking</h3>
              <p className="text-sm text-white/60">See which elements other collaborators have selected. This helps avoid editing conflicts.</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Permission Levels</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/70">Action</th>
                  <th className="text-center py-2 px-3 text-amber-400">Owner</th>
                  <th className="text-center py-2 px-3 text-cyan-400">Collaborator</th>
                </tr>
              </thead>
              <tbody className="text-white/60">
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">View canvas</td>
                  <td className="text-center py-2 px-3">✓</td>
                  <td className="text-center py-2 px-3">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">Edit content</td>
                  <td className="text-center py-2 px-3">✓</td>
                  <td className="text-center py-2 px-3">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">Add/remove elements</td>
                  <td className="text-center py-2 px-3">✓</td>
                  <td className="text-center py-2 px-3">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">Export canvas</td>
                  <td className="text-center py-2 px-3">✓</td>
                  <td className="text-center py-2 px-3">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">Invite collaborators</td>
                  <td className="text-center py-2 px-3">✓</td>
                  <td className="text-center py-2 px-3">—</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">Remove collaborators</td>
                  <td className="text-center py-2 px-3">✓</td>
                  <td className="text-center py-2 px-3">—</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">Change settings</td>
                  <td className="text-center py-2 px-3">✓</td>
                  <td className="text-center py-2 px-3">—</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Delete project</td>
                  <td className="text-center py-2 px-3">✓</td>
                  <td className="text-center py-2 px-3">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Managing Collaborators</h2>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">View team</strong> — Open the collaboration panel to see all team members and their online status</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Revoke invitation</strong> — Cancel pending invitations before they're accepted</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Remove collaborator</strong> — Remove someone's access (owner only)</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Leave project</strong> — Collaborators can remove themselves from a project</span>
            </li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'sharing',
    title: 'Sharing & Export',
    icon: <Share2 className="w-4 h-4" />,
    content: (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gradient-purple">Sharing & Export</h1>
          <p className="text-white/60 mb-4 leading-relaxed">
            Share your experience design with stakeholders, clients, and team members.
            Export your project for documentation, backup, or integration with other tools.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Share Links (Read-Only)</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            Generate a public link that anyone can use to view your project without logging in:
          </p>
          <ol className="space-y-3 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">1</div>
              <span>Open your project and click <strong className="text-white">Share</strong> in the navbar dropdown menu</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">2</div>
              <span>A unique share link is generated and automatically <strong className="text-white">copied to your clipboard</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs text-violet-300">3</div>
              <span>Send the link to anyone — <strong className="text-white">no login required</strong> to view</span>
            </li>
          </ol>
          <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20 mt-4">
            <p className="text-sm text-white/70">
              <strong className="text-cyan-300">Share page features:</strong> Viewers see two modes — a collapsible <strong>Summary</strong> showing
              all CXD data (intention, audience, reality planes, etc.) and a read-only <strong>Canvas</strong> view to explore your design.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Sharing vs. Collaboration</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/70">Feature</th>
                  <th className="text-center py-2 px-3 text-violet-400">Share Link</th>
                  <th className="text-center py-2 px-3 text-cyan-400">Collaboration</th>
                </tr>
              </thead>
              <tbody className="text-white/60">
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">Login required</td>
                  <td className="text-center py-2 px-3">No</td>
                  <td className="text-center py-2 px-3">Yes</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">Can view</td>
                  <td className="text-center py-2 px-3">✓</td>
                  <td className="text-center py-2 px-3">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">Can edit</td>
                  <td className="text-center py-2 px-3">—</td>
                  <td className="text-center py-2 px-3">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">Real-time sync</td>
                  <td className="text-center py-2 px-3">—</td>
                  <td className="text-center py-2 px-3">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 px-3">Live cursors</td>
                  <td className="text-center py-2 px-3">—</td>
                  <td className="text-center py-2 px-3">✓</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Pro required</td>
                  <td className="text-center py-2 px-3">No</td>
                  <td className="text-center py-2 px-3">Yes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Export Options</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <h3 className="font-semibold text-white mb-2">JSON Export ✓ Available</h3>
              <p className="text-sm text-white/60 mb-3">
                Export your complete project as a JSON file. This includes all CXD framework data, canvas elements, edges, and metadata.
              </p>
              <div className="text-sm text-white/50">
                <strong className="text-white/70">How to export:</strong> Click the menu in the navbar → Download → Export JSON
              </div>
              <div className="text-sm text-white/50 mt-2">
                <strong className="text-white/70">Use cases:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Backup your project</li>
                  <li>Version control (commit to git)</li>
                  <li>Import into other tools</li>
                  <li>Data analysis</li>
                </ul>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <h3 className="font-semibold text-white mb-2">PDF Export <span className="text-xs bg-amber-500/30 px-2 py-0.5 rounded ml-2">Coming Soon</span></h3>
              <p className="text-sm text-white/60">
                Export a formatted PDF document with all sections, descriptions, and visualizations.
                Ideal for presentations, documentation, and offline reference.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gray-500/10 border border-gray-500/20">
              <h3 className="font-semibold text-white mb-2">Image Export <span className="text-xs bg-gray-500/30 px-2 py-0.5 rounded ml-2">Coming Soon</span></h3>
              <p className="text-sm text-white/60">
                Export your canvas as a high-resolution PNG image for sharing on social media or embedding in documents.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Notifications</h2>
          <p className="text-white/60 mb-4 leading-relaxed">
            CXD Canvas sends notifications for important events. Click the bell icon in the navbar to view them:
          </p>
          <ul className="space-y-2 text-white/60">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Collaboration invitations</strong> — When someone invites you to their project</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Share link generated</strong> — Confirmation when you create a share link</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">Export complete</strong> — When your export is ready for download</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
              <span><strong className="text-white">System announcements</strong> — New features and updates</span>
            </li>
          </ul>
          <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20 mt-4">
            <p className="text-sm text-white/70">
              <strong className="text-violet-300">Tip:</strong> Notifications can be marked as read individually or all at once.
              They automatically expire after their relevance period (24 hours for saves, 30 days for share links, etc.).
            </p>
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
