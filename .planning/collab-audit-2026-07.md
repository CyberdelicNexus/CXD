# Collaborative Features Audit — July 2026 (Launch Gate)

**Scope:** Realtime sync, invite/permission flow, multi-tab/multi-user edge cases, comments, share page, and a static walk of the Phase 2 QA-gate scenarios.
**Method:** Static code trace only. No source files modified. Evidence is `file:line`.
**Verdict up front:** One **P0 data-integrity** issue (same-user multi-tab save clobber) and two **P1** issues (share-link join broken by RLS; downgraded-owner edit enforcement gap) must be resolved before a public launch. Everything else is P2 polish/simplification.

---

## P0 — Data integrity (launch blocker)

### P0-1. Two tabs of the same user silently diverge, and the second tab's save rolls back the first tab's persisted work

**Evidence:**
- `src/lib/yjs/supabase-yjs-provider.ts:112` — incoming realtime messages are dropped when `msg.sender === this.userId`. `sender` is the raw `userId` (`:99-102`), so **every tab of the same user ignores every other tab of that user.**
- `src/hooks/use-collaboration.ts:200,223,247,324` — the parallel LWW channel does the same: `if (peer.id === currentUser.id) return`, `if (update.userId !== currentUser.id)`. Same-user tabs also ignore each other here.
- `src/lib/yjs/indexeddb-persistence.ts` — `LocalPersistence` wraps `y-indexeddb` with no cross-tab BroadcastChannel. y-indexeddb loads once on init; it does **not** live-sync ongoing writes between tabs.
- `src/lib/yjs/supabase-persistence.ts:167-177` — `save()` merges the local doc against the **cached** `lastLoadedState`, never re-`SELECT`s the live DB row, then `Y.encodeStateAsUpdate` writes the **full** doc state to both `yjs_state` and (via `mergeProjectWithDoc`) `project_data` (`:230-256`).

**Failure trace:**
1. Tab A and Tab B open the same canvas; both load identical `yjs_state` (their `lastLoadedState` is equal).
2. Tab A edits (opA), debounced save writes `load ∪ opA` to the DB. DB now has opA.
3. Tab B never received opA (same-user echo suppression on both channels; IndexedDB doesn't live-sync). Tab B's doc is still `load`, `lastLoadedState` still `load`.
4. Tab B saves — on any doc change, or on `flush()` at `visibilitychange`/`beforeunload` (`yjs-project-context.tsx:158-168`), or the `markReady()` initial save (`supabase-persistence.ts:144-148`). Merge = `load ∪ load = load`. It writes `load` to `yjs_state` **and** `project_data`, **overwriting opA in both columns.**
5. On next reload, opA is gone from both columns. The wipe guard (`:199-211`) only catches the zero-element case; the reconciler (`y-doc-factory.ts:304`) can't resurrect opA because it's absent from `project_data` too.

**Why it's P0:** Silent, no exception thrown — the exact failure class the July reconciler was built to stop, re-entering through a different door. It does **not** require concurrent active editing: a stale, idle second tab that later backgrounds/closes is enough to roll back the primary tab's saved work. Opening the app in two tabs is a common real behavior. This directly violates the product's core promise.

**Fix (small, targeted):** Give each tab a unique sender identity for echo suppression while keeping user identity for display. Suggested: `const senderId = `${userId}:${crypto.randomUUID()}`` created once per provider, sent as `sender` and compared in `handleMessage`; likewise a per-tab `clientId` for the LWW channel's self-check. This makes same-user tabs sync live via CRDT, eliminating the divergence and the clobber. Defense-in-depth: in `SupabasePersistence._executeSave`, on the first save after load do a single `SELECT yjs_state` and merge it into `mergeDoc` (or re-merge when a conflict/`updated_at` mismatch is detected) so a stale cache can never encode a full-state overwrite.

---

## P1 — Broken UX / enforcement

### P1-1. Share-link "Join as collaborator" (`?join=true`) is always blocked by RLS

**Evidence:**
- `src/app/cxd/share/[token]/page.tsx:104-111` — the join flow does a **client-side** `supabase.from('canvas_collaborators').insert({...role:'collaborator'})` as the joining (non-owner) user.
- RLS `"Owners can insert collaborators"` requires the inserter to be the owner: `WITH CHECK (EXISTS(SELECT 1 FROM cxd_projects p WHERE p.id = canvas_id AND p.owner_id = auth.uid()))` — `20240106000001_collaboration_schema.sql:121-127`, re-created identically in `20240425000004_wrap_rls_auth_calls.sql:84-90`. There is **no** self-insert policy in any migration.

**Result:** The insert fails RLS for any non-owner. The error is caught and only `console.error`'d (`:113-115`), so the visitor is silently redirected to `/cxd` with no collaborator record created. The share-link join path is dead.

**Note (product decision, not just a bug):** The email-invite path works because `/api/canvas/invite/accept` uses the **service-role** client (`invite/accept/route.ts:25`, `getSupabaseAdmin`) which bypasses RLS. The share page tries to do the same thing from the browser and can't. Also note the share page is branded "Read Only" (`share/[token]/page.tsx:276-279`) — auto-joining anyone who appends `?join=true` as an *editing* collaborator contradicts that and is a privilege question, so route it through a validated server endpoint, not a blanket self-insert policy.

**Fix:** Add a POST route (e.g. `/api/canvas/join`) mirroring `invite/accept` — validate the share token server-side, enforce the owner's plan/collaborator cap, then insert via service role. Point the `?join=true` handler at it. Do **not** add an open self-insert RLS policy.

### P1-2. Collaborators of a downgraded (non-editable-tier) owner can still edit and persist

**Evidence:**
- `src/lib/canvas-permissions.ts:129-140` — when the owner is on a non-editable tier, a collaborator resolves to `canEdit:false, canComment:true, reasonLocked:'owner_not_editable_tier'` and importantly `isLocked:false`.
- `src/app/cxd/page.tsx:133-138` — the editor route guard only redirects when `canvasAccess.isLocked` is true. A collaborator with `canEdit:false` but `isLocked:false` lands in the full editor.
- No client gate consumes `access.canEdit` to disable editing; `use-canvas-permissions.ts:7-11` is explicitly "presentation, not enforcement," and nothing else enforces it.
- Server side, the RLS UPDATE policy allows **any** collaborator (`20240313000001_fix_collaborator_update_policy.sql:8-16`), and `SupabasePersistence` writes `yjs_state`/`project_data` with **no permission check** (`supabase-persistence.ts:_executeSave`). Only `saveProject` checks `resolveCanvasAccess().canEdit` (`supabase-projects.ts:194-204`), and the CRDT path doesn't use `saveProject`.

**Trace:** Pro owner invites collaborators, later downgrades to Free. Their free-primary canvas stays `isLocked:false`. Existing collaborators still open the editor and their edits persist through the unpermissioned CRDT persistence path. The tier restriction is not actually enforced for already-attached collaborators.

**Fix:** (a) Extend the route guard to send `!access.canEdit` viewers to the read-only overview, not just `isLocked`. (b) Add a real server enforcement point for CRDT writes — either gate `SupabasePersistence` saves behind a cached `canEdit` check, or tighten the `cxd_projects` UPDATE RLS to also require the owner be on an editable tier (a `SECURITY DEFINER` helper mirroring `resolveCanvasAccess`).

---

## P2 — Polish / simplification / robustness

### P2-1. `CollaborationPanel` still calls `saveProject()` — a `project_data`-only writer (residual risk after reconciliation)
`src/components/collaboration/collaboration-panel.tsx:111-114` calls `saveProject(project)` before inviting. `saveProject` (`supabase-projects.ts:223-232`) writes `project_data` and `name`/`description` but **not** `yjs_state`.
- **Data-loss residual: LOW.** The reconciler union-merges `project_data` into the doc on next load, so any element this writes that the doc lacks is re-seeded (worst case: harmless resurrection + a `cxd-yjs-divergence-repaired` Sentry event). It cannot delete doc elements.
- **Live bug: `share_token` revocation.** Line 229 writes `share_token: project.shareToken || null`. `SupabasePersistence` deliberately refuses to null `share_token` on autosave for exactly this reason (`supabase-persistence.ts:244-252`), but `saveProject` does it unconditionally. If this tab's in-memory `shareToken` is stale/undefined (a public link created in another session/tab), the invite action silently **revokes the public share link.**
- **Redundant:** the unified writer already keeps the DB row current; the "ensure saved before invite" intent is largely obsolete.
**Fix:** Remove the `saveProject` call and instead `await flushYjsPersistence()` (exported from `yjs-project-context.tsx:66`) before POSTing the invite; or replace it with the metadata-only writer (`supabase-projects.ts:~264`, "Update only top-level metadata") which never touches `project_data`/nulls tokens.

### P2-2. Two parallel sync systems run simultaneously (Yjs CRDT + LWW `canvas_update`)
`collaboration-context.tsx:111-143` fires `broadcastUpdate({type:'element_add'/...})` on **every** element/edge mutation *in addition to* the Yjs write. The remote LWW handler (`app/cxd/page.tsx:~320` `onRemoteUpdate` → `addCanvasElement`/`updateCanvasElement`) re-applies these through store actions, which in CRDT mode **write them back into the local Y.Doc as fresh `'local'` ops and rebroadcast.** This is redundant with Yjs, doubles channel traffic, and risks echo/oscillation and transient field conflicts for 3+ users. It is dampened by existence-check dedupe but not eliminated.
**Fix:** Once Yjs is the trusted transport, stop LWW-rebroadcasting element/edge/field mutations (keep the LWW channel for cursors/selection/presence only). The field-update wrappers already gate on `!yDoc` (`:149-214`); apply the same gating to `syncAddElement`/`syncUpdateElement`/edges.

### P2-3. Comments have redundant dual persistence + a misleading code comment
Comments **are** CRDT-managed: `cxd-store.ts:2302` calls `yjsSetComment` (Y.Doc `comments` map), observed by the bridge (`y-zustand-bridge.ts:334-352`) and persisted in `yjs_state`. But `collaboration-context.tsx:216-257` **also** broadcasts a full `comments_sync` snapshot on every comment mutation, applied by peers via `applyRemoteComments` (`app/cxd/page.tsx:356-360`). Concurrent comment ops can transiently clobber each other through the LWW snapshot before Yjs re-converges (eventually consistent, but flickery). The banner comment "Comments live outside Yjs" (`collaboration-context.tsx:216-218`) is **factually wrong** and will mislead the next maintainer.
**Fix:** Drop the `comments_sync` LWW path and rely on Yjs; at minimum correct the comment.

### P2-4. Yjs Awareness stack is wired but unused for presence rendering (dead/parallel code)
`useYjsAwareness` (`hooks/use-yjs-awareness.ts`) and `AwarenessPresenceBridge` (`awareness-provider.ts`) set cursor/selection/editing awareness, but the rendered cursors come from the **LWW** `CollaboratorPresence[]` (`collaborator-cursors.tsx:5,8` ← `use-collaboration.ts`), not from `getRemoteAwarenessStates`. So there are two presence systems and the Yjs one is effectively inert for UI. Additionally, `AwarenessPresenceBridge` only pushes local state to Supabase Presence and never prunes remote awareness entries — there's no awareness timeout — so if that path ever becomes the render source, abruptly-offline peers' cursors would linger. The LWW path *does* prune (`use-collaboration.ts:75,344-355`, 90s timeout + `pagehide`/`user_offline`).
**Fix:** Either delete the unused Yjs awareness layer or make it the single source and add stale-peer pruning. Don't ship both.

### P2-5. Bulk operations larger than 900 KB don't broadcast; peer sees them only after reload
`supabase-yjs-provider.ts:279-282` skips broadcasting any merged update over `MAX_BROADCAST_BYTES` (900 KB) and returns without scheduling a re-sync. Normal incremental edits are tiny, so live editing is fine; but a single large template/AI insert (`addCanvasElements`) or image paste that exceeds the cap is dropped from realtime with no fallback nudge — the peer converges only on next reload (DB load). No data loss (persistence still writes it), but confusing live UX.
**Fix:** When an update is skipped for size, send a tiny "resync-needed" signal so peers re-pull from DB (or trigger a fresh `sync1`).

### P2-6. Invitation acceptance doesn't re-validate plan/cap at accept time
`invite/accept/route.ts` checks the token/email/expiry but never re-checks the owner's current plan or the collaborator cap (both only enforced at **invite** creation, `invite/route.ts:81-100`). A Pro owner who invites 3 then downgrades still has those invites accept and attach collaborators. Combined with P1-2, this compounds the tier-enforcement gap.
**Fix:** Re-run `can_add_collaborator` (already exists, `20240106000001_collaboration_schema.sql:223`) inside the accept handler.

### P2-7. Verbose `console.log` on every realtime message in production
`supabase-yjs-provider.ts` logs on every send/receive/queue/flush (`:93,110,113,125,...`); `use-yjs-sync.ts:40-56` likewise. This is per-keystroke-scale noise and leaks doc sizes/first-bytes to the console.
**Fix:** Gate behind a `NEXT_PUBLIC_YJS_DEBUG` flag.

### P2-8. Anon share RLS grants row-wide read of any shared project
`20240705000001_restore_anon_shared_project_access.sql:20-23` — `TO anon USING (share_token IS NOT NULL AND share_token != '')` exposes **all columns** (incl. `owner_id`, full `project_data`, `yjs_state`) of any row with a non-empty token. `fetchProjectByShareToken` filters by exact token (`supabase-projects.ts:425-429`) and tokens are 32-byte random hex, so practical exposure requires knowing the token — acceptable for share-by-URL. Flagging only so it's a conscious decision: the policy itself is broad; unguessable tokens are the sole protection.
**Fix (optional hardening):** None required if tokens stay high-entropy; consider a view exposing only presentation columns to `anon` rather than `SELECT *`.

---

## Phase 2 QA-Gate scenarios — static walk

**Scenario 1 — Solo happy path (create board, add elements, edit, reload, persist).**
Traces clean: mutations → Y.Doc → bridge → Zustand; unified writer persists `yjs_state`+`project_data` atomically (`supabase-persistence.ts:230-256`); load reconciles (`yjs-project-context.tsx:187-266`). **PASS** — with the caveat that if the same user has the app open in a second tab, **P0-1** can roll the reload back.

**Scenario 2 — Owner + collaborator sync and persist after reload.**
- Different users sync live via the Yjs channel (echo suppression is fine across different `userId`s), and each persists via its own `SupabasePersistence` (RLS allows collaborator UPDATE). Large initial state that exceeds the 900 KB `sync2` cap is covered by each client's independent DB `load()` (`supabase-persistence.ts:98-124`). **PASS for the email-invite flow.**
- **FAILS** the share-link join variant (**P1-1** — collaborator never gets a row).
- **Enforcement hole** if the owner is on a non-editable tier (**P1-2** — collaborator edits persist when they shouldn't).
- "What a collaborator sees during the owner's initial load": each side hydrates from its own DB `yjs_state` independently, so a collaborator isn't blocked by the owner still loading — acceptable.
- "Peer goes offline abruptly": LWW presence prunes after 90 s and on `pagehide`/`user_offline` (`use-collaboration.ts:75,257-262,381-392`) — acceptable. (Yjs-awareness path wouldn't prune, but it isn't the render source — P2-4.)

---

## Prioritized fix list

1. **P0-1** — Per-tab sender identity for echo suppression (both channels) + first-save DB re-merge in `SupabasePersistence`. *Blocks launch.*
2. **P1-1** — Move share-link join to a service-role API; remove the client-side RLS-blocked insert. *Blocks the advertised join flow.*
3. **P1-2** — Enforce `canEdit` in the route guard and at the CRDT persistence/RLS layer for downgraded-owner collaborators.
4. **P2-1** — Remove `saveProject()` from `CollaborationPanel` (fixes the `share_token` revocation footgun); flush Yjs instead.
5. **P2-3 / P2-2** — Retire the LWW rebroadcast for comments (and then elements/edges) now that Yjs is authoritative; fix the false "comments live outside Yjs" comment.
6. **P2-6** — Re-validate plan/cap in the accept handler.
7. **P2-4, P2-5, P2-7, P2-8** — Cleanup/hardening; not launch-gating.

## What must be fixed before promoting the app publicly

- **P0-1 (same-user multi-tab clobber)** — non-negotiable; it silently loses saved work and defeats the reconciler that Phase 1 shipped.
- **P1-1 (share-link join)** — either fix it or remove the `?join=true` affordance so it doesn't silently fail in front of new users.
- **P1-2 (downgrade enforcement)** — required if Free/Pro tiering is part of the launch monetization story; it's currently unenforced for existing collaborators.
- Strongly recommended alongside: **P2-1** (share-link revocation) and **P2-3** (comment persistence duplication), both cheap and both touch data users can see disappear.

Everything else can ship as fast-follow.
