import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { getPlan } from '@/lib/plans';

/**
 * POST /api/canvas/join
 *
 * Server-side share-link "join as collaborator" flow. The share page cannot
 * insert into canvas_collaborators from the browser — RLS only lets the OWNER
 * insert (there is no self-insert policy). This route mirrors
 * /api/canvas/invite/accept: it validates the share token against the project
 * with the service-role client (bypassing RLS), authenticates the caller,
 * enforces the owner's plan/collaborator cap, then inserts the collaborator row.
 *
 * Body: { token: string }  // the project's share_token
 */
export async function POST(request: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Missing share token' }, { status: 400 });
    }

    // Must be authenticated to join
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Validate the share token server-side against the project
    const { data: canvas, error: canvasError } = await supabaseAdmin
      .from('cxd_projects')
      .select('id, owner_id, name')
      .eq('share_token', token)
      .maybeSingle();

    if (canvasError) {
      console.error('Error looking up shared canvas:', canvasError);
      return NextResponse.json({ error: 'Failed to look up shared canvas' }, { status: 500 });
    }

    if (!canvas) {
      return NextResponse.json(
        { error: 'This share link may have expired or been revoked' },
        { status: 404 }
      );
    }

    // Owners don't need a collaborator row
    if (canvas.owner_id === user.id) {
      return NextResponse.json({ success: true, canvasId: canvas.id, message: 'You own this canvas' });
    }

    // Already a collaborator — idempotent success
    const { data: existingCollab } = await supabaseAdmin
      .from('canvas_collaborators')
      .select('id')
      .eq('canvas_id', canvas.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingCollab) {
      return NextResponse.json({
        success: true,
        canvasId: canvas.id,
        message: 'You are already a collaborator on this canvas',
      });
    }

    // Enforce the OWNER's plan and collaborator cap (mirrors invite/route.ts)
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', canvas.owner_id)
      .single();

    const planId = subscription?.plan_id || 'free';
    const plan = getPlan(planId);

    if (!plan.limits.hasCollaboration) {
      return NextResponse.json(
        { error: 'This canvas owner’s plan does not include collaboration' },
        { status: 403 }
      );
    }

    const { count: collaboratorCount } = await supabaseAdmin
      .from('canvas_collaborators')
      .select('*', { count: 'exact', head: true })
      .eq('canvas_id', canvas.id)
      .neq('role', 'owner');

    if ((collaboratorCount || 0) >= plan.limits.maxCollaborators) {
      return NextResponse.json(
        { error: `Maximum ${plan.limits.maxCollaborators} collaborators reached` },
        { status: 403 }
      );
    }

    // Insert the collaborator row (service role — bypasses RLS), same shape as
    // the invite/accept route.
    const { error: collabError } = await supabaseAdmin
      .from('canvas_collaborators')
      .insert({
        canvas_id: canvas.id,
        user_id: user.id,
        role: 'collaborator',
        added_by: canvas.owner_id,
      });

    if (collabError) {
      // Duplicate (race) is fine — treat as success
      if (!collabError.message?.includes('duplicate')) {
        console.error('Error creating collaborator via share link:', collabError);
        return NextResponse.json({ error: 'Failed to add collaborator' }, { status: 500 });
      }
    }

    // Notify the canvas owner that someone joined via the share link
    const { data: newCollabProfile } = await supabaseAdmin
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    const newCollabName =
      newCollabProfile?.name || newCollabProfile?.email?.split('@')[0] || 'Someone';

    if (canvas.owner_id) {
      const { error: notifError } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: canvas.owner_id,
          title: 'New Collaborator',
          message: `${newCollabName} joined your project "${canvas.name}" via share link`,
          type: 'success',
          is_global: false,
          metadata: {
            canvasId: canvas.id,
            canvasName: canvas.name,
            collaboratorId: user.id,
            collaboratorName: newCollabName,
          },
        });
      if (notifError) {
        console.error('Failed to notify owner of share-link join:', notifError);
      }
    }

    return NextResponse.json({
      success: true,
      canvasId: canvas.id,
      canvasName: canvas.name,
      message: 'You are now a collaborator on this canvas',
    });
  } catch (error) {
    console.error('Join canvas error:', error);
    return NextResponse.json({ error: 'Failed to join canvas' }, { status: 500 });
  }
}
