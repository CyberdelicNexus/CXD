import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { getPlan } from '@/lib/plans';
import { queryTasks } from '@/utils/task-engine';
import type { CanvasElement } from '@/types/canvas-elements';
import type { TaskQuery } from '@/types/plan-types';

export const dynamic = 'force-dynamic';

// Same default filter used by the single-project Plan tab (use-plan-tasks.ts)
// — every qualifying card, completed included, so callers can filter client-side.
const DEFAULT_QUERY: TaskQuery = {
  filter: {
    showCompleted: true,
    includeImplicitTasks: true,
    includeExplicitTasks: true,
    includeTaggedCards: true,
  },
  sort: [
    { field: 'priority', direction: 'desc' },
    { field: 'dueDate', direction: 'asc' },
  ],
};

export interface MasterPlanTaskItem {
  task: ReturnType<typeof queryTasks>['tasks'][number];
  projectId: string;
  projectName: string;
}

/**
 * GET /api/master-plan/tasks — every task across every project the user owns
 * or collaborates on (Pro feature). Tasks are a projection over canvas
 * elements (see task-engine.ts), not a DB table, so this fetches each
 * project's full canvasLayout and runs the same query engine the single-
 * project Plan tab uses, then tags each result with its source project.
 *
 * Known cost: pulls full project_data JSONB per project (no lightweight
 * path exists for task data specifically) — fine at current scale, worth
 * revisiting (a server-side task index/materialized view) if project counts
 * or canvas sizes grow much further.
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

    // Pro gate
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .single();
    const planId = subscription?.plan_id || 'free';
    const plan = getPlan(planId);
    if (!plan.limits.hasMasterPlan) {
      return NextResponse.json(
        { error: 'Master Plan is a Pro feature. Upgrade to access it.' },
        { status: 403 }
      );
    }

    // Owned + collaborated projects, full project_data (mirrors /api/projects
    // non-listing path — task data lives inside canvasLayout, so it can't be
    // trimmed at the column level the way the dashboard listing is).
    const [
      { data: ownedData, error: ownedError },
      { data: collabData, error: collabError },
    ] = await Promise.all([
      supabaseAdmin
        .from('cxd_projects')
        .select('id, owner_id, name, project_data')
        .eq('owner_id', user.id),
      supabaseAdmin
        .from('canvas_collaborators')
        .select('canvas_id')
        .eq('user_id', user.id),
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

    const items: MasterPlanTaskItem[] = [];
    const projects: { id: string; name: string }[] = [];

    for (const row of allRows) {
      const projectData = (row.project_data || {}) as {
        canvasLayout?: { elements?: CanvasElement[]; boards?: { nodes: CanvasElement[] }[] };
      };
      const elements: CanvasElement[] = [...(projectData.canvasLayout?.elements || [])];
      for (const board of projectData.canvasLayout?.boards || []) {
        elements.push(...(board.nodes || []));
      }
      if (elements.length === 0) continue;

      const { tasks } = queryTasks(elements, DEFAULT_QUERY);
      if (tasks.length === 0) continue;

      projects.push({ id: row.id, name: row.name });
      for (const task of tasks) {
        items.push({ task, projectId: row.id, projectName: row.name });
      }
    }

    return NextResponse.json({ items, projects });
  } catch (error) {
    console.error('[master-plan] Error aggregating tasks:', error);
    return NextResponse.json({ error: 'Failed to load Master Plan tasks' }, { status: 500 });
  }
}
