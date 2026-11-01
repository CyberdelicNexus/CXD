/**
 * Analytics URL redaction.
 * Run: npx --yes tsx src/lib/admin/__verify__/analytics-url.verify.ts
 */
import { redactAnalyticsUrl } from '../../analytics-url';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}

const base = 'https://app.example.com';
check('share token replaced', redactAnalyticsUrl(`${base}/cxd/share/abc123SECRET`) === `${base}/cxd/share/[token]`);
check('share token with query', redactAnalyticsUrl(`${base}/cxd/share/abc123?x=1#y`) === `${base}/cxd/share/[token]`);
check('share trailing slash keeps shape', redactAnalyticsUrl(`${base}/cxd/share/abc/`) === `${base}/cxd/share/[token]/`);
check('relative share path', redactAnalyticsUrl('/cxd/share/abc') === '/cxd/share/[token]');
check('overview id replaced', redactAnalyticsUrl(`${base}/cxd/overview/proj-1`) === `${base}/cxd/overview/[id]`);
check("admin user id replaced", redactAnalyticsUrl(`${base}/admin/users/8f2c-uuid?tab=x`) === `${base}/admin/users/[id]`);
check("admin support id replaced", redactAnalyticsUrl(`${base}/admin/support/123`) === `${base}/admin/support/[id]`);
check('invite query stripped', redactAnalyticsUrl(`${base}/invite?token=SECRET`) === `${base}/invite`);
check('unsubscribe query stripped', redactAnalyticsUrl(`${base}/unsubscribe?t=SECRET&e=a@b.c`) === `${base}/unsubscribe`);
check('fragment stripped', redactAnalyticsUrl(`${base}/dashboard#access_token=SECRET`) === `${base}/dashboard`);
check('plain path unchanged', redactAnalyticsUrl(`${base}/dashboard`) === `${base}/dashboard`);
check('origin only unchanged', redactAnalyticsUrl(base) === base);
check('origin with query', redactAnalyticsUrl(`${base}?a=1`) === base);
check('share without token unchanged', redactAnalyticsUrl(`${base}/cxd/share`) === `${base}/cxd/share`);
check('case-insensitive', redactAnalyticsUrl(`${base}/CXD/Share/TOKEN`) === `${base}/CXD/Share/[token]`);
check('no secret survives', !redactAnalyticsUrl(`${base}/cxd/share/SECRET?token=SECRET#SECRET`).includes('SECRET'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
