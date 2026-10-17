/**
 * Turn Canvas Assistant beta feedback into training material.
 *
 *   npx tsx scripts/export-assistant-feedback.ts            # last 30 days, report only
 *   npx tsx scripts/export-assistant-feedback.ts 14 --lab   # last 14 days, add to the Structure Lab
 *
 * Reads canvas_assistant_feedback with the service role (it bypasses the
 * owner-only policies, so run it locally and never ship the key to a client).
 *
 * It reports three things:
 *   1. Requests that went badly: rated down, discarded unbuilt, or taken back
 *      off the canvas. With --lab each becomes a Structure Lab custom input,
 *      so the same request can be re-run across prompts and models.
 *   2. Form corrections: where the suggested form was not the one chosen.
 *      Printed as ready-to-paste EXAMPLES entries for src/lib/ai/jev.ts.
 *   3. A summary: how often builds are kept, and the reasons given when not.
 *
 * Requests are users' own words about their own projects. Read them before
 * committing anything this script writes.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { saveCustomInput } from '../src/lib/lab/store';

for (const line of fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

interface Row {
  entry_id: string;
  event: 'form_picked' | 'built' | 'discarded' | 'refined' | 'rated' | 'removed';
  rating: number | null;
  reason: string | null;
  instruction: string | null;
  model: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

async function main() {
  const days = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 30;
  const toLab = process.argv.includes('--lab');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await admin
    .from('canvas_assistant_feedback')
    .select('entry_id, event, rating, reason, instruction, model, payload, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(5000);
  if (error) throw new Error(`Could not read feedback: ${error.message}`);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    console.log(`No feedback in the last ${days} days.`);
    return;
  }

  const byEntry = new Map<string, Row[]>();
  for (const r of rows) byEntry.set(r.entry_id, [...(byEntry.get(r.entry_id) ?? []), r]);
  const has = (events: Row[], e: Row['event']) => events.some((r) => r.event === e);

  // 1. Requests that went badly.
  const bad: { instruction: string; why: string }[] = [];
  const seen = new Set<string>();
  for (const events of Array.from(byEntry.values())) {
    const instruction = events.find((r) => r.instruction)?.instruction?.trim();
    if (!instruction || seen.has(instruction.toLowerCase())) continue;
    const down = events.find((r) => r.event === 'rated' && r.rating === -1);
    const why = down
      ? `rated down${down.reason ? `: ${down.reason}` : ''}`
      : has(events, 'removed') ? 'built, then taken off the canvas'
      : has(events, 'discarded') && !has(events, 'built') ? 'discarded without building'
      : '';
    if (!why) continue;
    seen.add(instruction.toLowerCase());
    bad.push({ instruction, why });
  }

  // 2. Form corrections.
  const corrections = rows
    .filter((r) => r.event === 'form_picked' && r.instruction)
    .map((r) => ({ request: r.instruction as string, suggested: String(r.payload?.suggested ?? ''), picked: String(r.payload?.picked ?? '') }))
    .filter((c) => c.picked && c.picked !== 'assistant-decides' && c.picked !== c.suggested);

  // 3. Summary.
  const built = Array.from(byEntry.values()).filter((e) => has(e, 'built'));
  const kept = built.filter((e) => !has(e, 'removed') && !e.some((r) => r.event === 'rated' && r.rating === -1));
  const up = rows.filter((r) => r.event === 'rated' && r.rating === 1).length;
  const downRows = rows.filter((r) => r.event === 'rated' && r.rating === -1);
  const reasons = new Map<string, number>();
  for (const r of downRows) reasons.set(r.reason || 'no reason given', (reasons.get(r.reason || 'no reason given') ?? 0) + 1);
  const picks = rows.filter((r) => r.event === 'form_picked');

  console.log(`Last ${days} days: ${rows.length} events across ${byEntry.size} requests.`);
  console.log(`Built: ${built.length}. Kept (not removed, not rated down): ${kept.length}. Thumbs up ${up}, thumbs down ${downRows.length}.`);
  if (picks.length > 0) console.log(`Form suggestion accepted ${picks.length - corrections.length} of ${picks.length} times it was offered.`);
  if (reasons.size > 0) {
    console.log('\nReasons given for a thumbs down:');
    for (const [reason, n] of Array.from(reasons.entries()).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${reason}`);
  }

  console.log(`\nRequests that went badly (${bad.length}):`);
  for (const b of bad.slice(0, 40)) console.log(`  [${b.why}] ${b.instruction.slice(0, 110)}`);

  if (corrections.length > 0) {
    console.log(`\nForm corrections (${corrections.length}), as EXAMPLES entries for src/lib/ai/jev.ts:`);
    for (const c of corrections.slice(0, 40)) {
      console.log(`  { request: ${JSON.stringify(c.request.slice(0, 140))}, form: "${c.picked}" }, // suggested ${c.suggested || 'none'}`);
    }
  }

  if (toLab) {
    let added = 0;
    for (let i = 0; i < bad.length; i++) {
      const b = bad[i];
      await saveCustomInput({
        id: `feedback-${Date.now()}-${i}`,
        type: 'topic',
        title: `Beta (${b.why}): ${b.instruction}`.slice(0, 120),
        text: b.instruction.slice(0, 8000),
        cards: [],
        expectedTypes: [],
        custom: true,
      });
      added++;
    }
    console.log(`\nAdded ${added} Structure Lab input(s). Open /lab to run them.`);
  } else if (bad.length > 0) {
    console.log('\nRe-run with --lab to add these requests to the Structure Lab.');
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
