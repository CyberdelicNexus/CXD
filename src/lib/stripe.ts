// Server-only Stripe SDK - Do not import on client side
import Stripe from 'stripe';

// Re-export plan configuration for convenience on server
export { PLANS, getPlan, hasFeatureAccess, canCreateCanvas, canAddCollaborator, getMaxCollaborators } from './plans';
export type { Plan, PlanId } from './plans';

// Lazy initialization to avoid errors when imported but not used
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Missing STRIPE_SECRET_KEY environment variable');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-01-27.acacia',
      typescript: true,
    });
  }
  return stripeInstance;
}

// For backward compatibility - use getStripe() for new code
export const stripe = {
  get billingPortal() {
    return getStripe().billingPortal;
  },
  get checkout() {
    return getStripe().checkout;
  },
  get customers() {
    return getStripe().customers;
  },
  get subscriptions() {
    return getStripe().subscriptions;
  },
  get prices() {
    return getStripe().prices;
  },
  get products() {
    return getStripe().products;
  },
  get webhooks() {
    return getStripe().webhooks;
  },
};
