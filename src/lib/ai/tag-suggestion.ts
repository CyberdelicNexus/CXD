// Shared schema + helpers for AI-suggested Hypercube tagging.
// The client extracts untagged elements' text and sends them to
// /api/ai/suggest-tags; the model classifies each into hypercube faces;
// the server validates the returned tags against the known enum before
// anything reaches the client. Propose-only — nothing is auto-applied.

import { z } from 'zod';
import { HYPERCUBE_FACE_TAGS } from '@/types/canvas-elements';
import type { CanvasElement, HypercubeFaceTag } from '@/types/canvas-elements';

// One item sent for classification: the element id + its extracted text.
export interface TaggableItem {
  id: string;
  text: string;
}

// Bounds — keep a batch cheap and prompt-safe.
export const MAX_TAGGABLE_ITEMS = 40;
export const MAX_ITEM_TEXT = 500;

export const tagSuggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        id: z.string().describe('The element id, copied verbatim from the input'),
        tags: z
          .array(z.enum(HYPERCUBE_FACE_TAGS as unknown as [string, ...string[]]))
          .max(2)
          .describe('0-2 hypercube faces this element belongs to; omit weak matches'),
        reason: z.string().nullable().describe('Short justification (a few words)'),
      })
    )
    .describe('One entry per input element you can confidently classify'),
});

export type TagSuggestion = { id: string; tags: HypercubeFaceTag[]; reason: string | null };

const FACE_TAG_SET = new Set<string>(HYPERCUBE_FACE_TAGS);

/** Strip a validated model response down to known ids/tags. */
export function sanitizeSuggestions(
  raw: z.infer<typeof tagSuggestionSchema>['suggestions'],
  validIds: Set<string>
): TagSuggestion[] {
  const seen = new Set<string>();
  const out: TagSuggestion[] = [];
  for (const s of raw) {
    if (!validIds.has(s.id) || seen.has(s.id)) continue;
    const tags = Array.from(new Set(s.tags)).filter((t): t is HypercubeFaceTag =>
      FACE_TAG_SET.has(t)
    );
    if (tags.length === 0) continue;
    seen.add(s.id);
    out.push({ id: s.id, tags, reason: s.reason });
  }
  return out;
}

/** Human-readable meaning of each face, used to steer the classifier. */
const FACE_GUIDE = `
- "Reality Planes": the medium/technology of delivery — physical space, VR, AR, mixed, generative/AI, biometric, or cognitive/imaginative reality.
- "Sensory Domains": what participants see, hear, smell, taste, or touch — sensory and aesthetic detail.
- "Presence Types": how present the participant feels — mental, emotional, social, embodied, environmental, or active engagement.
- "State Mapping": transient states the experience induces in the moment — cognitive, emotional, somatic, or relational.
- "Trait Mapping": lasting change or transformation carried away afterward — durable shifts in perspective, capacity, habit, or relating.
- "Meaning Architecture": narrative and meaning — the world/setting, the story arc, and the "magic" mechanism that ties them together.
- "Core": the central intention — project vision, main concept, or core message that everything orbits.`;

export const TAG_SUGGESTION_SYSTEM_PROMPT =
  "You are the CXD tagging assistant. You classify canvas elements from an experience-design " +
  "workspace onto the faces of a conceptual \"hypercube\". Assign each element to the 1-2 faces " +
  "it most clearly belongs to; if an element is generic or ambiguous, assign no faces rather " +
  "than guessing. Never invent a face name outside the provided list.\n\nThe faces:" +
  FACE_GUIDE;

/** Build the user prompt listing the elements to classify. */
export function buildTagSuggestionPrompt(items: TaggableItem[]): string {
  const lines = items.map((it) => `- id: ${it.id}\n  text: ${JSON.stringify(it.text)}`);
  return (
    "Classify each of the following canvas elements onto hypercube faces. " +
    "Return the element id verbatim. Skip any element you cannot confidently place.\n\n" +
    lines.join('\n')
  );
}

/** Strip HTML tags to plain text (for noteBody, which is stored as HTML). */
function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract classification-worthy text from any element type. */
export function extractElementText(el: CanvasElement): string {
  const parts: string[] = [];
  const anyEl = el as unknown as Record<string, unknown>;
  const pushStr = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) parts.push(v.trim());
  };

  pushStr(anyEl.noteTitle);
  pushStr(anyEl.title);
  pushStr(anyEl.label);
  pushStr(anyEl.content);
  if (typeof anyEl.noteBody === 'string' && anyEl.noteBody.trim()) {
    parts.push(htmlToText(anyEl.noteBody));
  }
  pushStr(anyEl.description);
  pushStr(anyEl.alt);

  const combined = parts.join(' — ');
  return combined.length > MAX_ITEM_TEXT ? combined.slice(0, MAX_ITEM_TEXT) : combined;
}

/**
 * Collect canvas-surface elements that are untagged and carry meaningful text.
 * Excludes hypercube-surface nodes and inbox items.
 */
export function collectUntaggedItems(elements: CanvasElement[]): {
  items: TaggableItem[];
  total: number;
} {
  const candidates = elements.filter(
    (el) =>
      el.surface !== 'hypercube' &&
      !el.inInbox &&
      (!el.hypercubeTags || el.hypercubeTags.length === 0)
  );
  const items: TaggableItem[] = [];
  for (const el of candidates) {
    const text = extractElementText(el);
    if (text.length >= 3) items.push({ id: el.id, text });
  }
  return { items: items.slice(0, MAX_TAGGABLE_ITEMS), total: items.length };
}
