/**
 * Collaboration load test — N simulated peers on ONE throwaway Realtime channel.
 *
 * Each peer is its own Supabase client (own websocket) running the real
 * SupabaseYjsProvider over a real Y.Doc, plus the same cursor broadcast the
 * canvas sends (use-collaboration.ts), at the worst case: everyone moving the
 * mouse and editing for the whole run.
 *
 * Measures cursor delivery + latency, Yjs edit latency, and whether every
 * peer's doc converges to the same state. Touches no table and no real canvas
 * (the channel name is random). Does NOT measure browser render cost.
 *
 * Run: npx tsx scripts/collab-load-test.ts [peerCounts=4,6] [seconds=20]
 */

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import * as Y from 'yjs';
import { SupabaseYjsProvider } from '../src/lib/yjs/supabase-yjs-provider';
import { loadEnvLocal } from '../src/lib/lab/__verify__/load-env';

loadEnvLocal();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!URL || !ANON) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');

const PEER_COUNTS = (process.argv[2] || '4,6').split(',').map(Number);
const SECONDS = Number(process.argv[3] || 20);
const EDITS_PER_SEC = 2;

// Must match getCursorThrottleMs in src/hooks/use-collaboration.ts
function getCursorThrottleMs(collaboratorCount: number): number {
  if (collaboratorCount <= 5) return 33;
  if (collaboratorCount <= 15) return 66;
  if (collaboratorCount <= 30) return 100;
  return 150;
}

// The provider logs every message; silence it so logging isn't what we measure.
const out = (s: string) => process.stdout.write(s + '\n');
console.log = () => {};
console.warn = () => {};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

interface Peer {
  id: string;
  client: SupabaseClient;
  channel: RealtimeChannel;
  doc: Y.Doc;
  provider?: SupabaseYjsProvider;
  cursorSent: number;
  cursorRecv: number;
  cursorGaps: number;
  lastSeq: Map<string, number>;
  sendFailures: number;
  statusEvents: string[];
}

async function runScenario(n: number): Promise<boolean> {
  const channelName = `canvas:loadtest-${crypto.randomUUID()}`;
  const cursorLatency: number[] = [];
  const editLatency: number[] = [];
  const peers: Peer[] = [];

  for (let i = 0; i < n; i++) {
    const id = `peer-${i}`;
    const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const channel = client.channel(channelName, {
      config: { presence: { key: id }, broadcast: { self: false } },
    });
    const peer: Peer = {
      id, client, channel, doc: new Y.Doc(),
      cursorSent: 0, cursorRecv: 0, cursorGaps: 0, lastSeq: new Map(), sendFailures: 0, statusEvents: [],
    };
    channel.on('broadcast', { event: 'cursor_update' }, ({ payload }) => {
      const { id: from, seq, timestamp } = payload as { id: string; seq: number; timestamp: number };
      peer.cursorRecv++;
      cursorLatency.push(Date.now() - timestamp);
      const last = peer.lastSeq.get(from);
      if (last !== undefined && seq !== last + 1) peer.cursorGaps++;
      peer.lastSeq.set(from, seq);
    });
    peer.doc.getMap<{ t: number }>('elements').observe((event, tx) => {
      if (tx.origin !== 'remote') return;
      event.keysChanged.forEach((key) => {
        const v = peer.doc.getMap<{ t: number }>('elements').get(key);
        if (v) editLatency.push(Date.now() - v.t);
      });
    });
    peers.push(peer);
  }

  // Join one at a time, like real users arriving, and start each provider once subscribed.
  const joinStart = Date.now();
  for (const peer of peers) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${peer.id} subscribe timeout`)), 15_000);
      peer.channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
        else peer.statusEvents.push(status);
      });
    });
    peer.provider = new SupabaseYjsProvider(peer.doc, peer.channel, peer.id);
  }
  const joinMs = Date.now() - joinStart;
  await sleep(1000);

  const throttle = getCursorThrottleMs(n - 1);
  const start = Date.now();
  const end = start + SECONDS * 1000;
  let editsMade = 0;

  await Promise.all(peers.map(async (peer, idx) => {
    let nextCursor = start + idx * 3; // stagger so peers don't fire in lockstep
    let nextEdit = start + idx * 40;
    let seq = 0;
    let editNo = 0;
    while (Date.now() < end) {
      const now = Date.now();
      if (now >= nextCursor) {
        nextCursor += throttle;
        peer.cursorSent++;
        peer.channel.send({
          type: 'broadcast',
          event: 'cursor_update',
          payload: { id: peer.id, seq: seq++, x: Math.random() * 4000, y: Math.random() * 4000, zoom: 1, boardId: null, timestamp: now },
        }).then((r) => { if (r !== 'ok') peer.sendFailures++; });
      }
      if (now >= nextEdit) {
        nextEdit += 1000 / EDITS_PER_SEC;
        editsMade++;
        peer.doc.transact(() => {
          peer.doc.getMap('elements').set(`${peer.id}-${editNo++}`, {
            t: Date.now(), type: 'freeform', x: Math.random() * 4000, y: Math.random() * 4000,
            width: 240, height: 160, text: 'load test card '.repeat(8),
          });
        }, 'local');
      }
      await sleep(4);
    }
  }));

  await sleep(3000); // let the tail drain

  const elapsed = (end - start) / 1000;
  const sent = peers.reduce((s, p) => s + p.cursorSent, 0);
  const recv = peers.reduce((s, p) => s + p.cursorRecv, 0);
  const expected = sent * (n - 1);
  const gaps = peers.reduce((s, p) => s + p.cursorGaps, 0);
  const failures = peers.reduce((s, p) => s + p.sendFailures, 0);
  const statuses = peers.flatMap((p) => p.statusEvents.map((s) => `${p.id}:${s}`));
  const docSizes = peers.map((p) => p.doc.getMap('elements').size);
  const converged = docSizes.every((s) => s === editsMade);
  cursorLatency.sort((a, b) => a - b);
  editLatency.sort((a, b) => a - b);
  const delivery = expected ? (recv / expected) * 100 : 100;

  out(`\n── ${n} peers (owner + ${n - 1} collaborators), ${SECONDS}s, cursor every ${throttle}ms ──`);
  out(`join (sequential)      ${joinMs} ms total`);
  out(`cursor sent            ${sent}  (${(sent / elapsed).toFixed(0)} msg/s into the channel, ${(expected / elapsed).toFixed(0)} deliveries/s)`);
  out(`cursor delivered       ${recv}/${expected}  (${delivery.toFixed(2)}%)   out-of-order/gaps: ${gaps}`);
  out(`cursor latency ms      p50 ${pct(cursorLatency, 50)}  p95 ${pct(cursorLatency, 95)}  p99 ${pct(cursorLatency, 99)}  max ${cursorLatency[cursorLatency.length - 1]}`);
  out(`yjs edits              ${editsMade} made; per-peer doc sizes [${docSizes.join(', ')}]  → ${converged ? 'CONVERGED' : 'DIVERGED'}`);
  out(`yjs edit latency ms    p50 ${pct(editLatency, 50)}  p95 ${pct(editLatency, 95)}  p99 ${pct(editLatency, 99)}  max ${editLatency[editLatency.length - 1]}`);
  out(`send failures          ${failures}`);
  out(`channel status events  ${statuses.length ? statuses.join(', ') : 'none'}`);

  for (const peer of peers) {
    peer.provider?.destroy();
    await peer.client.removeAllChannels();
    peer.client.realtime.disconnect();
  }

  return converged && delivery >= 99 && failures === 0 && statuses.length === 0;
}

(async () => {
  let allOk = true;
  for (const n of PEER_COUNTS) {
    const ok = await runScenario(n);
    out(ok ? 'PASS' : 'FAIL');
    allOk = allOk && ok;
    await sleep(2000);
  }
  process.exit(allOk ? 0 : 1);
})().catch((err) => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exit(1);
});
