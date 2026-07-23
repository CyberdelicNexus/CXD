// Free-tier canvas quota — Milanote-style capacity limit.
//
// Philosophy: gate CAPACITY, not features. Free users see the whole product
// but run out of room; by the time they hit the wall they've built something
// they don't want to abandon.
//
// Only CONTENT atoms count against the quota: cards (notes/tasks/docs),
// images/storyboards, links/files, and tables. Structure is always free —
// text labels, shapes, lines, connectors, containers, boards, experience
// blocks, comments — because punishing *organizing* is anti-craft, and
// because templates are mostly structure (a 45-element template has a
// counted footprint of ~12-15, so one insert doesn't eat the whole quota).
//
// The cap applies only to canvases the free user OWNS. A free collaborator
// on a Pro user's canvas is never capped (the owner's plan governs the
// canvas) — enforced by QuotaGovernor only arming the quota when
// project.ownerId === current user id.
//
// Enforcement is add-time only and never destructive: existing over-quota
// canvases keep everything (grandfathered); the user just can't add more
// counted objects until they delete some or upgrade.

import type { CanvasElement } from '@/types/canvas-elements';

/** Element types that count against the free-tier object quota. */
export const QUOTA_COUNTED_TYPES: ReadonlySet<string> = new Set([
  'freeform', // note / task / doc cards
  'image',    // images & storyboard cards
  'link',     // link bookmarks & file uploads
  'table',
]);

export function isQuotaCounted(type: string): boolean {
  return QUOTA_COUNTED_TYPES.has(type);
}

/** Count the quota-relevant objects in a project's element list. */
export function countQuotaObjects(elements: readonly CanvasElement[] | undefined | null): number {
  if (!elements || elements.length === 0) return 0;
  let n = 0;
  for (const el of elements) {
    if (QUOTA_COUNTED_TYPES.has(el.type)) n++;
  }
  return n;
}

/** Human-readable label for what counts — keep pricing copy in sync with QUOTA_COUNTED_TYPES. */
export const QUOTA_OBJECT_LABEL = 'cards, images, links & tables';
