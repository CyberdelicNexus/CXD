/**
 * Collaboration with Persistence test: Two Chrome contexts (User A + User B)
 *
 * User A  : connect@cyberdelic.nexus        (canvas owner)
 * User B  : josemontemayoralba@gmail.com    (collaborator)
 * Canvas  : "Collab Test 2" (shared between both users)
 *
 * Verifies:
 *  1. Both users can open the same shared canvas in separate Chrome contexts
 *  2. Collaborator (User B) edits a note card
 *  3. Owner (User A) sees the edit in real-time (no reload)
 *  4. Both users reload — the edit persists for both
 *
 * Advantages over collab-realtime.spec.ts:
 *  - Chrome-only (no Microsoft Edge dependency)
 *  - Also verifies persistence after reload, not just real-time sync
 *
 * Run: npx playwright test e2e/collab-persistence.spec.ts --headed
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';

// Use the configured base URL from playwright.config.ts (production build on port 3002).
// Hardcoding localhost:3000 would hit the dev server which continuously recompiles.
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3002';
const AUTH_A = path.join(__dirname, '.auth/user-a.json');
const AUTH_B = path.join(__dirname, '.auth/user-b.json');
const BOARD_NAME = 'Collab Test 2';
const REALTIME_TIMEOUT = 20_000; // ms to wait for a live update

// ─── Helpers (copied from collab-realtime.spec.ts, NOT imported) ──────────────

/** Navigate to dashboard and click the card with a specific project name (exact match) */
async function openNamedCanvas(page: Page, name: string): Promise<void> {
  await page.goto(`${BASE_URL}/dashboard`);

  // Wait for the dashboard to finish loading projects from Supabase.
  // Without this, project cards may not be visible yet.
  await page.waitForSelector('text=Loading your projects...', { state: 'hidden', timeout: 30000 })
    .catch(() => { /* proceed if never shown */ });

  // Wait for dashboard to populate
  const anyCard = page.locator('.aspect-square.cursor-pointer').first();
  await anyCard.waitFor({ timeout: 20000 });

  // Log all card texts so we know what's on the dashboard
  const allCards = page.locator('.aspect-square.cursor-pointer');
  const cardCount = await allCards.count();
  const cardTexts: string[] = [];
  for (let i = 0; i < cardCount; i++) {
    const t = ((await allCards.nth(i).textContent()) ?? '').trim().split('\n')[0].trim();
    cardTexts.push(t);
  }
  console.log(`  Dashboard cards (${cardCount}): ${cardTexts.map(t => `"${t}"`).join(', ')}`);

  // Card text has no newlines — text is like "OwnerCollab Test 2Mar 20, 2026"
  // Use substring match but find the first card whose text contains the exact board name
  let clicked = false;
  for (let i = 0; i < cardCount; i++) {
    const card = allCards.nth(i);
    const fullText = ((await card.textContent()) ?? '').trim();
    if (fullText.includes(name)) {
      console.log(`  Opening card containing "${name}"...`);
      await card.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    // Try img alt attribute as a fallback
    const imgCard = page.locator(`.aspect-square.cursor-pointer:has(img[alt="${name}"])`).first();
    if (await imgCard.count() > 0) {
      console.log(`  Opening "${name}" via img[alt]...`);
      await imgCard.click();
      clicked = true;
    } else {
      console.log(`  WARNING: "${name}" not found — opening first canvas`);
      await anyCard.click();
    }
  }

  await page.waitForURL(`${BASE_URL}/cxd`, { timeout: 15000 });
  // Wait for Yjs to load from Supabase (especially for collaborators who have no IndexedDB cache)
  // Collaborators may need extra time for the Supabase Realtime channel to sync
  await page.waitForTimeout(8000);

  // Verify canvas loaded (check navbar shows the project name)
  const navTitle = await page.locator('nav').first().textContent().catch(() => '');
  console.log(`  Canvas loaded: "${navTitle?.trim().slice(0, 40) ?? 'unknown'}"`);

  // Canvases open in their last-used mode (often Framing for new/untouched canvases).
  // Switch to Canvas mode to ensure note cards are accessible for typing.
  try {
    const canvasNavBtn = page.locator('nav').locator('div').filter({ hasText: /^Canvas$/ }).first();
    if (await canvasNavBtn.count() > 0) {
      await canvasNavBtn.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      console.log('  Switched to Canvas mode');
    }
  } catch {
    console.log('  Note: Could not switch to Canvas mode');
  }

  // Click "Fit All" to bring all canvas elements into the viewport.
  // Canvas cards use CSS transforms — scrollIntoViewIfNeeded() won't work without this.
  try {
    // Wait up to 5s for the navigation toolkit to render after Canvas mode switch
    const fitAllBtn = page.locator('button[title="Fit All"]').first();
    await fitAllBtn.waitFor({ state: 'visible', timeout: 5000 });
    await fitAllBtn.click({ timeout: 3000 });
    await page.waitForTimeout(800);
    console.log('  Fit All — all elements visible');
  } catch {
    console.log('  Fit All button not found, continuing (elements may still be in viewport)');
  }
}

/** Enter edit mode on a note card and update its title.
 *
 * Double-clicking the note card sets isEditing=true in CanvasElementRenderer,
 * which renders the note's title <Input> (a standard HTML input, not TipTap).
 * The title syncs through syncNoteFields() -> Yjs -> Supabase Realtime -> peers.
 *
 * Returns the unique text that was typed.
 */
async function typeOnNoteCard(page: Page, tag: string): Promise<string> {
  const text = `collab-${tag}-${Date.now()}`;

  // Note cards: use [data-canvas-node] to target only the outer absolute wrapper.
  // .card--note-resizable appears on both the outer wrapper AND the inner FreeformCard div.
  const noteCard = page.locator('[data-canvas-node="true"].card--note-resizable').first();
  const count = await noteCard.count();

  if (count === 0) {
    // Fallback: find a task/freeform card via absolutely positioned element
    const canvasCards = page.locator('main').locator('[style*="position: absolute"], [style*="left:"]').first();
    const cardCount = await canvasCards.count();

    if (cardCount > 0) {
      await canvasCards.waitFor({ state: 'visible', timeout: 5000 });
      await canvasCards.dblclick({ delay: 100, force: true });
    } else {
      const taskTitleEl = page.getByText('Task Title').first();
      if (await taskTitleEl.count() > 0) {
        await taskTitleEl.dblclick({ delay: 100, force: true });
      } else {
        throw new Error('No interactable canvas elements found');
      }
    }

    await page.waitForTimeout(600);
    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 8000 });
    await textarea.fill(text);
    await page.locator('nav').first().click().catch(() => page.mouse.click(400, 15));
    await page.waitForTimeout(500);
    console.log(`  (task card fallback) Typed: "${text}"`);
    return text;
  }

  await noteCard.waitFor({ state: 'visible', timeout: 10000 });

  // Double-click to enter edit mode (mounts the title Input + TipTap body).
  // Use force:true to bypass pointer-event interception from overlapping canvas cards.
  // Note: scrollIntoViewIfNeeded() is NOT used here — canvas elements use CSS transforms
  // that the browser's scrollIntoView cannot resolve. fitAll() in openNamedCanvas handles
  // bringing elements into viewport before this function is called.
  await noteCard.dblclick({ delay: 100, force: true });

  // After edit mode, a regular <input> appears for the note title
  // Target it scoped inside the note card so we don't accidentally pick up navbar inputs
  const titleInput = noteCard.locator('input[data-no-drag]').first();
  const hasDataNoDrag = await titleInput.count();

  const inputEl = hasDataNoDrag > 0
    ? titleInput
    : noteCard.locator('input').first();

  await inputEl.waitFor({ state: 'visible', timeout: 8000 });

  // Select all existing title text and replace with our unique string.
  // Use force:true since the input may be behind another canvas element.
  await inputEl.click({ clickCount: 3, force: true });
  await inputEl.fill(text);

  // Click outside to blur and trigger the Yjs document update
  await page.mouse.click(10, 10);
  await page.waitForTimeout(500);

  // Verify locally visible
  const seenLocally = await page.textContent('body').catch(() => '');
  if (!seenLocally?.includes(text)) {
    console.log(`  WARNING: Text not yet visible locally after fill — Yjs update may be delayed`);
  }

  console.log(`  Typed: "${text}"`);
  return text;
}

/** Poll the page body until the given text appears (live sync), or timeout. */
async function waitForLiveText(page: Page, text: string, label: string): Promise<boolean> {
  const deadline = Date.now() + REALTIME_TIMEOUT;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    const body = await page.textContent('body').catch(() => '');
    if (body?.includes(text)) {
      console.log(`  OK "${text}" appeared in ${label} (attempt ${attempt})`);
      return true;
    }
    await page.waitForTimeout(500);
  }
  console.log(`  FAIL "${text}" did NOT appear in ${label} within ${REALTIME_TIMEOUT}ms`);
  return false;
}

/** Hard reload the page and wait for Yjs to load from IndexedDB + Supabase. */
async function hardReload(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000); // Yjs load from IndexedDB + Supabase
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Collaboration with Persistence', () => {

  test('Collaborator edits => owner sees live => both reload => changes persist', async ({ browser }) => {
    test.setTimeout(180_000);

    // ── Context A: Chrome with User A (owner) ──────────────────────────────
    const ctxOwner: BrowserContext = await browser.newContext({
      storageState: AUTH_A,
      viewport: { width: 1280, height: 800 },
    });

    // ── Context B: Chrome with User B (collaborator) ───────────────────────
    const ctxCollab: BrowserContext = await browser.newContext({
      storageState: AUTH_B,
      viewport: { width: 1280, height: 800 },
    });

    const pageOwner: Page = await ctxOwner.newPage();
    const pageCollab: Page = await ctxCollab.newPage();

    try {
      // ── Both open the shared board ──────────────────────────────────────
      console.log('\n── Opening shared canvas ──');
      console.log(`  Context A -> User A (owner): ${AUTH_A}`);
      console.log(`  Context B -> User B (collaborator): ${AUTH_B}`);

      await openNamedCanvas(pageOwner, BOARD_NAME);
      await openNamedCanvas(pageCollab, BOARD_NAME);

      // Let Yjs realtime channels establish in both contexts
      console.log('\n  Waiting for Yjs realtime channels to connect...');
      await Promise.all([
        pageOwner.waitForTimeout(3000),
        pageCollab.waitForTimeout(3000),
      ]);

      // ── Collaborator edits a note card ──────────────────────────────────
      console.log('\n── Collaborator (User B) edits ──');
      const collabText = await typeOnNoteCard(pageCollab, 'collab-persist');
      console.log(`  Collaborator typed: "${collabText}"`);

      // ── Owner should see it in real-time (no reload) ────────────────────
      console.log('\n── Checking real-time sync to owner (User A) ──');
      const ownerSeesIt = await waitForLiveText(pageOwner, collabText, 'Owner (User A)');
      expect(ownerSeesIt, `Owner should see "${collabText}" in real-time without reloading`).toBe(true);

      // ── Wait for persistence: debounce (~2s) + Supabase write (~3s) ─────
      console.log('\n── Waiting for persistence (debounce + Supabase write)... ──');
      await Promise.all([
        pageOwner.waitForTimeout(6000),
        pageCollab.waitForTimeout(6000),
      ]);

      // ── Both reload ─────────────────────────────────────────────────────
      console.log('\n── Both users reload ──');
      await Promise.all([
        hardReload(pageOwner),
        hardReload(pageCollab),
      ]);

      // ── Verify persisted for both ────────────────────────────────────────
      console.log('\n── Verifying persistence after reload ──');
      const ownerBody = await pageOwner.textContent('body');
      const collabBody = await pageCollab.textContent('body');

      expect(ownerBody, `Owner should see "${collabText}" after reload`).toContain(collabText);
      console.log(`  OK Owner sees "${collabText}" after reload`);

      expect(collabBody, `Collaborator should see "${collabText}" after reload`).toContain(collabText);
      console.log(`  OK Collaborator sees "${collabText}" after reload`);

      console.log('\nCollaboration with persistence verified successfully!');
      console.log(`  Text: "${collabText}"`);
      console.log('  - Real-time sync: Owner saw collaborator edit without reload');
      console.log('  - Persistence: Both users see edit after reload');

    } finally {
      // Close browser contexts. Use a short timeout to avoid hanging on
      // Supabase Realtime WebSocket connections that don't close cleanly.
      await Promise.race([
        ctxOwner.close(),
        new Promise<void>(r => setTimeout(r, 5000)),
      ]).catch(() => {});
      await Promise.race([
        ctxCollab.close(),
        new Promise<void>(r => setTimeout(r, 5000)),
      ]).catch(() => {});
    }
  });

});
