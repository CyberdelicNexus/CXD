// Plan configuration - Client-safe (no server secrets)

export const PLANS = {
  FREE: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for exploring',
    features: [
      '1 Canvas',
      'Infinite workspace',
      'Core design tools',
      'Experience flow',
      'Focus mode',
      '50 AI Credits (One-Time Bonus)',
    ],
    limits: {
      maxCanvases: 1,
      hasAI: true,
      monthlyAICredits: 0, // No monthly credits for free tier
      signupBonusCredits: 50, // One-time 50 credits on signup
      hasPlanView: false,
      hasTemplates: false,
      hasCollaboration: false,
      maxCollaborators: 0,
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
      'Unlimited Canvases',
      'Everything in Free',
      'Premium AI Models (GPT-4o, Claude Sonnet, Kimi)',
      '500 AI Credits/month',
      'Plan View with Kanban',
      'Smart Templates',
      'Team collaboration (3)',
      'Priority support',
    ],
    limits: {
      maxCanvases: Infinity,
      hasAI: true,
      monthlyAICredits: 500,
      hasPlanView: true,
      hasTemplates: true,
      hasCollaboration: true,
      maxCollaborators: 3,
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
      hasCollaboration: true,
      maxCollaborators: 3,
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
      hasCollaboration: true,
      maxCollaborators: 3,
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
  feature: 'ai' | 'planView' | 'templates' | 'unlimitedCanvases' | 'collaboration'
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
