'use client';

import { useState } from 'react';
import { HypercubeLogo } from '@/components/icons/hypercube-logo';
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
  Loader2
} from 'lucide-react';
import Image from 'next/image';

export function LandingPage() {
  const [isLoading, setIsLoading] = useState<'pro' | 'lifetime' | null>(null);

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
      {/* Background elements */}
      <div className="fixed inset-0 grid-bg pointer-events-none" />
      <div className="fixed inset-0 hero-gradient pointer-events-none" />

      {/* Decorative orbs */}
      <div className="glow-orb" style={{ top: '10%', left: '10%', opacity: 0.5 }} />
      <div className="glow-orb glow-orb-cyan" style={{ top: '60%', right: '5%', opacity: 0.3 }} />

      {/* Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
        <div className="nav-glass px-2 py-2 flex items-center gap-1">
          <a href="/" className="flex items-center gap-2 px-4 py-2">
            <HypercubeLogo size={24} />
            <span className="font-semibold">CXD</span>
          </a>

          <div className="hidden md:flex items-center">
            <a href="#features" className="nav-link-btn">Features</a>
            <a href="#demo" className="nav-link-btn">Demo</a>
            <a href="#pricing" className="nav-link-btn">Pricing</a>
          </div>

          <div className="flex items-center gap-2 ml-2">
            <a href="/sign-in" className="nav-link-btn">Log in</a>
            <a href="/sign-up">
              <button className="btn-primary-glow text-sm px-5 py-2">
                Get Started
              </button>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-32 pb-20">
        {/* Concentric circles decoration */}
        <div className="concentric-circles" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-8">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-white/70">Experience Design Tool</span>
          </div>

          {/* Main heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight leading-[0.95]">
            Design
            <br />
            <span className="text-gradient-purple">Transformational</span>
            <br />
            Experiences
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            The spatial canvas for designing immersive experiences that produce
            specific states and integrate them into lasting traits.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/sign-up">
              <button className="btn-primary-glow flex items-center gap-2 text-base">
                <HypercubeLogo size={18} />
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

          {/* Social Proof - Designers */}
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
                  className={`w-10 h-10 rounded-full ${designer.bg} flex items-center justify-center text-sm font-medium text-white border-2 border-black ring-1 ring-white/10`}
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
        <div className="max-w-6xl mx-auto">
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

            {/* Canvas preview */}
            <div className="aspect-video bg-gradient-to-br from-black/50 to-black/80 relative overflow-hidden">
              <img
                src="/images/canvas-screenshot.png"
                alt="CXD Canvas - Experience Design Tool"
                className="w-full h-full object-cover object-top"
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
              A complete toolkit for experience design professionals.
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

          {/* Pro features callout */}
          <div className="mt-12 glass-card-featured p-8 rounded-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  <span className="text-sm font-medium text-violet-400">Pro Features</span>
                </div>
                <h3 className="text-2xl font-bold mb-2">AI Assistant & Plan View</h3>
                <p className="text-white/50 max-w-lg">
                  Generate content with AI, convert experience blocks into actionable tasks,
                  and manage your projects with calendar and kanban views.
                </p>
              </div>
              <a href="/sign-up">
                <button className="btn-primary-glow whitespace-nowrap">
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
          <HypercubeLogo size={64} className="mx-auto mb-8" animated />

          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Ready to design
            <br />
            <span className="text-gradient-purple">transformation?</span>
          </h2>

          <p className="text-white/50 text-lg mb-10 max-w-xl mx-auto">
            Join experience designers creating meaningful, lasting change through intentional design.
          </p>

          <a href="/sign-up">
            <button className="btn-primary-glow text-lg px-8 py-4 flex items-center gap-3 mx-auto">
              <HypercubeLogo size={20} />
              Start Your First Canvas
              <ArrowRight className="w-5 h-5" />
            </button>
          </a>

          <p className="text-white/30 text-sm mt-6">Free forever. No credit card required.</p>
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
            <HypercubeLogo size={20} />
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
