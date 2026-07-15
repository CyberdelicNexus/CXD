import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { queryTasks } from '@/utils/task-engine';
import { buildICSCalendar, type CalendarFeedItem } from '@/lib/calendar/ics';
import type { CanvasElement } from '@/types/canvas-elements';
import type { TaskQuery } from '@/types/plan-types';

export const dynamic = 'force-dynamic';

// Same projection filter as /api/master-plan/tasks — every qualifying card
// (completed included). Completed tasks are dropped later, in
// buildICSCalendar, not here: filtering post-projection keeps this route's
// "what counts as a task" definition identical to Master Plan's, so the two
// surfaces never silently diverge on qualification rules.
const FEED_QUERY: TaskQuery = {
  filter: {
    showCompleted: true,
    includeImplicitTasks: true,
    includeExplicitTasks: true,
    includeTaggedCards: true,
  },
  sort: [{ field: 'dueDate', direction: 'asc' }],
};

/**
 * GET /api/calendar/feed/[token] — RFC 5545 ICS feed of every task (across
 * every project the token's owner owns or collaborates on) that has a due
 * date. NO session/cookie auth: the token in the path IS the bearer secret,
 * by design — calendar apps (Google Calendar, Apple Calendar, Outlook) poll
 * this URL unattended on their own schedule with no way to attach a session
 * cookie or Authorization header. Anyone holding the URL can read that
 * user's task titles/status/priority, so treat it like a password: never
 * log it, and rotation (POST /api/calendar/token) is the only revocation
 * mechanism.
 *
 * Task aggregation mirrors /api/master-plan/tasks/route.ts exactly (owned +
 * collaborated project union, canvasLayout.elements + boards[].nodes
 * projection) so the feed and the Master Plan tab never show different task
 * sets for the same account.
 */
async function loadCalendarBody(token: string): Promise<
  | { ok: true; body: string }
  | { ok: false; status: number; error: string }
> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[calendar/feed] SUPABASE_SERVICE_ROLE_KEY is not configured');
    return { ok: false, status: 500, error: 'Server configuration error' };
  }
  if (!token) {
    return { ok: false, status: 404, error: 'Not found' };
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from('calendar_feed_tokens')
    .select('user_id')
    .eq('token', token)
    .maybeSingle();

  if (tokenError) {
    console.error('[calendar/feed] token lookup error:', tokenError.message);
    return { ok: false, status: 500, error: 'Failed to load calendar feed' };
  }
  if (!tokenRow?.user_id) {
    return { ok: false, status: 404, error: 'Not found' };
  }
  const userId: string = tokenRow.user_id;

  // Owned + collaborated projects (exact union pattern as /api/master-plan/tasks).
  const [
    { data: ownedData, error: ownedError },
    { data: collabData, error: collabError },
  ] = await Promise.all([
    supabaseAdmin
      .from('cxd_projects')
      .select('id, owner_id, name, project_data')
      .eq('owner_id', userId),
    supabaseAdmin
      .from('canvas_collaborators')
      .select('canvas_id')
      .eq('user_id', userId),
  ]);

  if (ownedError) console.error('[calendar/feed] owned projects error:', ownedError);
  if (collabError) console.error('[calendar/feed] collaborator lookup error:', collabError);

  const collabCanvasIds = (collabData || []).map((c: { canvas_id: string }) => c.canvas_id);
  let collaboratedRows: { id: string; owner_id: string; name: string; project_data: unknown }[] = [];
  if (collabCanvasIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('cxd_projects')
      .select('id, owner_id, name, project_data')
      .in('id', collabCanvasIds)
      .neq('owner_id', userId);
    if (error) console.error('[calendar/feed] collaborated projects error:', error);
    else collaboratedRows = data || [];
  }

  const allRows = [...(ownedData || []), ...collaboratedRows];

  const items: CalendarFeedItem[] = [];
  for (const row of allRows) {
    const projectData = (row.project_data || {}) as {
      canvasLayout?: { elements?: CanvasElement[]; boards?: { nodes: CanvasElement[] }[] };
    };
    const elements: CanvasElement[] = [...(projectData.canvasLayout?.elements || [])];
    for (const board of projectData.canvasLayout?.boards || []) {
      elements.push(...(board.nodes || []));
    }
    if (elements.length === 0) continue;

    const { tasks } = queryTasks(elements, FEED_QUERY);
    for (const task of tasks) {
      items.push({ task, projectName: row.name });
    }
  }

  return { ok: true, body: buildICSCalendar(items) };
}

function icsHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename=cxd-tasks.ics',
    'Cache-Control': 'private, max-age=300',
  };
}

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const result = await loadCalendarBody(params.token);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return new NextResponse(result.body, { status: 200, headers: icsHeaders() });
  } catch (error) {
    console.error('[calendar/feed] Error building calendar feed:', error);
    return NextResponse.json({ error: 'Failed to load calendar feed' }, { status: 500 });
  }
}

// Calendar apps (Apple Calendar, Google Calendar, Outlook) commonly probe a
// feed URL with HEAD before the first GET, to validate reachability/headers
// without pulling the body. Mirror GET's status/headers with an empty body.
export async function HEAD(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const result = await loadCalendarBody(params.token);
    if (!result.ok) {
      return new NextResponse(null, { status: result.status });
    }
    return new NextResponse(null, { status: 200, headers: icsHeaders() });
  } catch (error) {
    console.error('[calendar/feed] Error handling HEAD:', error);
    return new NextResponse(null, { status: 500 });
  }
}
