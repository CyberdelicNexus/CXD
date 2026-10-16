/**
 * Verification for the Nexus bridge's pure logic (D182).
 * Run: npx tsx src/lib/nexus/__verify__/handoff.verify.ts
 *
 * Asserts: a valid ES256 token is accepted (direct key and JWKS); HS256 and
 * alg "none" are refused; wrong aud / iss / signing key refused; a token past
 * 60 s refused; replay refused through an injected in-memory jti store;
 * intent parsing (bad uuid, overlong name, control chars, unknown go →
 * dashboard); tier mapping; the tier sync rule table; the listing shape
 * (https-only cover, cap 60, order, canCreate); the /cxd deep-link parser;
 * the server-built new-project row; the bridge credential check.
 */
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createHmac } from 'crypto';
import {
  consumeHandoffToken,
  createMemoryJtiStore,
  parseIntent,
  verifyHandoffToken,
  type JtiStore,
} from '../handoff';
import { canvasPlanForTier, decideTierSync, isTierCheckDue, parseTierResponse, type SubscriptionSyncRow } from '../tier';
import {
  buildNewProjectRow,
  buildProjectListing,
  destinationForNewProject,
  destinationForProject,
  isAtCanvasLimit,
  safeCoverImage,
  UNLINKED_LISTING,
  type ListingSourceRow,
} from '../listing';
import { bearerToken, getHandoffConfig, verifyNexusBridgeToken } from '../config';
import { readProjectDeepLink } from '../../project-deep-link';

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error(`  ✗ ${msg}`);
  } else console.log(`  ✓ ${msg}`);
}

const ISSUER = 'https://cyberdelic.nexus';
const MEMBER = '3f6c1b2a-9d4e-4c1b-8a2f-1234567890ab';
const PROJECT = 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const T0 = 1_800_000_000; // fixed clock (seconds)
const at = (s: number) => new Date(s * 1000);

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

async function main() {
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
  const other = await generateKeyPair('ES256');

  const baseClaims = {
    email: 'Member@Example.org',
    email_verified: true,
    name: 'Ada',
    tier: 'hacker',
    cxd: { go: 'dashboard' },
  };

  async function sign(
    overrides: Record<string, unknown> = {},
    opts: { iat?: number; exp?: number; aud?: string; iss?: string; key?: CryptoKey; kid?: string } = {},
  ) {
    const iat = opts.iat ?? T0;
    return new SignJWT({ ...baseClaims, ...overrides })
      .setProtectedHeader({ alg: 'ES256', kid: opts.kid ?? 'k1', typ: 'JWT' })
      .setIssuer(opts.iss ?? ISSUER)
      .setAudience(opts.aud ?? 'cxd-canvas')
      .setSubject(MEMBER)
      .setJti(crypto.randomUUID())
      .setIssuedAt(iat)
      .setExpirationTime(opts.exp ?? iat + 60)
      .sign(opts.key ?? privateKey);
  }

  const opts = { issuer: ISSUER, currentDate: at(T0 + 5) };

  // ── Valid token ──
  console.log('Valid token:');
  const good = await sign();
  const ok = await verifyHandoffToken(good, publicKey, opts);
  check(ok.ok, 'ES256 token with the right iss/aud/age is accepted');
  if (ok.ok) {
    check(ok.claims.memberId === MEMBER, 'sub becomes memberId');
    check(ok.claims.email === 'member@example.org', 'email is lower-cased');
    check(ok.claims.tier === 'hacker' && ok.claims.name === 'Ada', 'tier + name carried (display only)');
    check(ok.claims.intent.go === 'dashboard', 'intent parsed');
  }
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' };
  const viaJwks = await verifyHandoffToken(good, createLocalJWKSet({ keys: [jwk] }), opts);
  check(viaJwks.ok, 'accepted through a JWKS resolver (kid match)');
  const unknownKid = await verifyHandoffToken(await sign({}, { kid: 'nope' }), createLocalJWKSet({ keys: [jwk] }), opts);
  check(!unknownKid.ok && unknownKid.code === 'invalid', 'unknown kid refused');

  // ── Algorithm pinning ──
  console.log('Algorithm pinning:');
  const hsHeader = b64url({ alg: 'HS256', typ: 'JWT', kid: 'k1' });
  const hsPayload = b64url({ ...baseClaims, iss: ISSUER, aud: 'cxd-canvas', sub: MEMBER, jti: 'x', iat: T0, exp: T0 + 60 });
  const spki = JSON.stringify(jwk);
  const hsSig = createHmac('sha256', spki).update(`${hsHeader}.${hsPayload}`).digest('base64url');
  const hs = await verifyHandoffToken(`${hsHeader}.${hsPayload}.${hsSig}`, publicKey, opts);
  check(!hs.ok && hs.code === 'invalid', 'HS256 keyed with the public key is refused');
  const hsJwks = await verifyHandoffToken(`${hsHeader}.${hsPayload}.${hsSig}`, createLocalJWKSet({ keys: [jwk] }), opts);
  check(!hsJwks.ok && hsJwks.code === 'invalid', 'HS256 refused through the JWKS resolver too');
  const noneTok = `${b64url({ alg: 'none', typ: 'JWT' })}.${hsPayload}.`;
  const none = await verifyHandoffToken(noneTok, publicKey, opts);
  check(!none.ok && none.code === 'invalid', 'alg "none" is refused');
  const wrongKey = await verifyHandoffToken(await sign({}, { key: other.privateKey }), publicKey, opts);
  check(!wrongKey.ok && wrongKey.code === 'invalid', 'ES256 signed by another key is refused');
  const tampered = good.slice(0, -4) + (good.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  check(!(await verifyHandoffToken(tampered, publicKey, opts)).ok, 'tampered signature refused');
  check(!(await verifyHandoffToken('not-a-jwt', publicKey, opts)).ok, 'garbage refused');
  check(!(await verifyHandoffToken(undefined, publicKey, opts)).ok, 'missing token refused');

  // ── Claims ──
  console.log('Claims:');
  const wrongAud = await verifyHandoffToken(await sign({}, { aud: 'dojo' }), publicKey, opts);
  check(!wrongAud.ok && wrongAud.code === 'invalid', 'wrong aud refused');
  const wrongIss = await verifyHandoffToken(await sign({}, { iss: 'https://evil.example' }), publicKey, opts);
  check(!wrongIss.ok && wrongIss.code === 'invalid', 'wrong iss refused');
  const notVerified = await verifyHandoffToken(await sign({ email_verified: false }), publicKey, opts);
  check(!notVerified.ok, 'email_verified false refused');
  const noEmail = await verifyHandoffToken(await sign({ email: undefined }), publicKey, opts);
  check(!noEmail.ok, 'missing email refused');
  const longLife = await verifyHandoffToken(await sign({}, { exp: T0 + 600 }), publicKey, opts);
  check(!longLife.ok, 'exp more than 60 s after iat refused');

  // ── Expiry ──
  console.log('Expiry:');
  const late = await verifyHandoffToken(good, publicKey, { issuer: ISSUER, currentDate: at(T0 + 61) });
  check(!late.ok && late.code === 'expired', 'used 61 s after iat → expired');
  const old = await verifyHandoffToken(await sign({}, { iat: T0 - 120, exp: T0 - 60 }), publicKey, opts);
  check(!old.ok && old.code === 'expired', 'token from two minutes ago → expired');
  const edge = await verifyHandoffToken(good, publicKey, { issuer: ISSUER, currentDate: at(T0 + 59) });
  check(edge.ok, 'used at 59 s → still accepted');

  // ── Single use ──
  console.log('Single use:');
  const store = createMemoryJtiStore();
  const once = await sign();
  const first = await consumeHandoffToken(once, publicKey, opts, store);
  const second = await consumeHandoffToken(once, publicKey, opts, store);
  check(first.ok, 'first use accepted');
  check(!second.ok && second.code === 'replayed', 'second use refused as replayed');
  const brokenStore: JtiStore = { claim: async () => { throw new Error('db down'); } };
  const broken = await consumeHandoffToken(await sign(), publicKey, opts, brokenStore);
  check(!broken.ok && broken.code === 'unavailable', 'jti store failure → unavailable, never accepted');
  let claims = 0;
  const countingStore: JtiStore = { claim: async () => { claims++; return 'ok'; } };
  await consumeHandoffToken(await sign({}, { aud: 'x' }), publicKey, opts, countingStore);
  check(claims === 0, 'an invalid token never reaches the jti store (verified first)');

  // ── Intent ──
  console.log('Intent:');
  check(parseIntent({ go: 'project', id: PROJECT.toUpperCase() }).go === 'project', 'project with uuid (any case)');
  check(parseIntent({ go: 'project', id: 'abc' }).go === 'dashboard', 'project with bad uuid → dashboard');
  check(parseIntent({ go: 'project' }).go === 'dashboard', 'project without id → dashboard');
  const n = parseIntent({ go: 'new', name: '  My canvas  ' });
  check(n.go === 'new' && n.name === 'My canvas', 'new name is trimmed');
  check(parseIntent({ go: 'new', name: 'x'.repeat(120) }).go === 'new', '120-char name accepted');
  check(parseIntent({ go: 'new', name: 'x'.repeat(121) }).go === 'dashboard', 'overlong name → dashboard');
  check(parseIntent({ go: 'new', name: '   ' }).go === 'dashboard', 'blank name → dashboard');
  check(parseIntent({ go: 'new', name: 'a\u0000b' }).go === 'dashboard', 'control char → dashboard');
  check(parseIntent({ go: 'new', name: 42 }).go === 'dashboard', 'non-string name → dashboard');
  check(parseIntent({ go: 'admin' }).go === 'dashboard', 'unknown go → dashboard');
  check(parseIntent(null).go === 'dashboard' && parseIntent('new').go === 'dashboard', 'missing / non-object → dashboard');
  const viaToken = await verifyHandoffToken(await sign({ cxd: { go: 'nuke' } }), publicKey, opts);
  check(viaToken.ok && viaToken.claims.intent.go === 'dashboard', 'unknown intent inside a valid token → dashboard');

  // ── Tier mapping ──
  console.log('Tier mapping:');
  check(canvasPlanForTier({ tier: 'hacker', active: true }) === 'pro', 'active hacker → pro');
  check(canvasPlanForTier({ tier: 'weaver', active: true }) === 'pro', 'active weaver → pro');
  check(canvasPlanForTier({ tier: 'lifetime', active: true }) === 'pro', 'active lifetime → pro');
  check(canvasPlanForTier({ tier: 'cybernaut', active: true }) === 'free', 'cybernaut → free');
  check(canvasPlanForTier({ tier: 'weaver', active: false }) === 'free', 'inactive weaver → free');
  check(parseTierResponse(200, { tier: 'weaver', active: true }).ok, '200 well-formed parsed');
  check(!parseTierResponse(200, { tier: 'gold', active: true }).ok, 'unknown tier → failure');
  check(!parseTierResponse(200, { tier: 'weaver', active: 'yes' }).ok, 'non-boolean active → failure');
  check(!parseTierResponse(404, {}).ok && !parseTierResponse(503, null).ok, '404 / 503 → failure');

  // ── Tier sync rule ──
  console.log('Tier sync rule:');
  const now = new Date('2026-10-16T12:00:00Z');
  const pro = { ok: true as const, tier: 'weaver' as const, active: true };
  const free = { ok: true as const, tier: 'cybernaut' as const, active: true };
  const fail = { ok: false as const };
  const row = (r: Partial<SubscriptionSyncRow>): SubscriptionSyncRow => ({
    plan_id: 'free', status: 'active', stripe_subscription_id: null, plan_source: null, ...r,
  });
  const keys = (p: object | null) => (p ? Object.keys(p).sort().join(',') : 'null');

  let d = decideTierSync(row({ plan_id: 'pro', stripe_subscription_id: 'sub_1', plan_source: 'stripe' }), free, now);
  check(d.outcome === 'protected' && keys(d.patch) === 'nexus_checked_at', 'active Stripe sub: only nexus_checked_at');
  d = decideTierSync(row({ plan_id: 'pro', stripe_subscription_id: 'sub_1', status: 'trialing' }), free, now);
  check(d.outcome === 'protected', 'trialing Stripe sub: protected');
  d = decideTierSync(row({ plan_id: 'lifetime' }), free, now);
  check(d.outcome === 'protected' && d.planAfter === 'lifetime', 'lifetime (not from Nexus): protected');
  d = decideTierSync(row({ plan_id: 'beta_tester', plan_source: 'stripe' }), free, now);
  check(d.outcome === 'protected', 'beta_tester: protected');
  d = decideTierSync(row({}), pro, now);
  check(d.outcome === 'granted_pro' && d.patch?.plan_id === 'pro' && d.patch?.plan_source === 'nexus' && d.patch?.status === 'active', 'free + Nexus pro → pro/active/nexus');
  d = decideTierSync(row({ plan_id: 'pro', plan_source: 'nexus' }), pro, now);
  check(d.outcome === 'granted_pro' && !('plan_id' in (d.patch ?? {})), 'already Nexus pro: plan_id not rewritten (credit trigger)');
  d = decideTierSync(row({ plan_id: 'pro', plan_source: 'nexus' }), free, now);
  check(d.outcome === 'revoked_to_free' && d.patch?.plan_id === 'free' && d.patch?.plan_source === null, 'Nexus pro + Nexus free → free, source cleared');
  d = decideTierSync(row({ plan_id: 'pro', plan_source: 'nexus' }), { ok: true, tier: 'hacker', active: false }, now);
  check(d.outcome === 'revoked_to_free', 'lapsed hacker → free');
  d = decideTierSync(row({}), free, now);
  check(d.outcome === 'stays_free' && keys(d.patch) === 'nexus_checked_at', 'free + Nexus free: only nexus_checked_at');
  d = decideTierSync(row({ plan_id: 'pro', plan_source: 'stripe', stripe_subscription_id: 'sub_2', status: 'canceled' }), free, now);
  check(d.outcome === 'stays_free' && d.planAfter === 'pro', 'Stripe-sourced plan is never downgraded by Nexus');
  d = decideTierSync(row({ plan_id: 'pro', plan_source: 'nexus' }), fail, now);
  check(d.outcome === 'no_change' && d.patch === null, 'Nexus failure: nothing written, nothing downgraded');
  check(d.patch === null && decideTierSync(row({}), fail, now).patch === null, 'failure never even sets nexus_checked_at');
  check(isTierCheckDue(null, now, 3_600_000), 'never checked → due');
  check(!isTierCheckDue('2026-10-16T11:30:00Z', now, 3_600_000), 'checked 30 min ago → not due');
  check(isTierCheckDue('2026-10-16T10:30:00Z', now, 3_600_000), 'checked 90 min ago → due');

  // ── Listing ──
  console.log('Listing:');
  check(safeCoverImage('https://img.example/a.png') === 'https://img.example/a.png', 'https cover kept');
  check(safeCoverImage('http://img.example/a.png') === null, 'http cover → null');
  check(safeCoverImage('data:image/png;base64,AAAA') === null, 'data URL → null');
  check(safeCoverImage('javascript:alert(1)') === null, 'javascript: → null');
  check(safeCoverImage('/images/a.png') === null && safeCoverImage(undefined) === null, 'relative / missing → null');
  const rows: ListingSourceRow[] = Array.from({ length: 70 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    name: `P${i}`,
    description: null,
    updated_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    coverImage: i % 2 ? 'https://img.example/x.png' : 'data:image/png;base64,AA',
    role: i < 50 ? 'owner' : 'collaborator',
  }));
  rows.push({ ...rows[3] }); // duplicate id
  const listing = buildProjectListing({ plan: 'pro', ownedCount: 50, rows });
  check(listing.linked === true && listing.plan === 'pro' && listing.canCreate === true, 'pro: linked, can create');
  check(listing.projects.length === 60, 'capped at 60');
  check(listing.projects[0].name === 'P69', 'newest first');
  check(listing.projects.every((p, i, a) => i === 0 || Date.parse(a[i - 1].updatedAt) >= Date.parse(p.updatedAt)), 'ordered by updatedAt desc');
  check(listing.projects.every((p) => p.coverImage === null || p.coverImage.startsWith('https://')), 'covers are https or null');
  check(listing.projects.every((p) => p.description === ''), 'null description → ""');
  check(new Set(listing.projects.map((p) => p.id)).size === listing.projects.length, 'no duplicate ids');
  const shape = Object.keys(listing.projects[0]).sort().join(',');
  check(shape === 'coverImage,description,id,name,role,updatedAt', 'project item has exactly the contract fields');
  check(!buildProjectListing({ plan: 'free', ownedCount: 1, rows: [] }).canCreate, 'free with 1 canvas: canCreate false');
  check(buildProjectListing({ plan: 'free', ownedCount: 0, rows: [] }).canCreate, 'free with 0 canvases: canCreate true');
  check(buildProjectListing({ plan: 'gold', ownedCount: 0, rows: [] }).plan === 'free', 'unknown plan reported as free');
  check(JSON.stringify(UNLINKED_LISTING) === '{"linked":false,"plan":null,"canCreate":true,"projects":[]}', 'unknown member shape');

  // ── Intent destinations + new project row ──
  console.log('Destinations and new project:');
  check(destinationForProject(PROJECT, true) === `/cxd?project=${PROJECT}`, 'project with access → /cxd?project=');
  check(destinationForProject(PROJECT, false) === '/dashboard', 'project without access → /dashboard');
  check(destinationForNewProject(PROJECT) === `/cxd?project=${PROJECT}&view=wizard`, 'new → wizard');
  check(isAtCanvasLimit('free', 1) && !isAtCanvasLimit('free', 0) && !isAtCanvasLimit('pro', 999), 'canvas limit per plan');
  const newRow = buildNewProjectRow(PROJECT, 'Dream', MEMBER, now);
  check(Object.keys(newRow).sort().join(',') === 'created_at,description,id,name,owner_id,project_data,share_token,updated_at', 'row has insertProject columns, no yjs_state');
  check(newRow.project_data.id === PROJECT && newRow.project_data.ownerId === MEMBER && newRow.project_data.intentionCore.projectName === 'Dream', 'project_data from createDefaultProject');

  // ── /cxd deep link ──
  console.log('/cxd deep link:');
  const dl = readProjectDeepLink(`?project=${PROJECT}&view=wizard`);
  check(dl?.projectId === PROJECT && dl.view === 'wizard' && dl.remainingSearch === '?view=wizard', 'project + view parsed, project stripped');
  check(readProjectDeepLink(`?id=${PROJECT}`)?.projectId === PROJECT, '?id= alias');
  check(readProjectDeepLink('?project=nope') === null && readProjectDeepLink('') === null, 'bad / missing id → no deep link');
  check(readProjectDeepLink(`?project=${PROJECT}&view=admin`)?.view === null, 'unknown view ignored');

  // ── Bridge credential + config ──
  console.log('Bridge credential and config:');
  delete process.env.NEXUS_BRIDGE_TOKEN;
  check(verifyNexusBridgeToken('Bearer x').ok === false, 'unset NEXUS_BRIDGE_TOKEN → not configured');
  process.env.NEXUS_BRIDGE_TOKEN = 'current-secret';
  process.env.NEXUS_BRIDGE_TOKEN_PREVIOUS = 'previous-secret';
  check(verifyNexusBridgeToken('Bearer current-secret').ok, 'current token accepted');
  check(verifyNexusBridgeToken('Bearer previous-secret').ok, 'previous token accepted during rotation');
  check(!verifyNexusBridgeToken('Bearer wrong').ok && !verifyNexusBridgeToken('current-secret').ok, 'wrong / non-bearer refused');
  check(bearerToken('bearer abc') === 'abc' && bearerToken('Basic abc') === null, 'bearer parsing');
  delete process.env.NEXUS_ISSUER;
  delete process.env.NEXUS_JWKS_URL;
  check(getHandoffConfig() === null, 'handoff inert while NEXUS_ISSUER / NEXUS_JWKS_URL unset');
  process.env.NEXUS_ISSUER = 'http://cyberdelic.nexus';
  process.env.NEXUS_JWKS_URL = 'https://cyberdelic.nexus/api/handoff/jwks';
  check(getHandoffConfig() === null, 'plain-http issuer refused');
  process.env.NEXUS_ISSUER = ISSUER;
  check(getHandoffConfig()?.issuer === ISSUER, 'https issuer accepted');

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
