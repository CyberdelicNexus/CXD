import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { getPlan } from '@/lib/plans';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/render';
import CanvasInviteEmail from '../../../../../emails/canvas-invite';

// POST - Create new invitation
export async function POST(request: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { canvasId, email } = await request.json();

    if (!canvasId || !email) {
      return NextResponse.json(
        { error: 'Missing canvasId or email' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Verify user is the canvas owner
    const { data: canvas, error: canvasError } = await supabaseAdmin
      .from('cxd_projects')
      .select('id, owner_id, name')
      .eq('id', canvasId)
      .maybeSingle();

    if (canvasError) {
      console.error('Error fetching canvas:', canvasError);
      return NextResponse.json(
        { error: 'Failed to fetch canvas. Please try again.' },
        { status: 500 }
      );
    }

    if (!canvas) {
      return NextResponse.json(
        { error: 'Canvas not found. The project may not have been saved to the database yet. Please try again in a moment.' },
        { status: 404 }
      );
    }

    if (canvas.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Only canvas owners can invite collaborators' },
        { status: 403 }
      );
    }

    // Check owner's subscription plan
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .single();

    const planId = subscription?.plan_id || 'free';
    const plan = getPlan(planId);

    if (!plan.limits.hasCollaboration) {
      return NextResponse.json(
        { error: 'Upgrade to Pro to invite collaborators' },
        { status: 403 }
      );
    }

    // Check current collaborator count
    const { count: collaboratorCount } = await supabaseAdmin
      .from('canvas_collaborators')
      .select('*', { count: 'exact', head: true })
      .eq('canvas_id', canvasId)
      .neq('role', 'owner');

    if ((collaboratorCount || 0) >= plan.limits.maxCollaborators) {
      return NextResponse.json(
        { error: `Maximum ${plan.limits.maxCollaborators} collaborators reached` },
        { status: 403 }
      );
    }

    // Check if user is already a collaborator
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      const { data: existingCollab } = await supabaseAdmin
        .from('canvas_collaborators')
        .select('id')
        .eq('canvas_id', canvasId)
        .eq('user_id', existingUser.id)
        .single();

      if (existingCollab) {
        return NextResponse.json(
          { error: 'User is already a collaborator' },
          { status: 400 }
        );
      }
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabaseAdmin
      .from('canvas_invitations')
      .select('id')
      .eq('canvas_id', canvasId)
      .eq('invited_email', email.toLowerCase())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 400 }
      );
    }

    // Create the invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('canvas_invitations')
      .insert({
        canvas_id: canvasId,
        invited_email: email.toLowerCase(),
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      );
    }

    // Generate invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';
    const inviteUrl = `${baseUrl}/invite?token=${invitation.token}`;

    // Get inviter's name for the email
    const { data: inviterProfile } = await supabaseAdmin
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    const inviterName = inviterProfile?.name || inviterProfile?.email?.split('@')[0] || 'Someone';

    // Create in-app notification for the invited user (if they have an account)
    if (existingUser) {
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: existingUser.id,
          title: 'Collaboration Invitation',
          message: `${inviterName} invited you to collaborate on "${canvas.name}"`,
          type: 'info',
          is_global: false,
          metadata: {
            canvasId,
            canvasName: canvas.name,
            inviterId: user.id,
            inviterName,
            inviteToken: invitation.token,
            inviteUrl,
          },
        });
    }

    // Send invitation email using Resend + React Email
    try {
      const emailHtml = await render(
        CanvasInviteEmail({
          inviterName,
          canvasName: canvas.name,
          inviteUrl,
        })
      );

      await sendEmail({
        to: email.toLowerCase(),
        subject: `${inviterName} invited you to collaborate on "${canvas.name}"`,
        html: emailHtml,
      });

      console.log(`Invitation email sent to ${email}`);
    } catch (emailError) {
      // Log but don't fail the request if email fails
      console.error('Failed to send invitation email:', emailError);
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.invited_email,
        expiresAt: invitation.expires_at,
        inviteUrl,
      },
    });
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}

// GET - List invitations for a canvas
export async function GET(request: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get('canvasId');

    if (!canvasId) {
      return NextResponse.json(
        { error: 'Missing canvasId' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Verify user is the canvas owner
    const { data: canvas } = await supabaseAdmin
      .from('cxd_projects')
      .select('owner_id')
      .eq('id', canvasId)
      .single();

    if (!canvas || canvas.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Only canvas owners can view invitations' },
        { status: 403 }
      );
    }

    // Get pending invitations
    const { data: invitations, error } = await supabaseAdmin
      .from('canvas_invitations')
      .select('id, invited_email, status, created_at, expires_at')
      .eq('canvas_id', canvasId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch invitations' },
        { status: 500 }
      );
    }

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Get invitations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}

// DELETE - Revoke an invitation
export async function DELETE(request: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('invitationId');

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Missing invitationId' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get the invitation and verify ownership
    const { data: invitation } = await supabaseAdmin
      .from('canvas_invitations')
      .select('canvas_id')
      .eq('id', invitationId)
      .single();

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Verify user is canvas owner
    const { data: canvas } = await supabaseAdmin
      .from('cxd_projects')
      .select('owner_id')
      .eq('id', invitation.canvas_id)
      .single();

    if (!canvas || canvas.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Only canvas owners can revoke invitations' },
        { status: 403 }
      );
    }

    // Revoke the invitation
    const { error: updateError } = await supabaseAdmin
      .from('canvas_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId);

    if (updateError) {
      console.error('Error revoking invitation:', updateError);
      return NextResponse.json(
        { error: 'Failed to revoke invitation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Revoke invitation error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke invitation' },
      { status: 500 }
    );
  }
}
