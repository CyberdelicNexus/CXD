import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';

export const dynamic = 'force-dynamic';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Admin client for bypassing RLS
function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// GET - Fetch user's projects (owned + collaborated)
// Supports ?listing=true to exclude heavy project_data column (dashboard only)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isListing = searchParams.get('listing') === 'true';

    // For listing mode, select only the columns the dashboard needs.
    // coverImage lives inside project_data JSONB, so we extract it with the arrow operator.
    const selectFields = isListing
      ? 'id, owner_id, name, description, share_token, created_at, updated_at, project_data->>coverImage'
      : '*';

    // Check for required environment variable
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured');
      return NextResponse.json(
        { error: 'Server configuration error', projects: [] },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentication error', projects: [] },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', projects: [] },
        { status: 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch owned projects and collaborator IDs in parallel
    const [
      { data: ownedData, error: ownedError },
      { data: collabData, error: collabError },
    ] = await Promise.all([
      supabaseAdmin
        .from('cxd_projects')
        .select(selectFields)
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false }),
      supabaseAdmin
        .from('canvas_collaborators')
        .select('canvas_id')
        .eq('user_id', user.id),
    ]);

    if (ownedError) console.error('Error fetching owned projects:', ownedError);
    if (collabError) console.error('Error fetching collaborator records:', collabError);

    // Fetch collaborated projects only if the user has any (depends on collabData)
    const collabCanvasIds = (collabData || []).map((c: { canvas_id: string }) => c.canvas_id);
    let collaboratedProjects: any[] = [];
    if (collabCanvasIds.length > 0) {
      const { data: collabProjects, error: collabProjectsError } = await supabaseAdmin
        .from('cxd_projects')
        .select(selectFields)
        .in('id', collabCanvasIds)
        .neq('owner_id', user.id)
        .order('updated_at', { ascending: false });

      if (collabProjectsError) {
        console.error('Error fetching collaborated projects:', collabProjectsError);
      } else {
        collaboratedProjects = collabProjects || [];
      }
    }

    // Combine owned and collaborated projects
    const allProjects = [...(ownedData || []), ...collaboratedProjects];

    // Transform to CXDProject format
    const projects = allProjects.map((row: any) => {
      if (isListing) {
        // Listing mode: no project_data spread, just top-level columns.
        // coverImage was extracted via project_data->coverImage.
        // _listingOnly flag prevents accidental overwrites by useProjectSync.
        return {
          id: row.id,
          ownerId: row.owner_id,
          name: row.name,
          description: row.description,
          shareToken: row.share_token || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          coverImage: row.coverImage || undefined,
          _listingOnly: true,
        };
      }
      const projectData = row.project_data || {};
      return {
        ...projectData,
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        description: row.description,
        shareToken: row.share_token || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
