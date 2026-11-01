'use client';

import { Analytics } from '@vercel/analytics/next';
import { redactAnalyticsUrl } from '@/lib/analytics-url';

/** Web Analytics with secrets removed from URLs before anything leaves the browser. */
export function PrivacyAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: redactAnalyticsUrl(event.url) })} />;
}
