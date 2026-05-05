// Singleton service-role Supabase client. Use ONLY from server contexts
// (route handlers, server actions, webhooks, cron). Bypasses RLS — never
// expose to the browser.
//
// Why singleton: previously each route created a fresh admin client per
// request via getSupabaseAdmin(), which opens a new connection slot every
// time. At scale that exhausts the pool. Reusing one instance keeps
// connections warm and bounded.
import '@/lib/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'getSupabaseAdmin: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set',
    );
  }

  cached = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-cxd-context': 'admin' },
    },
  });

  return cached;
}
