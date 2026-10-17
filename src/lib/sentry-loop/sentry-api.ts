// Thin wrapper over the Sentry Web API for the self-correcting loop.
//
// Auth: a Sentry internal-integration / user auth token with `event:read` +
// `issue:write` scopes, stored as SENTRY_API_TOKEN. This is DISTINCT from
// SENTRY_AUTH_TOKEN (releases/source-maps, used by withSentryConfig) — keep the
// scopes minimal and separate.

const SENTRY_BASE = 'https://sentry.io/api/0';

export interface SentryIssue {
  id: string;
  shortId?: string;
  title?: string;
  culprit?: string;
  permalink?: string;
  level?: string;
  count?: string | number;
  userCount?: number;
  projectSlug?: string;
  metadata?: { value?: string; type?: string };
}

function token(): string {
  const t = process.env.SENTRY_API_TOKEN;
  if (!t) throw new Error('SENTRY_API_TOKEN is not set');
  return t;
}

async function sentryFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SENTRY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

/** Fetch full issue detail by numeric/opaque issue id. */
export async function fetchIssue(issueId: string): Promise<SentryIssue> {
  const res = await sentryFetch(`/issues/${issueId}/`);
  if (!res.ok) {
    throw new Error(`Sentry fetchIssue ${issueId} failed: ${res.status} ${await res.text()}`);
  }
  const j = (await res.json()) as Record<string, unknown>;
  return {
    id: String(j.id ?? issueId),
    shortId: j.shortId as string | undefined,
    title: j.title as string | undefined,
    culprit: j.culprit as string | undefined,
    permalink: j.permalink as string | undefined,
    level: j.level as string | undefined,
    count: j.count as string | number | undefined,
    userCount: j.userCount as number | undefined,
    projectSlug: (j.project as { slug?: string } | undefined)?.slug,
    metadata: j.metadata as SentryIssue['metadata'],
  };
}

/**
 * Snooze (ignore) an issue for a number of minutes — the Sentry-native snooze
 * that v1 established as the record of truth. Passing no duration ignores it
 * indefinitely (our "Ignore" action).
 */
export async function ignoreIssue(issueId: string, minutes?: number): Promise<void> {
  const statusDetails = minutes ? { ignoreDuration: minutes } : {};
  const res = await sentryFetch(`/issues/${issueId}/`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'ignored', statusDetails }),
  });
  if (!res.ok) {
    throw new Error(`Sentry ignoreIssue ${issueId} failed: ${res.status} ${await res.text()}`);
  }
}
