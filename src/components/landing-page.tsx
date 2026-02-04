'use client';

import { useState } from 'react';
import { ShimmerGrid } from '@/components/ui/shimmer-grid';
import { TextShimmer } from '@/components/ui/text-shimmer';
import {
  Layout,
  Target,
  Brain,
  Layers,
  ArrowRight,
  Check,
  Infinity,
  Palette,
  GitBranch,
  Sparkles,
  Play,
  Loader2,
  Menu,
  X
} from 'lucide-react';
import Image from 'next/image';

export function LandingPage() {
  const [isLoading, setIsLoading] = useState<'pro' | 'lifetime' | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleCheckout = async (planType: 'pro' | 'lifetime') => {
    setIsLoading(planType);

    try {
      const priceId = planType === 'pro'
        ? process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
        : process.env.NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID;

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, planType }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (response.status === 401) {
        // User not logged in, redirect to sign up
        window.location.href = '/sign-up';
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
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

      {/* Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl">
        <div className="nav-glass px-2 py-2 flex items-center justify-between">
          {/* Left side: Logo + Navigation Links */}
          <div className="flex items-center">
            <a href="/" className="flex items-center px-3 py-2">
              <Image
                src="/images/hypercube-logo.webp"
                alt="CXD"
                width={36}
                height={36}
                className="object-contain"
              />
            </a>

            {/* Desktop Navigation - moved to left */}
            <div className="hidden md:flex items-center ml-2">
              <a href="#features" className="nav-link-btn text-violet-300 hover:text-violet-200">Features</a>
              <a href="#demo" className="nav-link-btn text-violet-300 hover:text-violet-200">Demo</a>
              <a href="#pricing" className="nav-link-btn text-violet-300 hover:text-violet-200">Pricing</a>
            </div>
          </div>

          {/* Right side: Auth buttons */}
          <div className="hidden md:flex items-center gap-2">
            <a href="/sign-in" className="nav-link-btn text-violet-300 hover:text-violet-200">Log in</a>
            <a href="/sign-up">
              <button className="btn-primary-glow text-sm px-5 py-2">
                Get Started
              </button>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-white/60 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-2 nav-glass rounded-2xl p-4 space-y-2">
            <a href="#features" className="block px-4 py-3 rounded-lg hover:bg-violet-500/10 text-violet-300 hover:text-violet-200 transition-colors">
              Features
            </a>
            <a href="#demo" className="block px-4 py-3 rounded-lg hover:bg-violet-500/10 text-violet-300 hover:text-violet-200 transition-colors">
              Demo
            </a>
            <a href="#pricing" className="block px-4 py-3 rounded-lg hover:bg-violet-500/10 text-violet-300 hover:text-violet-200 transition-colors">
              Pricing
            </a>
            <div className="border-t border-white/10 pt-2 mt-2 space-y-2">
              <a href="/sign-in" className="block px-4 py-3 rounded-lg hover:bg-violet-500/10 text-violet-300 hover:text-violet-200 transition-colors">
                Log in
              </a>
              <a href="/sign-up" className="block">
                <button className="btn-primary-glow text-sm px-5 py-3 w-full">
                  Get Started
                </button>
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-start px-4 pt-48 pb-20">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Main heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight leading-[0.95] overflow-visible">
            <span className="text-outline-purple">Design</span>
            <br />
            <TextShimmer
              shimmerColor="rgba(255, 255, 255, 0.9)"
              speed={4}
              size={40}

            >
              Meaningful
            </TextShimmer>
            <br />
            <span className="text-outline-purple">Experiences</span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            The spatial canvas for designing immersive experiences that shape states and cultivate lasting traits.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/sign-up">
              <button className="btn-primary-glow flex items-center gap-2 text-base">
                <Image
                  src="/images/hypercube-logo.webp"
                  alt=""
                  width={18}
                  height={18}
                  className="object-contain"
                />
                Start Free
                <ArrowRight className="w-4 h-4" />
              </button>
            </a>
            <a href="#demo">
              <button className="btn-secondary flex items-center gap-2">
                <Play className="w-4 h-4" />
                Watch Demo
              </button>
            </a>
          </div>

          {/* Social Proof - Designers with hover animation */}
          <div className="mt-16 flex flex-col items-center gap-4">
            <div className="flex items-center -space-x-3">
              {/* Designer avatars - replace src with actual photos */}
              {[
                { initials: 'JM', bg: 'bg-violet-600' },
                { initials: 'AR', bg: 'bg-indigo-600' },
                { initials: 'SK', bg: 'bg-purple-600' },
                { initials: 'LC', bg: 'bg-violet-500' },
                { initials: 'DP', bg: 'bg-indigo-500' },
              ].map((designer, i) => (
                <div
                  key={i}
                  className={`w-10 h-10 rounded-full ${designer.bg} flex items-center justify-center text-sm font-medium text-white border-2 border-black ring-1 ring-white/10 transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-110 hover:z-10 cursor-pointer`}
                  style={{ transitionDelay: `${i * 50}ms` }}
                >
                  {designer.initials}
                </div>
              ))}
            </div>
            <p className="text-white/50 text-sm">
              Trusted by <span className="text-white/70 font-medium">experience designers</span> worldwide
            </p>
          </div>
        </div>
      </section>

      {/* Demo/Screenshot Section */}
      <section id="demo" className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="glass-card-glow rounded-2xl overflow-hidden">
            {/* Window header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-white/20" />
                <div className="w-3 h-3 rounded-full bg-white/20" />
                <div className="w-3 h-3 rounded-full bg-white/20" />
              </div>
              <span className="text-sm text-white/40 ml-4">CXD Canvas</span>
            </div>

            {/* Canvas preview - object-contain to show full image */}
            <div className="bg-gradient-to-br from-black/50 to-black/80 relative overflow-hidden">
              <img
                src="/images/canvas-screenshot.png"
                alt="CXD Canvas - Experience Design Tool"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Everything you need to
              <br />
              <span className="text-gradient-purple">design experiences</span>
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              A complete toolkit for experience designers, creative producers and humane innovators.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Target, title: 'Intention-First Design', desc: 'Start with your core message and transformational goal. The canvas structures everything around your intention.' },
              { icon: Brain, title: 'State → Trait Mapping', desc: 'Bridge temporary experiences with lasting change. Design how states become enduring traits.' },
              { icon: Layers, title: 'Reality Planes', desc: 'Work across physical, virtual, and imaginal dimensions simultaneously.' },
              { icon: Layout, title: 'Infinite Canvas', desc: 'Unlimited spatial workspace with smooth zoom, pan, and organization tools.' },
              { icon: GitBranch, title: 'Experience Flow', desc: 'Timeline-based journey mapping with phase transitions and dependencies.' },
              { icon: Palette, title: 'Sensory Domains', desc: 'Map visual, auditory, tactile, and other sensory elements of your experience.' },
            ].map((feature, i) => (
              <div key={i} className="glass-card p-6 hover:border-white/20 transition-colors cursor-pointer group">
                <div className="feature-icon mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Pro features grid */}
          <div className="mt-16">
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-violet-400" />
                <span className="text-sm font-medium text-violet-400">Pro Features</span>
              </div>
              <h3 className="text-3xl md:text-4xl font-bold">Unlock the full power</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* AI Assistant */}
              <div className="glass-card-featured p-6 rounded-2xl">
                <div className="feature-icon mb-4 w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-violet-400" />
                </div>
                <h4 className="text-xl font-semibold mb-3">AI Assistant</h4>
                <p className="text-white/50 text-sm leading-relaxed mb-4">
                  Generate experience content, get design suggestions, and accelerate your workflow with intelligent AI that understands experience design principles.
                </p>
                <ul className="space-y-2">
                  {['Content generation', 'Design recommendations', 'Smart suggestions'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-white/60">
                      <Check className="w-3.5 h-3.5 text-violet-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Collaboration */}
              <div className="glass-card-featured p-6 rounded-2xl">
                <div className="feature-icon mb-4 w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Layout className="w-6 h-6 text-indigo-400" />
                </div>
                <h4 className="text-xl font-semibold mb-3">Collaboration</h4>
                <p className="text-white/50 text-sm leading-relaxed mb-4">
                  Work together in real-time with your team. See live cursors, share feedback, and co-create experiences seamlessly.
                </p>
                <ul className="space-y-2">
                  {['Real-time cursors', 'Team invitations', 'Live preview sharing'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-white/60">
                      <Check className="w-3.5 h-3.5 text-indigo-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Project Management */}
              <div className="glass-card-featured p-6 rounded-2xl">
                <div className="feature-icon mb-4 w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <GitBranch className="w-6 h-6 text-purple-400" />
                </div>
                <h4 className="text-xl font-semibold mb-3">Project Management</h4>
                <p className="text-white/50 text-sm leading-relaxed mb-4">
                  Convert experience blocks into actionable tasks. Manage your projects with calendar and kanban views built for production.
                </p>
                <ul className="space-y-2">
                  {['Plan View & Tasks', 'Calendar & Kanban', 'Progress tracking'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-white/60">
                      <Check className="w-3.5 h-3.5 text-purple-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="text-center mt-10">
              <a href="/sign-up">
                <button className="btn-primary-glow">
                  Try Pro Free
                </button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              From vision to
              <span className="text-gradient-purple"> reality</span>
            </h2>
            <p className="text-white/50 text-lg">Three steps to design your transformation.</p>
          </div>

          <div className="space-y-8">
            {[
              { num: '01', title: 'Define Your Intention', desc: 'Use the Initiation Wizard to establish your core message, audience, and transformation goal.' },
              { num: '02', title: 'Map on the Canvas', desc: 'Arrange reality planes, sensory domains, and presence types. Build your experience flow timeline.' },
              { num: '03', title: 'Refine and Execute', desc: 'Use Focus Mode for deep work. Generate tasks with Plan View. Share live previews for feedback.' },
            ].map((step, i) => (
              <div key={i} className="glass-card p-6 flex items-start gap-6 group hover:border-white/20 transition-colors">
                <div className="text-4xl font-bold text-gradient-purple">{step.num}</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-white/50 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative py-24 px-4">
        {/* Glow behind pricing */}
        <div className="glow-orb" style={{ top: '30%', left: '50%', transform: 'translateX(-50%)', opacity: 0.3 }} />

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Simple
              <span className="text-gradient-purple"> pricing</span>
            </h2>
            <p className="text-white/50 text-lg">Start free. Upgrade when you need more.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="pricing-card">
              <div className="mb-6">
                <h3 className="text-lg text-white/60 mb-2">Free</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-white/40">/forever</span>
                </div>
              </div>
              <p className="text-white/50 text-sm mb-6">
                Perfect for exploring and designing your first experience.
              </p>
              <ul className="space-y-3 mb-8">
                {['1 Canvas', 'Infinite workspace', 'Core design tools', 'Experience flow', 'Focus mode'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-white/40" />
                    <span className="text-white/70">{f}</span>
                  </li>
                ))}
              </ul>
              <a href="/sign-up" className="block">
                <button className="btn-secondary w-full">Get Started</button>
              </a>
            </div>

            {/* Pro - Featured */}
            <div className="pricing-card-featured">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-violet-500 text-white">
                  Popular
                </span>
              </div>
              <div className="mb-6">
                <h3 className="text-lg text-violet-400 mb-2">Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$20</span>
                  <span className="text-white/40">/month</span>
                </div>
              </div>
              <p className="text-white/50 text-sm mb-6">
                Full power for professional experience designers.
              </p>
              <ul className="space-y-3 mb-8">
                {['Unlimited Canvases', 'Everything in Free', 'AI Design Assistant', 'Plan View', 'Smart Templates', 'Team collaboration (3)', 'Priority support'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-violet-400" />
                    <span className="text-white/70">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('pro')}
                disabled={isLoading !== null}
                className="btn-primary-glow w-full flex items-center justify-center gap-2"
              >
                {isLoading === 'pro' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Start Pro Trial'
                )}
              </button>
            </div>

            {/* Lifetime */}
            <div className="pricing-card">
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg text-cyan-400 mb-2">Lifetime</h3>
                  <Infinity className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$199</span>
                  <span className="text-white/40">/once</span>
                </div>
              </div>
              <p className="text-white/50 text-sm mb-6">
                Pay once, own forever. All future versions included.
              </p>
              <ul className="space-y-3 mb-8">
                {['Everything in Pro', 'Lifetime access', 'All future updates', 'All future features', 'Founding member', 'Direct founder access'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-cyan-400" />
                    <span className="text-white/70">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('lifetime')}
                disabled={isLoading !== null}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                {isLoading === 'lifetime' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Get Lifetime'
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 px-4">
        <div className="max-w-3xl mx-auto text-center">
          {/* Tesseract GIF instead of animated logo */}
          <div className="mx-auto mb-8 w-24 h-24 md:w-32 md:h-32 relative">
            <Image
              src="/images/Tesseract-1K.gif"
              alt="Tesseract"
              width={128}
              height={128}
              className="object-contain"
              unoptimized
            />
          </div>

          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Ready to design
            <br />
            <TextShimmer
              shimmerColor="rgba(255, 255, 255, 0.9)"
              speed={4}
              size={50}
            >
              transformation?
            </TextShimmer>
          </h2>

          <p className="text-white/50 text-lg mb-10 max-w-xl mx-auto">
            Join experience designers creating meaningful, lasting change through intentional design.
          </p>

          <a href="/sign-up">
            <button className="btn-primary-glow text-lg px-8 py-4 flex items-center gap-3 mx-auto">
              <Image
                src="/images/hypercube-logo.webp"
                alt=""
                width={20}
                height={20}
                className="object-contain"
              />
              Start Your First Canvas
              <ArrowRight className="w-5 h-5" />
            </button>
          </a>

          <p className="text-white/30 text-sm mt-6">Free tier requires no credit card.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-8 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Image
              src="/images/CL Logo NL.png"
              alt="Cyberdelic Labs"
              width={32}
              height={32}
              className="rounded-lg opacity-70"
            />
            <span className="text-white/50 text-sm">Cyberdelic Labs</span>
          </div>

          <div className="flex items-center gap-2">
            <Image
              src="/images/hypercube-logo.webp"
              alt="CXD"
              width={20}
              height={20}
              className="object-contain"
            />
            <span className="text-white/50 text-sm">CXD Canvas</span>
          </div>

          <p className="text-white/30 text-sm">
            © 2025 Cyberdelic Labs
          </p>
        </div>
      </footer>
    </div>
  );
}
