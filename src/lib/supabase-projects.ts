'use client';

import { createClient } from '../../supabase/client';
import { CXDProject } from '@/types/cxd-schema';

export interface DbCXDProject {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  project_data: CXDProject;
  created_at: string;
  updated_at: string;
}

export async function fetchUserProjects(userId: string): Promise<CXDProject[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cxd_projects')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    return [];
  }

  return (data || []).map((row: DbCXDProject) => {
    // Full project data is stored in project_data, merge with top-level metadata
    const projectData = row.project_data || {};
    return {
      // Spread full project data first (preserves all nested structures)
      ...projectData,
      // Override with authoritative top-level fields
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as CXDProject;
  });
}

export async function saveProject(project: CXDProject): Promise<boolean> {
  // Skip saving if ownerId is not a valid UUID (e.g., 'local-user')
  if (!project.ownerId || project.ownerId === 'local-user' || !isValidUUID(project.ownerId)) {
    return false;
  }
  
  // Skip saving if project id is not valid UUID
  if (!project.id || !isValidUUID(project.id)) {
    return false;
  }
  
  const supabase = createClient();
  
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
  const { error } = await supabase
    .from('cxd_projects')
    .upsert({
      id: project.id,
      owner_id: project.ownerId,
      name: project.name,
      description: project.description,
      project_data: project, // Full CXDProject object
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) {
    console.error('Error saving project:', error);
    return false;
  }
  return true;
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function deleteProjectFromDb(projectId: string): Promise<boolean> {
  if (!projectId || !isValidUUID(projectId)) {
    return false;
  }
  
  const supabase = createClient();
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
    .select('*')
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as CXDProject;
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
