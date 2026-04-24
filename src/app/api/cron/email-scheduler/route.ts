import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (authHeader !== expected) {
    return unauthorized();
  }

  const startedAt = Date.now();
  const results: Record<string, number> = {};

  // Scans get added in follow-up tasks:
  //   results.trialDay1 = await runTrialDay1Scan();
  //   results.paymentFinalWarning = await runPaymentFinalWarningScan();

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    results,
  });
}
