/**
 * Project listing for the Nexus dashboard grid (D182 §6), the intent
 * destinations (§3 step 6) and the server-side new-project row. Pure.
 */

import { canCreateCanvas, getPlan } from '@/lib/plans';
import { createDefaultProject } from '@/types/cxd-schema';

export const LISTING_CAP = 60;

export interface ListingSourceRow {
  id: string;
  name: string | null;
  description: string | null;
  updated_at: string;
  coverImage?: unknown;
  role: 'owner' | 'collaborator';
}

export interface ListedProject {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  coverImage: string | null;
  role: 'owner' | 'collaborator';
}

export interface ProjectListing {
  linked: boolean;
  plan: string | null;
  canCreate: boolean;
  projects: ListedProject[];
}

export const UNLINKED_LISTING: ProjectListing = Object.freeze({
  linked: false,
  plan: null,
  canCreate: true,
  projects: [],
}) as ProjectListing;

/** Only an absolute https: URL survives; data: URLs, http:, relative paths and anything else become null. */
export function safeCoverImage(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const KNOWN_PLANS = ['free', 'pro', 'lifetime', 'beta_tester'];

export function buildProjectListing(input: {
  plan: string | null | undefined;
  ownedCount: number;
  rows: ListingSourceRow[];
}): ProjectListing {
  const plan = input.plan && KNOWN_PLANS.includes(input.plan) ? input.plan : 'free';
  const seen = new Set<string>();
  const projects: ListedProject[] = [];
  for (const row of input.rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    projects.push({
      id: row.id,
      name: row.name ?? '',
      description: row.description ?? '',
      updatedAt: new Date(row.updated_at).toISOString(),
      coverImage: safeCoverImage(row.coverImage),
      role: row.role,
    });
  }
  projects.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return {
    linked: true,
    plan,
    canCreate: canCreateCanvas(plan, input.ownedCount),
    projects: projects.slice(0, LISTING_CAP),
  };
}

export function isAtCanvasLimit(plan: string | null | undefined, ownedCount: number): boolean {
  return ownedCount >= getPlan(plan || 'free').limits.maxCanvases;
}

/** The cxd_projects row insertProject() writes, built on the server (no yjs_state). */
export function buildNewProjectRow(id: string, name: string, ownerId: string, now: Date = new Date()) {
  const project = createDefaultProject(id, name, ownerId);
  const iso = now.toISOString();
  project.createdAt = iso;
  project.updatedAt = iso;
  return {
    id,
    owner_id: ownerId,
    name,
    description: '',
    project_data: project,
    share_token: null,
    created_at: iso,
    updated_at: iso,
  };
}

/** Where a resolved intent sends the browser. `access` is decided by the caller. */
export function destinationForProject(id: string, hasAccess: boolean): string {
  return hasAccess ? `/cxd?project=${id}` : '/dashboard';
}

export function destinationForNewProject(id: string): string {
  return `/cxd?project=${id}&view=wizard`;
}

export const UPGRADE_DESTINATION = '/dashboard?upgrade=canvas';

