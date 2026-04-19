const requiredServerVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'ENCRYPTION_KEY',
] as const;

const optionalServerVars = [
  'NEXT_PUBLIC_APP_URL',
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'MOONSHOT_API_KEY',
  'RESEND_FROM_EMAIL',
] as const;

export function validateEnv() {
  const missing: string[] = [];

  for (const key of requiredServerVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(k => `  - ${k}`).join('\n')}\n\nAdd these to your .env.local file or Vercel environment variables.`
    );
  }

  // Warn about optional vars
  for (const key of optionalServerVars) {
    if (!process.env[key]) {
      console.warn(`[env] Optional variable ${key} is not set`);
    }
  }
}

// Validate on first import (module-level)
validateEnv();
