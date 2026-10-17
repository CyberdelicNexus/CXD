/**
 * Ghost collaborators — puts N fake peers with moving cursors onto a REAL
 * canvas channel so one person can check browser rendering at the full
 * collaborator cap. Open the canvas in your browser first, then run this.
 *
 * Sends only what use-collaboration.ts treats as ephemeral presence
 * (user_heartbeat, cursor_update, user_offline). No Yjs messages, no DB
 * writes — the canvas content is never touched, and the ghosts disappear
 * when the script ends.
 *
 * Run: npx tsx scripts/collab-ghost-cursors.ts <canvasId> [ghosts=5] [seconds=60] [centerX=600] [centerY=400]
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from '../src/lib/lab/__verify__/load-env';

loadEnvLocal();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!URL || !ANON) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');

const canvasId = process.argv[2];
if (!canvasId) {
  console.error('Usage: npx tsx scripts/collab-ghost-cursors.ts <canvasId> [ghosts=5] [seconds=60] [centerX=600] [centerY=400]');
  process.exit(1);
}
const GHOSTS = Number(process.argv[3] || 5);
const SECONDS = Number(process.argv[4] || 60);
const CENTER = { x: Number(process.argv[5] || 600), y: Number(process.argv[6] || 400) };

const CURSOR_MS = 33; // what real peers send at <= 5 collaborators
const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16', '#3b82f6'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const ghosts = await Promise.all(Array.from({ length: GHOSTS }, async (_, i) => {
    const id = `ghost-${i + 1}-${crypto.randomUUID().slice(0, 8)}`;
    const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const channel = client.channel(`canvas:${canvasId}`, {
      config: { presence: { key: id }, broadcast: { self: false } },
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${id} subscribe timeout`)), 15_000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
      });
    });
    const heartbeat = () => channel.send({
      type: 'broadcast',
      event: 'user_heartbeat',
      payload: { id, name: `Ghost ${i + 1}`, email: `ghost${i + 1}@loadtest.invalid`, color: COLORS[i % COLORS.length], lastSeen: Date.now() },
    });
    heartbeat();
    return { id, client, channel, heartbeat, phase: (i / GHOSTS) * Math.PI * 2, radius: 180 + i * 45 };
  }));

  console.log(`${GHOSTS} ghosts on canvas:${canvasId} for ${SECONDS}s — watch the canvas now.`);

  const start = Date.now();
  let next = start;
  let lastHeartbeat = start;
  while (Date.now() - start < SECONDS * 1000) {
    const now = Date.now();
    if (now >= next) {
      next += CURSOR_MS;
      const t = (now - start) / 1000;
      for (const g of ghosts) {
        g.channel.send({
          type: 'broadcast',
          event: 'cursor_update',
          payload: {
            id: g.id,
            x: CENTER.x + Math.cos(t * 1.3 + g.phase) * g.radius,
            y: CENTER.y + Math.sin(t * 1.7 + g.phase) * g.radius * 0.6,
            zoom: 1,
            boardId: null,
            timestamp: now,
          },
        });
      }
    }
    if (now - lastHeartbeat > 30_000) {
      lastHeartbeat = now;
      ghosts.forEach((g) => g.heartbeat());
    }
    await sleep(4);
  }

  for (const g of ghosts) {
    await g.channel.send({ type: 'broadcast', event: 'user_offline', payload: { id: g.id } });
    await g.client.removeAllChannels();
    g.client.realtime.disconnect();
  }
  console.log('Done — ghosts removed.');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
