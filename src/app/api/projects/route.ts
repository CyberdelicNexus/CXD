import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';
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
export async function GET() {
  try {
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

    // Fetch owned projects
    const { data: ownedData, error: ownedError } = await supabaseAdmin
      .from('cxd_projects')
      .select('*')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false });

    if (ownedError) {
      console.error('Error fetching owned projects:', ownedError);
    }

    // Fetch projects where user is a collaborator
    const { data: collabData, error: collabError } = await supabaseAdmin
      .from('canvas_collaborators')
      .select('canvas_id')
      .eq('user_id', user.id);

    if (collabError) {
      console.error('Error fetching collaborator records:', collabError);
    }

    // Get the canvas IDs where user is a collaborator
    const collabCanvasIds = (collabData || []).map((c: { canvas_id: string }) => c.canvas_id);

    // Fetch collaborated projects (excluding ones the user owns to avoid duplicates)
    let collaboratedProjects: any[] = [];
    if (collabCanvasIds.length > 0) {
      const { data: collabProjects, error: collabProjectsError } = await supabaseAdmin
        .from('cxd_projects')
        .select('*')
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
