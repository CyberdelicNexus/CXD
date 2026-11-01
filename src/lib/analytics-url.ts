/**
 * Strips what must never reach a third-party analytics service from a page URL:
 * the query string and fragment (invite and unsubscribe links carry secrets there),
 * and secret or user-specific path segments. Pure, so it can be verified without a browser.
 */

const REDACTED_PATHS: { pattern: RegExp; replacement: string }[] = [
  // Share links: the token is the access credential.
  { pattern: /^(\/cxd\/share\/)[^/]+/i, replacement: '$1[token]' },
  // Project ids identify a customer's canvas.
  { pattern: /^(\/cxd\/overview\/)[^/]+/i, replacement: '$1[id]' },
  // Admin pages for one user or ticket: the id is another person's record.
  { pattern: /^(\/admin\/(?:users|support)\/)[^/]+/i, replacement: '$1[id]' },
];

export function redactAnalyticsUrl(url: string): string {
  const cut = url.search(/[?#]/);
  const clean = cut === -1 ? url : url.slice(0, cut);
  const schemeEnd = clean.indexOf('://');
  const pathStart = schemeEnd === -1 ? 0 : clean.indexOf('/', schemeEnd + 3);
  if (pathStart === -1) return clean;
  const origin = clean.slice(0, pathStart);
  let path = clean.slice(pathStart);
  for (const { pattern, replacement } of REDACTED_PATHS) path = path.replace(pattern, replacement);
  return origin + path;
}
