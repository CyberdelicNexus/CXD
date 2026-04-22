'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShimmerGrid } from '@/components/ui/shimmer-grid';
import { TextShimmer } from '@/components/ui/text-shimmer';
import {
  ArrowRight,
  Check,
  Infinity as InfinityIcon,
  Sparkles,
  Loader2,
  Menu,
  X,
  Compass,
  LayoutGrid,
  Box,
  ListChecks,
  Users,
  Play,
  Target,
  Brain,
  User,
} from 'lucide-react';
import Image from 'next/image';

// ─── Feature Sections Data ──────────────────────────────────────────────────

interface FeatureDetail {
  title: string;
  description: string;
  video?: string;      // optional per-detail video; falls back to section.video
  duration?: number;   // seconds to show this detail if no distinct video (default 6)
}

interface FeatureSection {
  id: string;
  icon: typeof Compass;
  label: string;
  headline: string;
  highlight: string;
  description: string;
  video?: string; // fallback/section-level video
  poster?: string; // screenshot fallback
  details: FeatureDetail[];
}

const FEATURE_SECTIONS: FeatureSection[] = [
  {
    id: 'framing',
    icon: Compass,
    label: 'Framing Wizard',
    headline: 'Start with',
    highlight: 'Intent',
    description: 'A guided 11-step framework that structures your experience design from audience and context to transformation goals — before you touch the canvas.',
    video: '/images/Gifs/Framing_2_web.mp4',
    poster: '/images/Screenshot/0_canvas-screeshot.png',
    details: [
      { title: 'Guided Framework', description: 'Walk through audience, context, intention, and desired outcomes step by step.' },
      { title: 'Core Message', description: 'Distill your experience into a single transformational message that drives every design decision.' },
      { title: 'Seamless Transition', description: 'Click "Explore Canvas" and your framing populates the workspace automatically.' },
    ],
  },
  {
    id: 'canvas',
    icon: LayoutGrid,
    label: 'Infinite Canvas',
    headline: 'Design',
    highlight: 'Spatially',
    description: 'An unlimited workspace with notes, tasks, connectors, boards, and nested containers. Drag, connect, and organize ideas in a spatial environment.',
    poster: '/images/Screenshot/1_canvas-screeshot.png',
    details: [
      { title: 'Notes & Tasks', description: 'Create rich note cards and actionable task cards with subtasks, tags, and metadata.' },
      { title: 'Smart Connectors', description: 'Link elements with gradient connectors that auto-inherit tags and create visual relationships.' },
      { title: 'Nested Boards', description: 'Organize complex projects with boards inside boards — zoom into any level of detail.' },
    ],
  },
  {
    id: 'hypercube',
    icon: Box,
    label: 'Hypercube Map',
    headline: 'See the',
    highlight: 'Bigger Picture',
    description: 'A 3D cube visualization that maps your experience across multiple dimensions. Tag elements to faces and rotate to explore connections others miss.',
    poster: '/images/Screenshot/3_canvas-screeshot.png',
    details: [
      { title: '3D Navigation', description: 'Rotate the cube to explore six dimensions of your experience design simultaneously.' },
      { title: 'Face Tagging', description: 'Tag canvas elements to cube faces and see them filter in real-time as you rotate.' },
      { title: 'Unique Perspective', description: 'A visualization method you won\'t find in any other design tool.' },
    ],
  },
  {
    id: 'plan',
    icon: ListChecks,
    label: 'Plan View',
    headline: 'From Vision to',
    highlight: 'Execution',
    description: 'Transform your experience design into actionable production plans with Kanban boards, Gantt timelines, calendar views, and version milestones.',
    poster: '/images/Screenshot/4_canvas-screeshot.png',
    details: [
      { title: 'Multiple Views', description: 'Switch between Kanban, Gantt, Calendar, and Table views — same tasks, different perspectives.' },
      { title: 'Canvas Integration', description: 'Convert any canvas element into a task. Changes sync bidirectionally.' },
      { title: 'Version Milestones', description: 'Track progress across versions with timeline-based milestone planning.' },
    ],
  },
  {
    id: 'collaboration',
    icon: Users,
    label: 'Collaboration',
    headline: 'Create',
    highlight: 'Together',
    description: 'Work with your team in real-time. See live cursors, share feedback, and co-create experiences seamlessly across the canvas.',
    poster: '/images/Screenshot/5_canvas-screeshot.png',
    details: [
      { title: 'Live Cursors', description: 'See where your team members are working on the canvas in real-time.' },
      { title: 'Instant Sync', description: 'Every edit propagates immediately — no save buttons, no conflicts.' },
      { title: 'Share & Invite', description: 'Invite collaborators by email or share read-only links for stakeholder review.' },
    ],
  },
];

// ─── Sticky Feature Section Component ───────────────────────────────────────

function FeatureShowcase({ section, index }: { section: FeatureSection; index: number }) {
  const isEven = index % 2 === 0;
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  // Combined state so idx and progress update atomically — prevents the new
  // active bar from momentarily rendering at 100% before the timer resets.
  const [cycle, setCycle] = useState({ idx: 0, progress: 0 });
  const activeDetailIdx = cycle.idx;
  const progress = cycle.progress;

  const activeDetail = section.details[activeDetailIdx];
  const activeVideoSrc = activeDetail?.video || section.video;
  const activeDuration = activeDetail?.duration ?? 6; // seconds fallback
  const totalDetails = section.details.length;

  // Observe visibility so we only run the timer when the section is on-screen
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Play/pause video when in view
  useEffect(() => {
    if (!videoRef.current) return;
    if (isInView) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isInView, activeVideoSrc]);

  // Cycle through details on a timer (6s default) while in view.
  // idx + progress advance atomically to avoid transition jumps.
  useEffect(() => {
    if (!isInView) return;
    const startedAt = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const pct = elapsed / activeDuration;
      if (pct >= 1) {
        setCycle((prev) => ({ idx: (prev.idx + 1) % totalDetails, progress: 0 }));
        return;
      }
      setCycle((prev) => ({ idx: prev.idx, progress: pct }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isInView, activeDetailIdx, activeDuration, totalDetails]);

  // Reset video progress when switching details
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [activeDetailIdx]);

  const handleDetailClick = (i: number) => {
    if (i === activeDetailIdx) return;
    setCycle({ idx: i, progress: 0 });
  };

  const mediaContent = (
    <div className="lg:sticky lg:top-28 w-full lg:w-3/4">
      <motion.div
        initial={{ opacity: 0, x: isEven ? -40 : 40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/50 shadow-2xl shadow-purple-500/10"
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-black/40">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
          </div>
          <span className="text-xs text-white/30 ml-3">{section.label} · {activeDetail?.title}</span>
        </div>

        {/* Video or poster */}
        <div className="relative aspect-video bg-gradient-to-br from-purple-950/30 to-black">
          {activeVideoSrc ? (
            <>
              {!isVideoLoaded && section.poster && (
                <Image
                  src={section.poster}
                  alt={section.label}
                  fill
                  sizes="(max-width: 768px) 100vw, 75vw"
                  className="object-cover"
                />
              )}
              <video
                ref={videoRef}
                src={activeVideoSrc}
                muted
                loop
                playsInline
                preload="metadata"
                onLoadedData={() => setIsVideoLoaded(true)}
                className={`w-full h-full object-cover transition-opacity duration-500 ${isVideoLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
            </>
          ) : section.poster ? (
            <div className="relative w-full h-full">
              <Image
                src={section.poster}
                alt={section.label}
                fill
                sizes="(max-width: 768px) 100vw, 75vw"
                className="object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-sm">
                  <Play className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-white/60">Demo coming soon</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );

  const textContent = (
    <div className="w-full lg:w-1/4 space-y-6">
      {/* Headline + description */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">
          {section.headline}{' '}
          <span className="text-gradient-purple">{section.highlight}</span>
        </h2>
        <p className="text-white/50 text-base leading-relaxed">
          {section.description}
        </p>
      </motion.div>

      {/* Detail cards — clickable, with per-item progress bar */}
      <div className="space-y-3">
        {section.details.map((detail, i) => {
          const isActive = i === activeDetailIdx;
          return (
            <motion.button
              key={i}
              type="button"
              onClick={() => handleDetailClick(i)}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={`relative w-full overflow-hidden p-4 rounded-xl border text-left transition-all cursor-pointer ${
                isActive
                  ? 'border-purple-400/50 bg-purple-500/5 shadow-[0_0_24px_rgba(168,85,247,0.08)]'
                  : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
              }`}
            >
              <h3 className={`text-sm font-semibold mb-1 ${isActive ? 'text-white' : 'text-white/80'}`}>
                {detail.title}
              </h3>
              <p className="text-xs text-white/40 leading-relaxed">{detail.description}</p>
              {/* Progress bar (only on active) */}
              <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-violet-500"
                  style={{
                    width: isActive ? `${progress * 100}%` : '0%',
                    // Smooth collapse when leaving active; minimal easing while filling
                    // so the bar stays in sync with the timer.
                    transition: isActive
                      ? 'width 120ms linear'
                      : 'width 500ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      className="relative py-16 md:py-24 px-4"
    >
      <div className="max-w-7xl mx-auto">
        {/* Centered section header — icon badge + label, defines each view */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.92 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center justify-center mb-12 md:mb-16"
        >
          <div className="relative">
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-2xl bg-purple-500/30 blur-2xl scale-150" />
            {/* Icon badge */}
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/30 to-violet-600/20 border border-purple-400/40 flex items-center justify-center shadow-[0_8px_32px_rgba(168,85,247,0.25)] backdrop-blur-sm">
              <section.icon className="w-6 h-6 text-purple-200" />
            </div>
          </div>
          <span className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-purple-300/80">
            {section.label}
          </span>
          <div className="mt-3 h-px w-16 bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />
        </motion.div>

        {/* Content reveal wrapper */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className={`flex flex-col lg:flex-row gap-10 lg:gap-12 items-start ${isEven ? '' : 'lg:flex-row-reverse'}`}
        >
          {mediaContent}
          {textContent}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Main Landing Page ──────────────────────────────────────────────────────

export function LandingPage() {
  const [isLoading, setIsLoading] = useState<'pro' | 'lifetime' | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');

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
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const sections = ['features', 'pricing'];
        const scrollPosition = window.scrollY + 100;

        for (const section of sections) {
          const element = document.getElementById(section);
          if (element) {
            const { offsetTop, offsetHeight } = element;
            if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
              setActiveSection(section);
              ticking = false;
              return;
            }
          }
        }
        setActiveSection('');
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
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
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free tier available' },
            creator: { '@type': 'Organization', name: 'Cyberdelic', url: 'https://canvas.cyberdelic.design' },
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
      <div className="fixed inset-0 hero-gradient pointer-events-none" />

      {/* ─── Navigation ─── */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[80%] md:w-auto max-w-4xl">
        <div className="nav-glass w-full p-2 md:p-1.5 flex items-center justify-between md:justify-start gap-1.5 relative overflow-hidden shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]">
          {/* Glass Reflection Effects */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

          {/* Logo */}
          <a href="/" className="flex items-center gap-2 group px-2 py-1.5 rounded-full transition-all duration-300 hover:bg-white/5 pr-4">
            <Image src="/images/CXD Logo 2.png" alt="CXD" width={28} height={28} className="object-contain" priority />
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
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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

        {/* Mobile Menu Overlay */}
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

      {/* ─── Hero Section ─── */}
      <section className="relative min-h-screen flex flex-col items-center justify-start px-4 pt-48 pb-20">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Logo above headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <Image
              src="/images/CXD Logo 2.png"
              alt="CXD Canvas"
              width={80}
              height={80}
              className="object-contain mx-auto"
              priority
            />
          </motion.div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight leading-[0.95] overflow-visible">
            <span className="text-outline-purple">Design</span>
            <br />
            <TextShimmer shimmerColor="rgba(255, 255, 255, 0.9)" speed={4} size={40}>
              Meaningful
            </TextShimmer>
            <br />
            <span className="text-outline-purple">Experiences</span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            The spatial canvas for designing immersive experiences that shape states and cultivate lasting traits.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/sign-up">
              <button className="btn-primary-glow flex items-center gap-2 text-base">
                <Image src="/images/CXD Logo 2.png" alt="" width={18} height={18} className="object-contain" />
                Start Free
                <ArrowRight className="w-4 h-4" />
              </button>
            </a>
          </div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="mt-20 flex flex-col items-center gap-2 text-white/20"
          >
            <span className="text-xs tracking-widest uppercase">Scroll to explore</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5"
            >
              <div className="w-1 h-2 rounded-full bg-white/30" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Feature Showcase Sections ─── */}
      <div id="features">
        {FEATURE_SECTIONS.map((section, index) => (
          <FeatureShowcase key={section.id} section={section} index={index} />
        ))}
      </div>

      {/* ─── Pricing Section ─── */}
      <section id="pricing" className="relative py-24 px-4">
        <div className="glow-orb" style={{ top: '30%', left: '50%', transform: 'translateX(-50%)', opacity: 0.3 }} />

        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Simple<span className="text-gradient-purple"> pricing</span>
            </h2>
            <p className="text-white/50 text-lg">Start free. Upgrade when you need more.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }} className="pricing-card">
              <div className="mb-6">
                <h3 className="text-lg text-white/60 mb-2">Free</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-white/40">/forever</span>
                </div>
              </div>
              <p className="text-white/50 text-sm mb-6">Perfect for exploring and designing your first experience.</p>
              <ul className="space-y-3 mb-8">
                {['1 Canvas', 'Infinite workspace', 'Core design tools', 'Experience flow'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-white/40" />
                    <span className="text-white/70">{f}</span>
                  </li>
                ))}
              </ul>
              <a href="/sign-up" className="block"><button className="btn-secondary w-full">Get Started</button></a>
            </motion.div>

            {/* Pro */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.1 }} className="pricing-card-featured">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-violet-500 text-white">Popular</span>
              </div>
              <div className="mb-6">
                <h3 className="text-lg text-violet-400 mb-2">Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$20</span>
                  <span className="text-white/40">/month</span>
                </div>
              </div>
              <p className="text-white/50 text-sm mb-6">Full power for professional experience designers.</p>
              <ul className="space-y-3 mb-8">
                {['Unlimited Canvases', 'Everything in Free', 'AI Design Assistant', 'Plan View', 'Smart Templates', 'Team collaboration (3)', 'Priority support'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-violet-400" />
                    <span className="text-white/70">{f}</span>
                  </li>
                ))}
              </ul>
              <button onClick={() => handleCheckout('pro')} disabled={isLoading !== null} className="btn-primary-glow w-full flex items-center justify-center gap-2">
                {isLoading === 'pro' ? (<><Loader2 className="w-4 h-4 animate-spin" />Loading...</>) : 'Start Pro Trial'}
              </button>
            </motion.div>

            {/* Lifetime */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.2 }} className="pricing-card">
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
              <p className="text-white/50 text-sm mb-6">Pay once, own forever. All future versions included.</p>
              <ul className="space-y-3 mb-8">
                {['Everything in Pro', 'Lifetime access', 'All future updates', 'All future features', 'Founding member', 'Direct founder access'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-cyan-400" />
                    <span className="text-white/70">{f}</span>
                  </li>
                ))}
              </ul>
              <button onClick={() => handleCheckout('lifetime')} disabled={isLoading !== null} className="btn-secondary w-full flex items-center justify-center gap-2">
                {isLoading === 'lifetime' ? (<><Loader2 className="w-4 h-4 animate-spin" />Loading...</>) : 'Get Lifetime'}
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="relative py-32 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="mx-auto mb-8 w-24 h-24 md:w-32 md:h-32 relative">
              <Image
                src="/images/holographic-cube.webp"
                alt="Holographic cube"
                width={128}
                height={128}
                className="object-contain w-full h-full"
                style={{ mixBlendMode: 'screen' }}
              />
            </div>

            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Ready to design
              <br />
              <TextShimmer shimmerColor="rgba(255, 255, 255, 0.9)" speed={4} size={50}>
                transformation?
              </TextShimmer>
            </h2>

            <p className="text-white/50 text-lg mb-10 max-w-xl mx-auto">
              Join experience designers creating meaningful, lasting change through intentional design.
            </p>

            <a href="/sign-up">
              <button className="btn-primary-glow text-lg px-8 py-4 flex items-center gap-3 mx-auto">
                <Image src="/images/CXD Logo 2.png" alt="" width={20} height={20} className="object-contain" />
                Start Your First Canvas
                <ArrowRight className="w-5 h-5" />
              </button>
            </a>

            <p className="text-white/30 text-sm mt-6">Free tier requires no credit card.</p>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative py-8 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Image src="/images/CL Logo NL.png" alt="Cyberdelic Labs" width={32} height={32} className="rounded-lg opacity-70" />
            <span className="text-white/50 text-sm">Cyberdelic Labs</span>
          </div>
          <div className="flex items-center gap-2">
            <Image src="/images/CXD Logo 2.png" alt="CXD" width={20} height={20} className="object-contain" />
            <span className="text-white/50 text-sm">CXD Canvas</span>
          </div>
          <p className="text-white/30 text-sm">© 2025 Cyberdelic Labs</p>
        </div>
      </footer>
    </div>
  );
}
