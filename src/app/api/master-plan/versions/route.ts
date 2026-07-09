import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { getPlan } from '@/lib/plans';
import type { Version, OKR } from '@/types/version-types';

export const dynamic = 'force-dynamic';

export interface MasterPlanVersionItem {
  version: Version;
  projectId: string;
  projectName: string;
}

/**
 * GET /api/master-plan/versions — every version (+ its OKRs) across every
 * project the user owns or collaborates on. Powers the cross-project
 * Roadmap view. Same owned+collaborated union query as
 * /api/master-plan/tasks — versions/okrs live in project_data.versions /
 * project_data.okrs, same JSONB the task aggregator already reads.
 */
export async function GET() {
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

    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .single();
    const plan = getPlan(subscription?.plan_id || 'free');
    if (!plan.limits.hasMasterPlan) {
      return NextResponse.json({ error: 'Master Plan is a Pro feature. Upgrade to access it.' }, { status: 403 });
    }

    const [
      { data: ownedData, error: ownedError },
      { data: collabData, error: collabError },
    ] = await Promise.all([
      supabaseAdmin.from('cxd_projects').select('id, owner_id, name, project_data').eq('owner_id', user.id),
      supabaseAdmin.from('canvas_collaborators').select('canvas_id').eq('user_id', user.id),
    ]);

    if (ownedError) console.error('[master-plan] owned projects error:', ownedError);
    if (collabError) console.error('[master-plan] collaborator lookup error:', collabError);

    const collabCanvasIds = (collabData || []).map((c: { canvas_id: string }) => c.canvas_id);
    let collaboratedRows: { id: string; owner_id: string; name: string; project_data: unknown }[] = [];
    if (collabCanvasIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('cxd_projects')
        .select('id, owner_id, name, project_data')
        .in('id', collabCanvasIds)
        .neq('owner_id', user.id);
      if (error) console.error('[master-plan] collaborated projects error:', error);
      else collaboratedRows = data || [];
    }

    const allRows = [...(ownedData || []), ...collaboratedRows];

    const versions: MasterPlanVersionItem[] = [];
    const okrs: (OKR & { projectId: string })[] = [];

    for (const row of allRows) {
      const projectData = (row.project_data || {}) as { versions?: Version[]; okrs?: OKR[] };
      for (const version of projectData.versions || []) {
        versions.push({ version, projectId: row.id, projectName: row.name });
      }
      for (const okr of projectData.okrs || []) {
        okrs.push({ ...okr, projectId: row.id });
      }
    }

    return NextResponse.json({ versions, okrs });
  } catch (error) {
    console.error('[master-plan] Error aggregating versions:', error);
    return NextResponse.json({ error: 'Failed to load Master Plan versions' }, { status: 500 });
  }
}
