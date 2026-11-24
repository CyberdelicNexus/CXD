/**
 * GET /api/nexus/team-projects?ids=<uuid>,<uuid>… — the Nexus staff area's team projects and
 * their tasks (platform D337), server to server.
 *
 * Same auth, kill switch and rate limit as /api/nexus/projects: Bearer NEXUS_BRIDGE_TOKEN (or
 * _PREVIOUS), 404 while it is unset. At most 40 ids; an unknown id is simply absent. Tasks are
 * the Plan tab's projection, at most 300 per project. Never log the token, the ids or the answer.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { verifyNexusBridgeToken } from '@/lib/nexus/config';
import { checkNexusRateLimit } from '@/lib/nexus/nexus-rate-limit';
import { isUuid } from '@/lib/nexus/handoff';
import { buildTeamProject, parseTeamIds, type TeamSourceRow } from '@/lib/nexus/team';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function json(body: unknown, status = 200, extra: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extra } });
}

export async function GET(request: Request) {
  if (!process.env.NEXUS_BRIDGE_TOKEN) return json({}, 404);

  const auth = verifyNexusBridgeToken(request.headers.get('authorization'));
  if (!auth.ok) return json({}, auth.reason === 'not_configured' ? 404 : 401);

  const limit = await checkNexusRateLimit(auth.token);
  if (!limit.allowed) {
    const retry = Math.max(1, Math.ceil((limit.retryAfterMs ?? 60_000) / 1000));
    return json({}, 429, { 'Retry-After': String(retry) });
  }

  const ids = parseTeamIds(new URL(request.url).searchParams.get('ids'), isUuid);
  if (!ids) return json({}, 400);

  try {
    const admin = getSupabaseAdmin();
    const [projectsRes, collabRes] = await Promise.all([
      admin.from('cxd_projects').select('id, name, description, updated_at, project_data').in('id', ids),
      admin.from('canvas_collaborators').select('canvas_id').in('canvas_id', ids),
    ]);
    if (projectsRes.error || collabRes.error) return json({}, 502);

    const counts = new Map<string, number>();
    for (const row of collabRes.data || []) {
      const id = (row as { canvas_id: string }).canvas_id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const projects = ((projectsRes.data || []) as TeamSourceRow[]).map((row) => buildTeamProject(row, counts.get(row.id) ?? 1));
    return json({ projects });
  } catch {
    return json({}, 502);
  }
}
