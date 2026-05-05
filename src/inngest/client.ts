// Inngest client — singleton.
//
// In dev, the Inngest CLI (`npx inngest-cli@latest dev`) auto-discovers our
// /api/inngest endpoint and runs functions locally. No keys needed for dev.
//
// In production, INNGEST_EVENT_KEY (events) + INNGEST_SIGNING_KEY (request
// auth) are read from Vercel env vars.

import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'cxd',
  // Event/signing keys are picked up automatically from env when set.
});
