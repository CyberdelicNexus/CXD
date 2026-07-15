import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/supabase/server';
import { getSupabaseAdmin } from '@/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Calendar feed token management — GET fetches (creating if absent), POST
 * rotates. The returned token is the bearer secret for the unauthenticated
 * ICS feed route (/api/calendar/feed/[token]/route.ts): anyone holding it can
 * read that user's tasks, so it's generated server-side only and never
 * derivable from the user id.
 */

function generateToken(): string {
  // 32 bytes (256 bits) of entropy, base64url-encoded so it's safe to embed
  // directly in a URL path segment with no further escaping.
  return crypto.randomBytes(32).toString('base64url');
}

function buildFeedUrl(request: NextRequest, token: string): string {
  return `${request.nextUrl.origin}/api/calendar/feed/${token}`;
}

/**
 * GET /api/calendar/token — return the caller's existing feed token,
 * creating one on first request.
 */
export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('calendar_feed_tokens')
      .select('token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (lookupError) {
      console.error('[calendar/token] lookup error:', lookupError.message);
      return NextResponse.json({ error: 'Failed to load calendar token' }, { status: 500 });
    }

    if (existing?.token) {
      return NextResponse.json({ token: existing.token, feedUrl: buildFeedUrl(request, existing.token) });
    }

    // No token yet — create one. Insert (not upsert) so a lookup race with
    // another concurrent GET surfaces as a unique-violation we can recover
    // from by re-reading, rather than silently overwriting a token another
    // request just created.
    const token = generateToken();
    const { error: insertError } = await supabaseAdmin
      .from('calendar_feed_tokens')
      .insert({ user_id: user.id, token });

    if (insertError) {
      if (insertError.code === '23505') {
        // Unique/PK violation — another request created the token first.
        const { data: raced, error: racedError } = await supabaseAdmin
          .from('calendar_feed_tokens')
          .select('token')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!racedError && raced?.token) {
          return NextResponse.json({ token: raced.token, feedUrl: buildFeedUrl(request, raced.token) });
        }
      }
      console.error('[calendar/token] insert error:', insertError.message);
      return NextResponse.json({ error: 'Failed to create calendar token' }, { status: 500 });
    }

    return NextResponse.json({ token, feedUrl: buildFeedUrl(request, token) });
  } catch (error) {
    console.error('[calendar/token] Error fetching token:', error);
    return NextResponse.json({ error: 'Failed to load calendar token' }, { status: 500 });
  }
}

/**
 * POST /api/calendar/token — rotate the caller's feed token. Invalidates the
 * previous URL immediately (any calendar app still polling the old token
 * gets a 404 from the feed route).
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const token = generateToken();
    const { error: upsertError } = await supabaseAdmin
      .from('calendar_feed_tokens')
      .upsert({ user_id: user.id, token }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('[calendar/token] rotate error:', upsertError.message);
      return NextResponse.json({ error: 'Failed to rotate calendar token' }, { status: 500 });
    }

    return NextResponse.json({ token, feedUrl: buildFeedUrl(request, token) });
  } catch (error) {
    console.error('[calendar/token] Error rotating token:', error);
    return NextResponse.json({ error: 'Failed to rotate calendar token' }, { status: 500 });
  }
}
