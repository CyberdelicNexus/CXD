// Plan configuration - Client-safe (no server secrets)

/**
 * Template catalog access:
 * - 'quickstart' — only the Quickstart templates are insertable; the rest of
 *   the catalog stays VISIBLE in the picker with Pro badges (showroom effect).
 * - 'full' — all templates + the AI Composer picks across the whole catalog.
 */
export type TemplateAccess = 'quickstart' | 'full';

// Free-tier strategy (2026-07): gate CAPACITY, not features (Milanote model).
// Plan view and the template picker are UNLOCKED for free; what's limited is
// volume — counted canvas objects (see src/lib/quota.ts), upload size, and a
// small monthly AI credit drip on standard models. Conversion comes from the
// endowment effect (hitting the object cap mid-build), not from hidden value.
export const PLANS = {
  FREE: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for exploring',
    features: [
      '1 Canvas · 100 objects',
      'All Plan views (Kanban, Gantt, Calendar…)',
      'Quickstart templates',
      '25 AI Credits/month + 50 signup bonus',
      'Infinite workspace & core design tools',
      'Public share links',
    ],
    limits: {
      maxCanvases: 1,
      hasAI: true,
      monthlyAICredits: 25, // Monthly drip — keeps the AI surface alive (standard models only)
      signupBonusCredits: 50, // One-time 50 credits on signup
      hasPlanView: true, // Unlocked — Plan view is the retention surface
      hasTemplates: true, // Picker opens for everyone; per-template gating via templateAccess
      templateAccess: 'quickstart' as TemplateAccess,
      maxCanvasObjects: 100, // Counted objects per owned canvas (cards/images/links/tables)
      maxUploadBytes: 5 * 1024 * 1024, // 5 MB per file
      hasCollaboration: false,
      maxCollaborators: 0,
      hasMasterPlan: false,
    },
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    description: 'Full power for professionals',
    price: 20,
    interval: 'month' as const,
    trialDays: 14,
    features: [
      'Unlimited Canvases & unlimited objects',
      'Full template catalog (22) + AI Composer',
      'Premium AI Models (Claude Sonnet, Gemini Pro, Kimi)',
      '500 AI Credits/month',
      'Calendar sync (Google, Apple, Outlook)',
      'Master Plan dashboard',
      'Team collaboration (3)',
      'Priority support',
    ],
    limits: {
      maxCanvases: Infinity,
      hasAI: true,
      monthlyAICredits: 500,
      hasPlanView: true,
      hasTemplates: true,
      templateAccess: 'full' as TemplateAccess,
      maxCanvasObjects: Infinity,
      maxUploadBytes: Infinity,
      hasCollaboration: true,
      maxCollaborators: 3,
      hasMasterPlan: true,
    },
  },
  LIFETIME: {
    id: 'lifetime',
    name: 'Lifetime',
    description: 'Pay once, own forever',
    price: 399,
    interval: 'once' as const,
    features: [
      'Everything in Pro',
      'All AI Models (Including Claude Opus)',
      '1000 Credits One-Time + BYOK',
      'Bring Your Own API Keys',
      'Lifetime access - Pay once',
      'All future updates forever',
      'Founding member badge',
      'Priority feature requests',
    ],
    limits: {
      maxCanvases: Infinity,
      hasAI: true,
      monthlyAICredits: 0, // No monthly credits - use BYOK or purchase addon credits
      lifetimeCredits: 1000, // One-time 1000 credits on signup
      hasPlanView: true,
      hasTemplates: true,
      templateAccess: 'full' as TemplateAccess,
      maxCanvasObjects: Infinity,
      maxUploadBytes: Infinity,
      hasCollaboration: true,
      maxCollaborators: 3,
      hasMasterPlan: true,
    },
  },
  BETA_TESTER: {
    id: 'beta_tester',
    name: 'Beta Tester',
    description: 'Early supporter access',
    features: [
      'Everything in Pro',
      'Lifetime access',
      'All future updates',
      'Beta tester badge',
    ],
    limits: {
      maxCanvases: Infinity,
      hasAI: true,
      monthlyAICredits: 500,
      hasPlanView: true,
      hasTemplates: true,
      templateAccess: 'full' as TemplateAccess,
      maxCanvasObjects: Infinity,
      maxUploadBytes: Infinity,
      hasCollaboration: true,
      maxCollaborators: 3,
      hasMasterPlan: true,
    },
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type Plan = typeof PLANS[PlanId];

// Get plan by ID
export function getPlan(planId: string): Plan {
  const plan = Object.values(PLANS).find(p => p.id === planId);
  return plan || PLANS.FREE;
}

// Check if user has access to a feature
export function hasFeatureAccess(
  planId: string,
  feature: 'ai' | 'planView' | 'templates' | 'unlimitedCanvases' | 'collaboration' | 'masterPlan'
): boolean {
  const plan = getPlan(planId);

  switch (feature) {
    case 'ai':
      return plan.limits.hasAI;
    case 'planView':
      return plan.limits.hasPlanView;
    case 'templates':
      return plan.limits.hasTemplates;
    case 'unlimitedCanvases':
      return plan.limits.maxCanvases === Infinity;
    case 'collaboration':
      return plan.limits.hasCollaboration;
    case 'masterPlan':
      return plan.limits.hasMasterPlan;
    default:
      return false;
  }
}

// Check if user can create more canvases
export function canCreateCanvas(planId: string, currentCanvasCount: number): boolean {
  const plan = getPlan(planId);
  return currentCanvasCount < plan.limits.maxCanvases;
}

// Check if user can add more collaborators
export function canAddCollaborator(planId: string, currentCollaboratorCount: number): boolean {
  const plan = getPlan(planId);
  return plan.limits.hasCollaboration && currentCollaboratorCount < plan.limits.maxCollaborators;
}

// Get max collaborators for a plan
export function getMaxCollaborators(planId: string): number {
  const plan = getPlan(planId);
  return plan.limits.maxCollaborators;
}

// Template catalog access level for a plan
export function getTemplateAccess(planId: string): TemplateAccess {
  return getPlan(planId).limits.templateAccess;
}

/**
 * Max counted canvas objects for a plan (see src/lib/quota.ts for what
 * counts). Infinity = uncapped. Applies only to canvases the user OWNS.
 */
export function getMaxCanvasObjects(planId: string): number {
  return getPlan(planId).limits.maxCanvasObjects;
}

/** Max per-file upload size in bytes. Infinity = uncapped. */
export function getMaxUploadBytes(planId: string): number {
  return getPlan(planId).limits.maxUploadBytes;
}
