import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getPlan } from '@/lib/plans';
import { Resend } from 'resend';

// Admin client for checking subscriptions and sending invites
function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// POST - Create new invitation
export async function POST(request: Request) {
  try {
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
        { error: `Database error: ${canvasError.message}` },
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

    // Send invitation email using Resend
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'CXD Canvas <noreply@cyberdelic.design>',
          to: email.toLowerCase(),
          subject: `${inviterName} invited you to collaborate on "${canvas.name}"`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
                  <tr>
                    <td align="center">
                      <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                        <!-- Header -->
                        <tr>
                          <td style="padding: 40px 40px 20px; text-align: center;">
                            <h1 style="margin: 0; color: #fff; font-size: 28px; font-weight: 600;">You're Invited!</h1>
                          </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                          <td style="padding: 20px 40px;">
                            <p style="margin: 0 0 20px; color: #a0a0b0; font-size: 16px; line-height: 1.6;">
                              <strong style="color: #fff;">${inviterName}</strong> has invited you to collaborate on their canvas:
                            </p>
                            <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.1);">
                              <h2 style="margin: 0; color: #10b981; font-size: 22px; font-weight: 600;">${canvas.name}</h2>
                            </div>
                            <p style="margin: 0 0 30px; color: #a0a0b0; font-size: 14px; line-height: 1.6;">
                              As a collaborator, you'll be able to view and edit this canvas in real-time with the team.
                            </p>
                          </td>
                        </tr>
                        <!-- Button -->
                        <tr>
                          <td style="padding: 0 40px 40px; text-align: center;">
                            <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);">
                              Accept Invitation
                            </a>
                          </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                          <td style="padding: 20px 40px 30px; border-top: 1px solid rgba(255,255,255,0.1);">
                            <p style="margin: 0; color: #6b6b7b; font-size: 12px; text-align: center;">
                              This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
                            </p>
                          </td>
                        </tr>
                      </table>
                      <!-- Brand -->
                      <p style="margin: 20px 0 0; color: #4b4b5b; font-size: 12px;">
                        Sent from <a href="${baseUrl}" style="color: #10b981; text-decoration: none;">CXD Canvas</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
          `,
        });

        console.log(`Invitation email sent to ${email}`);
      } catch (emailError) {
        // Log but don't fail the request if email fails
        console.error('Failed to send invitation email:', emailError);
      }
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
