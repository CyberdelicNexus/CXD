import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { canvasId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const canvasId = body?.canvasId;
  if (typeof canvasId !== 'string' || !canvasId) {
    return NextResponse.json({ error: 'Missing canvasId' }, { status: 400 });
  }

  // Verify the canvas exists AND belongs to the caller.
  const { data: project, error: projErr } = await supabase
    .from('cxd_projects')
    .select('id, owner_id')
    .eq('id', canvasId)
    .maybeSingle();

  if (projErr || !project) {
    return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
  }

  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not your canvas' }, { status: 403 });
  }

  // Verify the subscription is on Free and hasn't already picked.
  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('plan_id, free_primary_canvas_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (subErr || !sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  if (sub.plan_id !== 'free') {
    return NextResponse.json(
      { error: 'Only Free tier users need to pick a primary canvas' },
      { status: 400 },
    );
  }

  if (sub.free_primary_canvas_id) {
    return NextResponse.json(
      { error: 'Primary canvas already chosen', chosenId: sub.free_primary_canvas_id },
      { status: 409 },
    );
  }

  const { error: updateErr } = await supabase
    .from('subscriptions')
    .update({ free_primary_canvas_id: canvasId })
    .eq('user_id', user.id);

  if (updateErr) {
    console.error('[free-primary-canvas] update failed:', updateErr);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, freePrimaryCanvasId: canvasId });
}
