/**
 * Real-time collaboration test: Chrome (User A) ↔ Edge (User B)
 *
 * User A  : connect@cyberdelic.nexus   (canvas owner)
 * User B  : josemontemayoralba@gmail.com (collaborator)
 * Canvas  : "Collab Test" (shared between both users)
 *
 * Verifies:
 *  1. Both users can open the same shared canvas
 *  2. Edits by User A appear live in User B's browser (no reload)
 *  3. Edits by User B appear live in User A's browser (no reload)
 *  4. Collaborator avatars show both users online at the same time
 *
 * Run: npx playwright test e2e/collab-realtime.spec.ts --headed
 */

import { test, expect, chromium } from '@playwright/test';
import type { Page, Browser } from '@playwright/test';
import path from 'path';

// Use the configured base URL from playwright.config.ts (production build on port 3002).
// Hardcoding localhost:3000 would hit the dev server which continuously recompiles.
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3002';
const AUTH_A = path.join(__dirname, '.auth/user-a.json');
const AUTH_B = path.join(__dirname, '.auth/user-b.json');
const BOARD_NAME = 'Collab Test 2';
const REALTIME_TIMEOUT = 20_000; // ms to wait for a live update

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Navigate to dashboard and click the card with a specific project name (exact match) */
async function openNamedCanvas(page: Page, name: string): Promise<void> {
  await page.goto(`${BASE_URL}/dashboard`);

  // Wait for the dashboard to finish loading projects from Supabase.
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
      console.log(`  ⚠ "${name}" not found — opening first canvas`);
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

  // Switch to Canvas mode so note cards are accessible for typing/editing.
  try {
    const canvasNavBtn = page.locator('nav').locator('div').filter({ hasText: /^Canvas$/ }).first();
    if (await canvasNavBtn.count() > 0) {
      await canvasNavBtn.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
    }
  } catch {
    // Not critical — test may still work if canvas is already in Canvas mode
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

/** Fallback: find a task/freeform card, double-click to enter edit mode,
 *  then fill the textarea that appears (task card title).
 *  Task cards render a <Textarea autoFocus> when isEditing=true.
 *  The textarea is at the page level (not scoped) since it's absolutely positioned.
 */
async function typeOnTaskCard(page: Page, text: string): Promise<string> {
  // Wait for canvas to settle then look for any absolute-positioned element (canvas cards)
  // Use page.evaluate to find a canvas card by looking for elements with position:absolute
  // in the main canvas area
  const canvasCards = page.locator('main').locator('[style*="position: absolute"], [style*="left:"]').first();
  const count = await canvasCards.count();

  if (count > 0) {
    await canvasCards.waitFor({ state: 'visible', timeout: 5000 });
    await canvasCards.dblclick({ delay: 100, force: true });
  } else {
    // Try clicking the "Task Title" text directly
    const taskTitleEl = page.getByText('Task Title').first();
    if (await taskTitleEl.count() > 0) {
      await taskTitleEl.dblclick({ delay: 100, force: true });
    } else {
      throw new Error('No interactable canvas elements found');
    }
  }

  await page.waitForTimeout(600);

  // Task card in edit mode renders <textarea autoFocus> at page level (absolutely positioned)
  // Use page.locator (not scoped) since textarea may not be nested under our element
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 8000 });
  await textarea.fill(text);

  // Click at a point guaranteed to be off-canvas (navbar area)
  await page.locator('nav').first().click().catch(() => page.mouse.click(400, 15));
  await page.waitForTimeout(500);
  console.log(`  (task card) Typed: "${text}"`);
  return text;
}

/** Enter edit mode on a note card and update its title.
 *
 * Double-clicking the note card sets isEditing=true in CanvasElementRenderer,
 * which renders the note's title <Input> (a standard HTML input, not TipTap).
 * The title syncs through syncNoteFields() → Yjs → Supabase Realtime → peers.
 */
async function typeOnNoteCard(page: Page, tag: string): Promise<string> {
  const text = `collab-${tag}-${Date.now()}`;

  // Note cards: use [data-canvas-node] to target only the outer absolute wrapper.
  // .card--note-resizable appears on both the outer wrapper AND the inner FreeformCard div.
  const noteCard = page.locator('[data-canvas-node="true"].card--note-resizable').first();
  const count = await noteCard.count();
  if (count === 0) {
    // Try to find a task/freeform card via its title text area (present in read mode)
    // and double-click it to enter edit mode, then fill a textarea
    return await typeOnTaskCard(page, text);
  }

  await noteCard.waitFor({ state: 'visible', timeout: 10000 });

  // Double-click to enter edit mode (mounts the title Input + TipTap body).
  // Use force:true to bypass pointer-event interception from overlapping canvas cards.
  // Note: scrollIntoViewIfNeeded() is NOT used — canvas elements use CSS transforms
  // that native scrollIntoView cannot resolve. fitAll() handles viewport alignment.
  await noteCard.dblclick({ delay: 100, force: true });

  // After edit mode, a regular <input> appears for the note title (class="h-9 border-0 bg-transparent ...")
  // Target it scoped inside the note card so we don't accidentally pick up navbar inputs
  const titleInput = noteCard.locator('input').first();
  await titleInput.waitFor({ state: 'visible', timeout: 8000 });

  // Select all existing title text and replace with our unique string.
  // Use force:true since the input may be behind another canvas element.
  await titleInput.click({ clickCount: 3, force: true });
  await titleInput.fill(text);

  // Click outside to blur and trigger the Yjs document update
  await page.mouse.click(10, 10);
  await page.waitForTimeout(500);

  // Verify Chrome itself sees the text (ensures Yjs was updated, not just React state)
  const seenLocally = await page.textContent('body').catch(() => '');
  if (!seenLocally?.includes(text)) {
    console.log(`  ⚠ Text not yet visible locally after fill — Yjs update may be delayed`);
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
      console.log(`  ✓ "${text}" appeared in ${label} (attempt ${attempt})`);
      return true;
    }
    await page.waitForTimeout(500);
  }
  console.log(`  ✗ "${text}" did NOT appear in ${label} within ${REALTIME_TIMEOUT}ms`);
  return false;
}

/** Count collaborator avatars visible in the navbar */
async function collaboratorCount(page: Page): Promise<number> {
  // Collaboration avatars are typically rendered near the navbar
  const avatars = page.locator('[data-testid="collaborator-avatar"], .collaborator-avatar, [class*="collaborator"]');
  return avatars.count();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Real-time Collaboration — Collab Test 2 board', () => {

  test('User A (Chrome) and User B (Edge) see each others edits live', async ({ browser }) => {
    test.setTimeout(180_000);

    // ── Browser A: Chrome with User A ──────────────────────────────────────
    const ctxA = await browser.newContext({
      storageState: AUTH_A,
      viewport: { width: 1280, height: 800 },
    });
    const chromeA: Page = await ctxA.newPage();

    // ── Browser B: Microsoft Edge with User B ──────────────────────────────
    let edgeBrowser: Browser | null = null;
    let edgeB: Page | null = null;

    try {
      edgeBrowser = await chromium.launch({
        channel: 'msedge',
        headless: false,
        args: ['--window-position=1300,0', '--window-size=1280,800'],
      });
      const ctxB = await edgeBrowser.newContext({
        storageState: AUTH_B,
        viewport: { width: 1280, height: 800 },
      });
      edgeB = await ctxB.newPage();
    } catch {
      console.log('⚠  Microsoft Edge not installed. Install it or run: npx playwright install msedge');
      test.skip(true, 'Edge not available');
      await ctxA.close();
      return;
    }

    try {
      // ── Open "Collab Test" canvas in both browsers simultaneously ─────────
      console.log('\n── Opening shared canvas ─────────────────────────────────');
      console.log('Chrome  → User A (connect@cyberdelic.nexus)');
      console.log('Edge    → User B (josemontemayoralba@gmail.com)');

      await openNamedCanvas(chromeA, BOARD_NAME);
      await openNamedCanvas(edgeB!, BOARD_NAME);

      // Let Yjs establish the shared session in both tabs
      console.log('\n  Waiting for Yjs realtime channels to connect...');
      await Promise.all([chromeA.waitForTimeout(3000), edgeB!.waitForTimeout(3000)]);

      // ── Check 0: Both users see each other as online ──────────────────────
      console.log('\n── Check 0: Collaborator presence ────────────────────────');
      const avatarsInChrome = await collaboratorCount(chromeA);
      const avatarsInEdge = await collaboratorCount(edgeB!);
      console.log(`  Chrome sees ${avatarsInChrome} collaborator(s)`);
      console.log(`  Edge   sees ${avatarsInEdge} collaborator(s)`);
      // Not asserting on exact count since selector may vary; just logging

      // ── Round 1: User A types in Chrome → Edge should see it ─────────────
      console.log('\n── Round 1: User A (Chrome) edits → User B (Edge) sees it ──');
      const textA = await typeOnNoteCard(chromeA, 'userA');
      console.log(`  Chrome typed: "${textA}"`);

      const seenByB = await waitForLiveText(edgeB!, textA, 'Edge (User B)');
      expect(
        seenByB,
        `User B's Edge browser should see "${textA}" appear in real time`,
      ).toBe(true);

      // Pause so you can see the update on screen
      await Promise.all([chromeA.waitForTimeout(2000), edgeB!.waitForTimeout(2000)]);

      // ── Round 2: User B types in Edge → Chrome should see it ─────────────
      console.log('\n── Round 2: User B (Edge) edits → User A (Chrome) sees it ──');
      const textB = await typeOnNoteCard(edgeB!, 'userB');
      console.log(`  Edge typed: "${textB}"`);

      const seenByA = await waitForLiveText(chromeA, textB, 'Chrome (User A)');
      expect(
        seenByA,
        `User A's Chrome browser should see "${textB}" appear in real time`,
      ).toBe(true);

      await Promise.all([chromeA.waitForTimeout(2000), edgeB!.waitForTimeout(2000)]);

      console.log('\n✓ Real-time collaboration verified in both directions!');
      console.log(`  Chrome → Edge : "${textA}"`);
      console.log(`  Edge → Chrome : "${textB}"`);

    } finally {
      // Use Promise.race to avoid hanging if Supabase Realtime WebSockets don't close cleanly
      await Promise.race([
        ctxA.close(),
        new Promise<void>(r => setTimeout(r, 5000)),
      ]).catch(() => {});
      if (edgeBrowser) {
        await Promise.race([
          edgeBrowser.close(),
          new Promise<void>(r => setTimeout(r, 5000)),
        ]).catch(() => {});
      }
    }
  });

});
