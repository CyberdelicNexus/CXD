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

// GET - List collaborators for a canvas
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

    // Check if user has access to this canvas
    const { data: canvas, error: canvasError } = await supabaseAdmin
      .from('cxd_projects')
      .select('id, owner_id, name')
      .eq('id', canvasId)
      .single();

    if (canvasError || !canvas) {
      return NextResponse.json(
        { error: 'Canvas not found' },
        { status: 404 }
      );
    }

    // Check if user is owner or collaborator
    const { data: userCollab } = await supabaseAdmin
      .from('canvas_collaborators')
      .select('role')
      .eq('canvas_id', canvasId)
      .eq('user_id', user.id)
      .single();

    const isOwner = canvas.owner_id === user.id;
    const isCollaborator = !!userCollab;

    if (!isOwner && !isCollaborator) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get all collaborators with user info
    const { data: collaborators, error: collabError } = await supabaseAdmin
      .from('canvas_collaborators')
      .select('id, user_id, role, added_at')
      .eq('canvas_id', canvasId)
      .order('added_at', { ascending: true });

    if (collabError) {
      console.error('Error fetching collaborators:', collabError);
      return NextResponse.json(
        { error: 'Failed to fetch collaborators' },
        { status: 500 }
      );
    }

    // Get user details for each collaborator PLUS the owner
    const collaboratorUserIds = collaborators?.map(c => c.user_id) || [];
    const allUserIds = Array.from(new Set([canvas.owner_id, ...collaboratorUserIds]));
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, email, name, avatar_url')
      .in('id', allUserIds);

    // Merge user data with collaborator data
    const collaboratorsWithUsers = collaborators?.map(collab => {
      const userData = users?.find(u => u.id === collab.user_id);
      return {
        id: collab.id,
        userId: collab.user_id,
        role: collab.role,
        addedAt: collab.added_at,
        email: userData?.email || 'Unknown',
        name: userData?.name || userData?.email?.split('@')[0] || 'Unknown',
        avatarUrl: userData?.avatar_url,
      };
    }) || [];

    // Always include the owner at the top of the list, even if they're not in canvas_collaborators
    const ownerAlreadyInList = collaboratorsWithUsers.some(c => c.userId === canvas.owner_id);
    if (!ownerAlreadyInList) {
      const ownerData = users?.find(u => u.id === canvas.owner_id);
      collaboratorsWithUsers.unshift({
        id: `owner-${canvas.owner_id}`,
        userId: canvas.owner_id,
        role: 'owner',
        addedAt: new Date().toISOString(),
        email: ownerData?.email || 'Unknown',
        name: ownerData?.name || ownerData?.email?.split('@')[0] || 'Unknown',
        avatarUrl: ownerData?.avatar_url,
      });
    }

    return NextResponse.json({
      collaborators: collaboratorsWithUsers,
      isOwner,
      canvasName: canvas.name,
    });
  } catch (error) {
    console.error('Get collaborators error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collaborators' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a collaborator
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get('canvasId');
    const userId = searchParams.get('userId');

    if (!canvasId || !userId) {
      return NextResponse.json(
        { error: 'Missing canvasId or userId' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get canvas info
    const { data: canvas } = await supabaseAdmin
      .from('cxd_projects')
      .select('owner_id')
      .eq('id', canvasId)
      .single();

    if (!canvas) {
      return NextResponse.json(
        { error: 'Canvas not found' },
        { status: 404 }
      );
    }

    const isOwner = canvas.owner_id === user.id;
    const isRemovingSelf = userId === user.id;

    // Only owner can remove others, anyone can remove themselves
    if (!isOwner && !isRemovingSelf) {
      return NextResponse.json(
        { error: 'Only canvas owners can remove collaborators' },
        { status: 403 }
      );
    }

    // Prevent owner from removing themselves
    if (isOwner && isRemovingSelf) {
      return NextResponse.json(
        { error: 'Canvas owners cannot remove themselves' },
        { status: 400 }
      );
    }

    // Get the collaborator record
    const { data: collab } = await supabaseAdmin
      .from('canvas_collaborators')
      .select('id, role')
      .eq('canvas_id', canvasId)
      .eq('user_id', userId)
      .single();

    if (!collab) {
      return NextResponse.json(
        { error: 'Collaborator not found' },
        { status: 404 }
      );
    }

    // Prevent removing the owner from collaborators table
    if (collab.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove canvas owner' },
        { status: 400 }
      );
    }

    // Remove the collaborator
    const { error: deleteError } = await supabaseAdmin
      .from('canvas_collaborators')
      .delete()
      .eq('id', collab.id);

    if (deleteError) {
      console.error('Error removing collaborator:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove collaborator' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: isRemovingSelf ? 'You have left the canvas' : 'Collaborator removed',
    });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    return NextResponse.json(
      { error: 'Failed to remove collaborator' },
      { status: 500 }
    );
  }
}
