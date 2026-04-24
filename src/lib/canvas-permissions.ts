import type { SupabaseClient } from '@supabase/supabase-js';

export type CanvasPermissionReason =
  | 'owner_downgraded_not_chosen'
  | 'owner_not_editable_tier'
  | null;

export interface CanvasAccess {
  canView: boolean;
  canEdit: boolean;
  canComment: boolean;
  canAddCollaborator: boolean;
  /** Canvas is locked because owner is Free and canvas isn't their chosen one */
  isLocked: boolean;
  /** This is the user's chosen free canvas */
  isFreePrimary: boolean;
  /** Is the caller the owner or a collaborator */
  role: 'owner' | 'collaborator' | 'none';
  reasonLocked: CanvasPermissionReason;
}

/**
 * Single source of truth for canvas access decisions. Callable from server
 * routes (pass the service-role client) or with a user-scoped client.
 *
 * The caller is responsible for having already authenticated `viewerUserId`
 * against the session — this helper doesn't verify identity, only derives
 * permissions from stored state.
 */
export async function resolveCanvasAccess(opts: {
  supabase: SupabaseClient;
  canvasId: string;
  viewerUserId: string;
}): Promise<CanvasAccess> {
  const { supabase, canvasId, viewerUserId } = opts;

  const { data: project } = await supabase
    .from('cxd_projects')
    .select('id, owner_id')
    .eq('id', canvasId)
    .single();

  if (!project) {
    return {
      canView: false,
      canEdit: false,
      canComment: false,
      canAddCollaborator: false,
      isLocked: false,
      isFreePrimary: false,
      role: 'none',
      reasonLocked: null,
    };
  }

  const isOwner = project.owner_id === viewerUserId;

  let isCollaborator = false;
  if (!isOwner) {
    const { data: collab } = await supabase
      .from('canvas_collaborators')
      .select('user_id')
      .eq('canvas_id', canvasId)
      .eq('user_id', viewerUserId)
      .maybeSingle();
    isCollaborator = !!collab;
  }

  if (!isOwner && !isCollaborator) {
    return {
      canView: false,
      canEdit: false,
      canComment: false,
      canAddCollaborator: false,
      isLocked: false,
      isFreePrimary: false,
      role: 'none',
      reasonLocked: null,
    };
  }

  // Fetch the OWNER's subscription to decide lock state. This is correct
  // even when the viewer is a collaborator — collaborators follow the owner.
  const { data: ownerSub } = await supabase
    .from('subscriptions')
    .select('plan_id, free_primary_canvas_id')
    .eq('user_id', project.owner_id)
    .maybeSingle();

  const ownerPlan = ownerSub?.plan_id ?? 'free';
  const freePrimary = ownerSub?.free_primary_canvas_id ?? null;

  const isOwnerEditableTier =
    ownerPlan === 'pro' || ownerPlan === 'lifetime' || ownerPlan === 'beta_tester';

  const isFreePrimary = freePrimary === project.id;
  const isLocked = !isOwnerEditableTier && !isFreePrimary;

  const role: 'owner' | 'collaborator' = isOwner ? 'owner' : 'collaborator';

  if (isLocked) {
    return {
      canView: true,
      canEdit: false,
      canComment: false,
      canAddCollaborator: false,
      isLocked: true,
      isFreePrimary: false,
      role,
      reasonLocked: 'owner_downgraded_not_chosen',
    };
  }

  // Editable canvas. Collaborators still follow the owner's tier for
  // mutation rights; if owner is Free, collaborators are read-only even on
  // the free-primary canvas (Free has maxCollaborators = 0).
  if (!isOwnerEditableTier && role === 'collaborator') {
    return {
      canView: true,
      canEdit: false,
      canComment: true,  // commenting allowed on the owner's active canvas
      canAddCollaborator: false,
      isLocked: false,
      isFreePrimary,
      role,
      reasonLocked: 'owner_not_editable_tier',
    };
  }

  return {
    canView: true,
    canEdit: true,
    canComment: true,
    canAddCollaborator: isOwnerEditableTier && role === 'owner',
    isLocked: false,
    isFreePrimary,
    role,
    reasonLocked: null,
  };
}
