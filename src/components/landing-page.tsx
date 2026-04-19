'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShimmerGrid } from '@/components/ui/shimmer-grid';
import { TextShimmer } from '@/components/ui/text-shimmer';
import {
  Layout,
  Target,
  Brain,
  Layers,
  ArrowRight,
  Check,
  Infinity as InfinityIcon,
  Palette,
  GitBranch,
  Sparkles,
  Play,
  Loader2,
  Menu,
  X,
  User,
  LayoutGrid
} from 'lucide-react';
import Image from 'next/image';

export function LandingPage() {
  const [isLoading, setIsLoading] = useState<'pro' | 'lifetime' | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');

  // import { useEffect } from 'react'; // Allow TS to infer or add import if missing. Wait, import is not at top. 
  // Let's assume standard React import. If useEffect is missing I should add it.
  // Actually, I can use React.useEffect if needed, or better, add it to imports. 
  // But strictly I can only modify specific blocks.
  // I will assume standard imports or add it. Line 3 has `import { useState } from 'react';`. 
  // I will replace line 3 as well in a separate chunk or just rely on the user having it or adding it.
  // Wait, I can't edit line 3 easily without a separate chunk. 
  // I'll add a separate chunk for imports.

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

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['features', 'demo', 'pricing'];
      const scrollPosition = window.scrollY + 100; // Offset for navbar

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section);
            return;
          }
        }
      }
      setActiveSection('');
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'CXD Canvas',
            applicationCategory: 'DesignApplication',
            operatingSystem: 'Web',
            url: 'https://canvas.cyberdelic.design',
            description: 'Design meaningful experiences with an AI-powered hyperreality canvas.',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
              description: 'Free tier available',
            },
            creator: {
              '@type': 'Organization',
              name: 'Cyberdelic',
              url: 'https://canvas.cyberdelic.design',
            },
          }),
        }}
      />
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
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[80%] md:w-auto max-w-4xl">
        <div className="nav-glass w-full p-2 md:p-1.5 flex items-center justify-between md:justify-start gap-1.5 relative overflow-hidden shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]">
          {/* Glass Reflection Effects */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

          {/* Logo */}
          <a href="/" className="flex items-center gap-2 group px-2 py-1.5 rounded-full transition-all duration-300 hover:bg-white/5 pr-4">
            <Image
              src="/images/hypercube-logo.webp"
              alt="CXD"
              width={28}
              height={28}
              className="object-contain"
            />
            <span className="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] whitespace-nowrap font-medium text-sm text-white/90">
              Cyberdelic Design Canvas
            </span>
          </a>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-white/10 mx-0.5" />

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1.5">
            {[
              { id: 'features', icon: LayoutGrid, label: 'Features' },
              { id: 'demo', icon: Play, label: 'Demo' },
              { id: 'pricing', icon: Target, label: 'Pricing' }
            ].map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`relative flex items-center p-2 group-hover:pr-4 rounded-full text-white/90 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] border shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] active:scale-95 group overflow-hidden
                    ${isActive
                      ? 'bg-violet-500/20 border-violet-500/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_0_20px_rgba(139,92,246,0.2)]'
                      : 'bg-white/[0.03] border-white/[0.08] hover:bg-violet-500/20 hover:border-violet-500/30 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_0_20px_rgba(139,92,246,0.2)]'
                    }`}
                  aria-label={item.label}
                >
                  <span className="relative z-10 shrink-0">
                    <item.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-violet-200' : 'group-hover:text-violet-200'}`} />
                  </span>
                  <span className={`relative z-10 max-w-0 overflow-hidden group-hover:max-w-[100px] group-hover:opacity-100 group-hover:ml-2 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] whitespace-nowrap text-xs font-medium text-violet-100 ${isActive ? 'opacity-0' : 'opacity-0'}`}>
                    {item.label}
                  </span>
                  {/* Subtle inner top highlight */}
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  {/* Subtle bottom glow */}
                  <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </a>
              );
            })}
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-white/10 mx-0.5" />

          {/* Auth buttons */}
          <div className="hidden md:flex items-center gap-1.5">
            <a
              href="/sign-in"
              className="relative flex items-center p-2 group-hover:pr-4 rounded-full text-white/90 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] bg-white/[0.03] border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:bg-violet-500/20 hover:border-violet-500/30 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_0_20px_rgba(139,92,246,0.2)] active:scale-95 group overflow-hidden"
              aria-label="Log in"
            >
              <User className="w-4 h-4 shrink-0 group-hover:text-violet-200 transition-colors" />
              <span className="relative z-10 max-w-0 overflow-hidden opacity-0 group-hover:max-w-[100px] group-hover:opacity-100 group-hover:ml-2 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] whitespace-nowrap text-xs font-medium text-violet-100">
                Log in
              </span>
            </a>
            <a href="/sign-up">
              <button className="btn-primary-glow text-xs font-semibold px-4 py-2 shadow-[0_0_20px_rgba(139,92,246,0.5)] hover:shadow-[0_0_30px_rgba(139,92,246,0.7)]">
                Get Started
              </button>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-white/80 hover:text-white transition-all duration-300"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 rotate-180" />}
          </button>
        </div>

        {/* Improved Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="md:hidden mt-3 relative rounded-[2.5rem] bg-black/90 backdrop-blur-3xl p-4 shadow-[0_25px_60px_-15px_rgba(139,92,246,0.4)] border border-white/10 flex flex-col gap-1 overflow-hidden"
            >
              <div className="flex flex-col">
                {[
                  { label: "Features", href: "#features", icon: LayoutGrid },
                  { label: "Demo", href: "#demo", icon: Play },
                  { label: "Pricing", href: "#pricing", icon: Target },
                  { label: "Log in", href: "/sign-in", icon: Brain },
                ].map((item, idx) => (
                  <motion.a
                    key={item.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * idx }}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="group flex justify-between items-center px-5 py-4 rounded-3xl hover:bg-white/5 text-base font-semibold text-white/70 hover:text-white transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                        <item.icon className="w-4 h-4 text-violet-400" />
                      </div>
                      {item.label}
                    </div>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                  </motion.a>
                ))}
              </div>

              <div className="px-2 pt-2 pb-2">
                <motion.a
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  href="/sign-up"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block"
                >
                  <button className="btn-primary-glow text-sm px-4 py-4 w-full flex items-center justify-center gap-2 rounded-[1.5rem] whitespace-nowrap">
                    Start Your First Canvas
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
          </div>

        </div>
      </section>

      {/* Gallery Carousel Section */}
      <section id="demo" className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <ScreenshotCarousel />
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
              { icon: Layers, title: 'Reality Planes', desc: 'Plan and intertwine experiences across physical, virtual, biological, cognitive, generative, mixed and augmented realities simultaneously.' },
              { icon: Layout, title: 'Infinite Canvas', desc: 'Unlimited spatial workspace with smooth zoom, pan, and organization tools.' },
              { icon: GitBranch, title: 'Experience Flow', desc: 'Timeline-based journey mapping with phase transitions and dependencies.' },
              { icon: Palette, title: 'Sensory Domains', desc: 'Define the visual, auditory, haptic, olfactory and gustatory sensory domains of your experience.' },
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
                  Summarize your progress and Generate Experience Requierement Document (ERD), get design suggestions and accelerate your workflow with AI that understands experience design principles.
                </p>
                <ul className="space-y-2">
                  {['ERD generation', 'Design recommendations', 'Smart suggestions'].map((item, i) => (
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
                  Starty Your Pro Trial
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
              Design with
              <span className="text-gradient-purple"> Intent</span>
            </h2>
            <p className="text-white/50 text-lg">A systematic framework for experience design.</p>
          </div>

          <div className="space-y-8">
            {[
              { num: '01', title: 'Frame', desc: 'Clarify the audience, context, constraints, and intended transformation before anything is built.' },
              { num: '02', title: 'Design', desc: 'Compose the experience space by arranging reality planes, sensory domains, and presence elements.' },
              { num: '03', title: 'Map', desc: 'Explore how experiences unfold over time, across states, traits, and possible paths.' },
              { num: '04', title: 'Plan', desc: 'Translate the experience into tasks, assets, timelines, and collaboration.' },
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
                {['1 Canvas', 'Infinite workspace', 'Core design tools', 'Experience flow'].map((f, i) => (
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
                  <InfinityIcon className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$333</span>
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

// ─── Screenshot Gallery Carousel ────────────────────────────────────────────

const CAROUSEL_IMAGES = [
  { src: '/images/Screenshot/0_canvas-screeshot.png', alt: 'CXD Canvas View' },
  { src: '/images/Screenshot/1_canvas-screeshot.png', alt: 'CXD Design Tools' },
  { src: '/images/Screenshot/2_canvas-screeshot.png', alt: 'CXD Experience Flow' },
  { src: '/images/Screenshot/3_canvas-screeshot.png', alt: 'CXD Hypercube Map' },
  { src: '/images/Screenshot/4_canvas-screeshot.png', alt: 'CXD Plan View' },
  { src: '/images/Screenshot/5_canvas-screeshot.png', alt: 'CXD Collaboration' },
  { src: '/images/Screenshot/6_canvas-screeshot.png', alt: 'CXD Canvas Overview' },
];

function ScreenshotCarousel() {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = CAROUSEL_IMAGES.length;

  const goTo = useCallback((idx: number) => {
    setCurrent(((idx % total) + total) % total);
  }, [total]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Auto-play
  useEffect(() => {
    if (isHovered) return;
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % total);
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isHovered, total]);

  return (
    <div
      className="glass-card-glow rounded-2xl overflow-hidden group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Window header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/20" />
        </div>
        <span className="text-sm text-white/40 ml-4">CXD Canvas</span>
        <span className="text-sm text-white/20 ml-auto">{current + 1} / {total}</span>
      </div>

      {/* Carousel viewport */}
      <div className="relative bg-gradient-to-br from-black/50 to-black/80 overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {CAROUSEL_IMAGES.map((img, i) => (
            <div key={i} className="w-full flex-shrink-0">
              <Image
                src={img.src}
                alt={img.alt}
                width={1200}
                height={675}
                className="w-full h-auto object-contain"
                priority={i === 0}
                draggable={false}
              />
            </div>
          ))}
        </div>

        {/* Nav arrows */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
          aria-label="Previous screenshot"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
          aria-label="Next screenshot"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-2 py-3 bg-black/30">
        {CAROUSEL_IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`transition-all duration-300 rounded-full ${
              i === current
                ? 'w-6 h-2 bg-purple-400'
                : 'w-2 h-2 bg-white/20 hover:bg-white/40'
            }`}
            aria-label={`Go to screenshot ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
