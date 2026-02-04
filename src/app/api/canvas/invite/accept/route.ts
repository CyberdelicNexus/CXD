import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Admin client for managing collaborators
function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// GET - Accept invitation with token
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Missing invitation token' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const supabaseAdmin = getSupabaseAdmin();

    // Validate the token
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('canvas_invitations')
      .select('id, canvas_id, invited_email, status, expires_at')
      .eq('token', token)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      );
    }

    // Check if invitation is still valid
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'This invitation has already been used or revoked' },
        { status: 400 }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await supabaseAdmin
        .from('canvas_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 400 }
      );
    }

    // If user is not logged in, return info for redirect
    if (!user) {
      // Get canvas name for the login page
      const { data: canvas } = await supabaseAdmin
        .from('cxd_projects')
        .select('name')
        .eq('id', invitation.canvas_id)
        .single();

      return NextResponse.json({
        requiresAuth: true,
        canvasName: canvas?.name || 'Canvas',
        invitedEmail: invitation.invited_email,
        token,
      });
    }

    // Verify the logged-in user's email matches the invitation
    // (allow case-insensitive comparison)
    if (user.email?.toLowerCase() !== invitation.invited_email.toLowerCase()) {
      return NextResponse.json({
        error: 'This invitation was sent to a different email address',
        invitedEmail: invitation.invited_email,
        currentEmail: user.email,
      }, { status: 403 });
    }

    // Check if user is already a collaborator
    const { data: existingCollab } = await supabaseAdmin
      .from('canvas_collaborators')
      .select('id')
      .eq('canvas_id', invitation.canvas_id)
      .eq('user_id', user.id)
      .single();

    if (existingCollab) {
      // Already a collaborator, just mark invitation as accepted
      await supabaseAdmin
        .from('canvas_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_by: user.id,
        })
        .eq('id', invitation.id);

      return NextResponse.json({
        success: true,
        canvasId: invitation.canvas_id,
        message: 'You are already a collaborator on this canvas',
      });
    }

    // Get the canvas owner (for added_by field)
    const { data: canvas } = await supabaseAdmin
      .from('cxd_projects')
      .select('owner_id, name')
      .eq('id', invitation.canvas_id)
      .single();

    // Create the collaborator record
    const { error: collabError } = await supabaseAdmin
      .from('canvas_collaborators')
      .insert({
        canvas_id: invitation.canvas_id,
        user_id: user.id,
        role: 'collaborator',
        added_by: canvas?.owner_id,
      });

    if (collabError) {
      console.error('Error creating collaborator:', collabError);
      return NextResponse.json(
        { error: 'Failed to accept invitation' },
        { status: 500 }
      );
    }

    // Mark invitation as accepted
    await supabaseAdmin
      .from('canvas_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      })
      .eq('id', invitation.id);

    // Get the new collaborator's name for the notification
    const { data: newCollabProfile } = await supabaseAdmin
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    const newCollabName = newCollabProfile?.name || newCollabProfile?.email?.split('@')[0] || 'Someone';

    // Notify the canvas owner that someone accepted their invitation
    if (canvas?.owner_id) {
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: canvas.owner_id,
          title: 'Invitation Accepted',
          message: `${newCollabName} accepted your invitation to collaborate on "${canvas.name}"`,
          type: 'success',
          is_global: false,
          metadata: {
            canvasId: invitation.canvas_id,
            canvasName: canvas.name,
            collaboratorId: user.id,
            collaboratorName: newCollabName,
            collaboratorEmail: user.email,
          },
        });
    }

    return NextResponse.json({
      success: true,
      canvasId: invitation.canvas_id,
      canvasName: canvas?.name,
      message: 'You are now a collaborator on this canvas',
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}

// POST - Accept invitation (alternative method for programmatic access)
export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Missing invitation token' },
        { status: 400 }
      );
    }

    // Reuse GET logic by creating a URL with the token
    const url = new URL(request.url);
    url.searchParams.set('token', token);

    const getRequest = new Request(url.toString(), {
      headers: request.headers,
    });

    return GET(getRequest);
  } catch (error) {
    console.error('Accept invitation POST error:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
