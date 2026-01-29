import { createBrowserClient } from "@supabase/ssr";

const isProbablyTempoPreview = () => {
  if (typeof window === "undefined") return false;

  const host = window.location.host;

  // Tempo preview URLs are typically hosted under *.canvases.tempo.build
  return host.endsWith(".canvases.tempo.build");
};

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables");
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

  // Tempo preview URLs may not be allow-listed in Supabase Auth settings,
  // which can cause `auth.getUser()` to throw "TypeError: Failed to fetch".
  // To prevent the app from crashing/noisy logs in preview, gracefully degrade.
  if (isProbablyTempoPreview()) {
    const wrap = <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
      return (async (...args: Parameters<T>) => {
        try {
          return await fn(...args);
        } catch (e) {
          // Return a non-throwing, unauthenticated response shape.
          return { data: { user: null }, error: null } as any;
        }
      }) as T;
    };

    supabase.auth.getUser = wrap(supabase.auth.getUser.bind(supabase.auth));
    // Some codepaths in @supabase/auth-js call _getUser via getSession/getUser.
    // Wrapping getSession as well reduces console noise.
    supabase.auth.getSession = wrap(supabase.auth.getSession.bind(supabase.auth));
  }

  return supabase;
};
