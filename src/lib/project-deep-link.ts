/**
 * /cxd deep link: `/cxd?project=<uuid>[&view=wizard|canvas|focus]` (D182 §3).
 * `?id=` is accepted as an alias (the invite page and the dashboard navbar
 * already link that way). Pure, so it runs on the client and in __verify__.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VIEWS = ['wizard', 'canvas', 'focus'] as const;
export type DeepLinkView = (typeof VIEWS)[number];

export interface ProjectDeepLink {
  projectId: string;
  view: DeepLinkView | null;
  /** The same search string without `project` / `id` (leading "?" included, or ""). */
  remainingSearch: string;
}

export function readProjectDeepLink(search: string): ProjectDeepLink | null {
  const params = new URLSearchParams(search);
  const raw = params.get('project') ?? params.get('id');
  if (!raw || !UUID_RE.test(raw)) return null;
  const viewParam = params.get('view');
  const view = VIEWS.includes(viewParam as DeepLinkView) ? (viewParam as DeepLinkView) : null;
  params.delete('project');
  params.delete('id');
  const rest = params.toString();
  return { projectId: raw.toLowerCase(), view, remainingSearch: rest ? `?${rest}` : '' };
}
