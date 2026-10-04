'use client';

import { createClient } from '@/supabase/client';
import { CXDProject } from '@/types/cxd-schema';
import { fixDuplicateStageIds } from './fix-duplicate-stage-ids';
import { resolveCanvasAccess } from '@/lib/canvas-permissions';

export interface DbCXDProject {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  project_data: CXDProject;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

// Explicit columns: never pull `yjs_state` (a large base64 blob per project) into
// project listings. SupabasePersistence.load() fetches it for the open project only.
const PROJECT_COLUMNS = 'id, owner_id, name, description, project_data, share_token, created_at, updated_at';

export async function fetchUserProjects(userId: string): Promise<CXDProject[]> {
  const supabase = createClient();

  // Fetch owned projects and collaborator IDs in parallel
  const [
    { data: ownedData, error: ownedError },
    { data: collabData, error: collabError },
  ] = await Promise.all([
    supabase
      .from('cxd_projects')
      .select(PROJECT_COLUMNS)
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('canvas_collaborators')
      .select('canvas_id')
      .eq('user_id', userId),
  ]);

  if (ownedError) console.error('Error fetching owned projects:', ownedError);
  if (collabError) console.error('Error fetching collaborator records:', collabError);

  // Get the canvas IDs where user is a collaborator
  const collabCanvasIds = (collabData || []).map(c => c.canvas_id);

  // Fetch collaborated projects (excluding ones the user owns to avoid duplicates)
  let collaboratedProjects: DbCXDProject[] = [];
  if (collabCanvasIds.length > 0) {
    const { data: collabProjects, error: collabProjectsError } = await supabase
      .from('cxd_projects')
      .select(PROJECT_COLUMNS)
      .in('id', collabCanvasIds)
      .neq('owner_id', userId) // Exclude owned projects to avoid duplicates
      .order('updated_at', { ascending: false });

    if (collabProjectsError) {
      console.error('Error fetching collaborated projects:', collabProjectsError);
    } else {
      collaboratedProjects = collabProjects || [];
    }
  }

  // Combine owned and collaborated projects
  const allProjects = [...(ownedData || []), ...collaboratedProjects];

  return allProjects.map((row: DbCXDProject) => {
    // Full project data is stored in project_data, merge with top-level metadata
    const projectData = row.project_data || {};
    const project = {
      // Spread full project data first (preserves all nested structures)
      ...projectData,
      // Override with authoritative top-level fields
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      description: row.description,
      shareToken: row.share_token || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as CXDProject;

    // Fix duplicate stage IDs if any exist
    return fixDuplicateStageIds(project);
  });
}

export async function insertProject(project: CXDProject): Promise<boolean> {
  if (!project.ownerId || project.ownerId === 'local-user' || !isValidUUID(project.ownerId)) {
    console.warn('[insertProject] Skipping insert - invalid ownerId:', project.ownerId);
    return false;
  }

  if (!project.id || !isValidUUID(project.id)) {
    console.warn('[insertProject] Skipping insert - invalid project id:', project.id);
    return false;
  }

  console.log('[insertProject] Inserting new project:', project.id, 'Owner:', project.ownerId);

  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.warn('[insertProject] User not authenticated, skipping insert');
    return false;
  }

  const { error } = await supabase
    .from('cxd_projects')
    .insert({
      id: project.id,
      owner_id: project.ownerId,
      name: project.name,
      description: project.description || '',
      project_data: project,
      share_token: project.shareToken || null,
      created_at: project.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    const msg = String((error as any)?.message ?? '');
    if (msg.includes('Failed to fetch')) {
      console.warn('[insertProject] Network error - Failed to fetch');
      return false;
    }
    console.error('[insertProject] Error inserting project:', error);
    return false;
  }

  console.log('[insertProject] Successfully inserted project:', project.id);
  return true;
}

export async function saveProject(project: CXDProject): Promise<boolean> {
  // Never save listing-only stubs — they lack project_data and would overwrite full data
  if ((project as any)._listingOnly) {
    console.warn('[saveProject] Skipping save - listing-only project stub:', project.id);
    return false;
  }

  // Skip saving if ownerId is not a valid UUID (e.g., 'local-user')
  if (!project.ownerId || project.ownerId === 'local-user' || !isValidUUID(project.ownerId)) {
    console.warn('[saveProject] Skipping save - invalid ownerId:', project.ownerId);
    return false;
  }

  // Skip saving if project id is not valid UUID
  if (!project.id || !isValidUUID(project.id)) {
    console.warn('[saveProject] Skipping save - invalid project id:', project.id);
    return false;
  }

  // Guard: prevent overwriting a populated project with empty/default state.
  // This protects against auto-save firing before DB fetch hydrates the store.
  // Only skip if project has been updated before (not a brand new project) AND is now empty.
  const elements = project.canvasLayout?.elements;
  const hasContent = (elements && elements.length > 0) || !!(
    project.intentionCore?.projectName ||
    project.intentionCore?.mainConcept ||
    project.intentionCore?.coreMessage
  );
  if (!hasContent && project.updatedAt && project.updatedAt !== project.createdAt) {
    console.warn('[saveProject] Skipping save - previously populated project now appears empty, preventing overwrite. Project:', project.id);
    return false;
  }

  console.log('[saveProject] Saving project:', project.id, 'Owner:', project.ownerId);

  const supabase = createClient();

  // Check authentication first
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.warn('[saveProject] User not authenticated, skipping save');
    return false;
  }

  // Verify the authenticated user is either the owner or a collaborator
  if (user.id !== project.ownerId) {
    // Check if user is a collaborator
    const { data: collabData } = await supabase
      .from('canvas_collaborators')
      .select('id')
      .eq('canvas_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!collabData) {
      console.warn('[saveProject] User is neither owner nor collaborator - authenticated:', user.id, 'project owner:', project.ownerId);
      return false;
    }
    console.log('[saveProject] User is a verified collaborator (found in canvas_collaborators table)');
  }

  const access = await resolveCanvasAccess({
    supabase,
    canvasId: project.id,
    viewerUserId: user.id,
  });
  if (!access.canEdit) {
    console.warn(
      `[saveProject] Refusing write: canvas ${project.id} is not editable for user ${user.id} (locked=${access.isLocked})`,
    );
    return false;
  }

  // Store the complete project object in project_data
  // This ensures all fields including nested structures are persisted:
  // - intentionCore (projectName, mainConcept, coreMessage)
  // - desiredChange (insights, feelings, states, knowledge)
  // - contextAndMeaning (world, story, magic)
  // - humanContext (audienceNeeds, audienceDesires, userRole)
  // - realityPlanes, sensoryDomains, presenceTypes
  // - stateMapping, traitMapping
  // - experienceFlow (legacy) and experienceFlowStages (V2 with engagement, presence, narrative, time)
  // - wizard state

  // Use UPDATE instead of UPSERT to allow collaborators to save
  // UPSERT fails for collaborators because:
  // 1. UPSERT tries INSERT first
  // 2. INSERT policy requires auth.uid() = owner_id (collaborators fail here)
  // 3. Even though UPDATE policy allows collaborators, it never gets to try UPDATE
  // By using UPDATE directly, collaborators can save their changes
  const { error } = await supabase
    .from('cxd_projects')
    .update({
      name: project.name,
      description: project.description,
      project_data: project, // Full CXDProject object
      share_token: project.shareToken || null, // Persist share token
      updated_at: new Date().toISOString(),
    })
    .eq('id', project.id);

  if (error) {
    // In Tempo preview / blocked-network scenarios, Supabase calls can throw "TypeError: Failed to fetch".
    // Avoid spamming the console and keep the app usable by degrading gracefully.
    const msg = String((error as any)?.message ?? '');
    const details = String((error as any)?.details ?? '');
    const code = (error as any)?.code ?? '';

    if (msg.includes('Failed to fetch') || details.includes('Failed to fetch')) {
      console.warn('[saveProject] Network error - Failed to fetch');
      return false;
    }

    // Handle RLS policy violations more gracefully
    if (code === '42501' || msg.includes('row-level security')) {
      console.warn('[saveProject] Permission denied - RLS policy violation');
      return false;
    }

    console.error('[saveProject] Error saving project:', error);
    return false;
  }
  console.log('[saveProject] Successfully saved project:', project.id);
  return true;
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Update only top-level metadata columns (name, description, share_token) without
 * touching project_data. Safe to call with listing-only project stubs.
 * Also patches the corresponding fields inside the existing project_data JSONB
 * so the two stay in sync.
 */
export async function updateProjectMetadata(
  projectId: string,
  updates: { name?: string; description?: string; coverImage?: string; coverPosition?: { x: number; y: number } }
): Promise<boolean> {
  if (!projectId || !isValidUUID(projectId)) return false;

  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[updateProjectMetadata] No authenticated user — refusing update');
    return false;
  }
  const access = await resolveCanvasAccess({
    supabase,
    canvasId: projectId,
    viewerUserId: user.id,
  });
  if (!access.canEdit) {
    console.warn(
      `[updateProjectMetadata] Refusing: canvas ${projectId} is not editable for user ${user.id} (locked=${access.isLocked})`,
    );
    return false;
  }

  // Atomically merge the JSONB-side patch via patch_project_data RPC so concurrent
  // metadata edits don't drop each other's fields (the previous read-modify-write
  // pattern was a last-write-wins race).
  const jsonPatch: Record<string, any> = {};
  if (updates.coverImage !== undefined) jsonPatch.coverImage = updates.coverImage;
  if (updates.coverPosition !== undefined) jsonPatch.coverPosition = updates.coverPosition;
  if (updates.name !== undefined) jsonPatch.name = updates.name;
  if (updates.description !== undefined) jsonPatch.description = updates.description;

  if (Object.keys(jsonPatch).length > 0) {
    const { error: rpcError } = await supabase.rpc('patch_project_data', {
      p_id: projectId,
      p_patch: jsonPatch,
    });

    if (rpcError) {
      // If RPC isn't deployed yet, fall back to column-only update — JSONB stays stale
      // but we don't break the call site.
      const msg = rpcError.message || '';
      const code = rpcError.code || '';
      const isMissing =
        code === 'PGRST202' || code === 'PGRST205' || code === '42883' ||
        msg.includes('Could not find') || msg.includes('does not exist');
      if (!isMissing) {
        console.error('[updateProjectMetadata] patch_project_data RPC error:', rpcError);
        return false;
      }
      console.warn('[updateProjectMetadata] patch_project_data RPC missing — run migration. Falling back to column-only update.');
    }
  }

  // Column-level update for top-level columns (name, description). updated_at is
  // already touched by the RPC; this UPDATE refreshes it again which is harmless.
  const dbUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdate.name = updates.name;
  if (updates.description !== undefined) dbUpdate.description = updates.description;

  if (Object.keys(dbUpdate).length > 1) {
    const { error } = await supabase
      .from('cxd_projects')
      .update(dbUpdate)
      .eq('id', projectId);

    if (error) {
      console.error('[updateProjectMetadata] Error:', error);
      return false;
    }
  }

  return true;
}

export async function deleteProjectFromDb(projectId: string): Promise<boolean> {
  if (!projectId || !isValidUUID(projectId)) {
    return false;
  }

  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[deleteProjectFromDb] No authenticated user — refusing delete');
    return false;
  }
  const access = await resolveCanvasAccess({
    supabase,
    canvasId: projectId,
    viewerUserId: user.id,
  });
  if (access.isFreePrimary) {
    console.warn(
      `[deleteProjectFromDb] Refusing: canvas ${projectId} is user ${user.id}'s free-primary canvas`,
    );
    return false;
  }
  if (!access.canEdit) {
    console.warn(
      `[deleteProjectFromDb] Refusing: canvas ${projectId} is not editable for user ${user.id}`,
    );
    return false;
  }

  const { error } = await supabase
    .from('cxd_projects')
    .delete()
    .eq('id', projectId);

  if (error) {
    console.error('Error deleting project:', error);
    return false;
  }
  return true;
}

export async function fetchProjectById(projectId: string): Promise<CXDProject | null> {
  if (!projectId || !isValidUUID(projectId)) {
    return null;
  }
  
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cxd_projects')
    .select(PROJECT_COLUMNS)
    .eq('id', projectId)
    .single();

  if (error || !data) {
    console.error('Error fetching project:', error);
    return null;
  }

  const row = data as DbCXDProject;
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
  } as CXDProject;
}

export async function fetchProjectByShareToken(shareToken: string): Promise<CXDProject | null> {
  if (!shareToken) {
    return null;
  }
  
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cxd_projects')
    .select('*')
    .eq('share_token', shareToken)
    .single();

  if (error || !data) {
    console.error('Error fetching shared project:', error);
    return null;
  }

  const row = data as DbCXDProject;
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
  } as CXDProject;
}

export async function updateProjectShareToken(projectId: string, shareToken: string): Promise<boolean> {
  if (!projectId || !isValidUUID(projectId)) {
    return false;
  }
  
  const supabase = createClient();
  const { error } = await supabase
    .from('cxd_projects')
    .update({ share_token: shareToken, updated_at: new Date().toISOString() })
    .eq('id', projectId);

  if (error) {
    console.error('Error updating share token:', error);
    return false;
  }
  return true;
}

export async function ensureUserProfile(userId: string, email: string): Promise<boolean> {
  const supabase = createClient();
  
  // Check if profile exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();
  
  if (existing) {
    return true;
  }

  // Create profile
  const { error } = await supabase
    .from('users')
    .insert({
      id: userId,
      user_id: userId,
      email: email,
      token_identifier: email,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error creating user profile:', error);
    return false;
  }
  return true;
}
