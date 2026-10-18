// Inngest serve endpoint — handles function discovery, invocation, and
// signed-request validation. Inngest's dev CLI auto-pings this; in
// production, Inngest cloud sends signed POSTs here when events fire.

import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { inngestFunctions } from '@/inngest/functions';
import { sentryLoopFunctions } from '@/inngest/sentry-functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [...inngestFunctions, ...sentryLoopFunctions],
});
