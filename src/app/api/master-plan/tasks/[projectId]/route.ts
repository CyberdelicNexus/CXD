import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { getPlan } from '@/lib/plans';
import { resolveCanvasAccess } from '@/lib/canvas-permissions';
import { applyMasterPlanTaskPatch, type MasterPlanTaskPatch } from '@/lib/master-plan/apply-master-plan-task-patch';

export const dynamic = 'force-dynamic';

const ALLOWED_PATCH_KEYS = new Set([
  'title',
  'description',
  'status',
  'priority',
  'taskType',
  'dueDate',
  'startDate',
  'assignee',
  'estimatedHours',
  'tags',
  'hypercubeTags',
  'subtasks',
  'customProperties',
  'versionId',
  'isArchived',
]);
const STATUS_VALUES = new Set(['not_started', 'in_progress', 'completed', 'blocked']);
const PRIORITY_VALUES = new Set(['low', 'medium', 'high', 'urgent']);

function validatePatch(raw: unknown): { ok: true; patch: MasterPlanTaskPatch } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'patch must be an object' };
  }
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_PATCH_KEYS.has(key)) {
      return { ok: false, reason: `Unknown patch field: ${key}` };
    }
    patch[key] = value;
  }
  if (patch.status !== undefined && !STATUS_VALUES.has(patch.status as string)) {
    return { ok: false, reason: `Invalid status: ${patch.status}` };
  }
  if (patch.priority !== undefined && patch.priority !== null && !PRIORITY_VALUES.has(patch.priority as string)) {
    return { ok: false, reason: `Invalid priority: ${patch.priority}` };
  }
  if (patch.tags !== undefined && !Array.isArray(patch.tags)) {
    return { ok: false, reason: 'tags must be an array' };
  }
  if (patch.hypercubeTags !== undefined && !Array.isArray(patch.hypercubeTags)) {
    return { ok: false, reason: 'hypercubeTags must be an array' };
  }
  if (patch.subtasks !== undefined && !Array.isArray(patch.subtasks)) {
    return { ok: false, reason: 'subtasks must be an array' };
  }
  return { ok: true, patch: patch as MasterPlanTaskPatch };
}

/**
 * PATCH /api/master-plan/tasks/[projectId] — edit a single task that lives
 * inside this project's canvas data, from the cross-project Master Plan page
 * (no live Yjs connection to this project). See apply-master-plan-task-patch.ts
 * for why this goes through a server-side Y.Doc mutation rather than a plain
 * project_data JSONB patch.
 */
export async function PATCH(request: NextRequest, { params }: { params: { projectId: string } }) {
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

    const access = await resolveCanvasAccess({ supabase: supabaseAdmin, canvasId: params.projectId, viewerUserId: user.id });
    if (!access.canEdit) {
      return NextResponse.json({ error: 'You do not have edit access to this project.' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { taskId, patch: rawPatch } = (body || {}) as { taskId?: unknown; patch?: unknown };
    if (typeof taskId !== 'string' || !taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 422 });
    }
    const validated = validatePatch(rawPatch);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.reason }, { status: 422 });
    }

    const result = await applyMasterPlanTaskPatch({ projectId: params.projectId, taskId, patch: validated.patch });

    switch (result.outcome) {
      case 'applied':
        return NextResponse.json({ ok: true });
      case 'not_found':
        return NextResponse.json({ error: result.reason || 'Task not found' }, { status: 404 });
      case 'rejected':
        return NextResponse.json({ error: result.reason || 'Update rejected' }, { status: 409 });
      case 'unsupported':
        return NextResponse.json({ error: result.reason || 'Unsupported edit' }, { status: 422 });
      default:
        return NextResponse.json({ error: result.reason || 'Failed to update task' }, { status: 500 });
    }
  } catch (error) {
    console.error('[master-plan] Error applying task patch:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}
