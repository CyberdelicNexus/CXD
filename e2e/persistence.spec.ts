import { test, expect, Page, BrowserContext } from '@playwright/test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Go to dashboard and click the first canvas card to open it, then switch to Canvas mode. */
async function openFirstCanvas(page: Page): Promise<string> {
  await page.goto('/dashboard');

  // Wait for the dashboard to finish loading projects from Supabase.
  // Without this wait, project cards may not be rendered yet.
  await page.waitForSelector('text=Loading your projects...', { state: 'hidden', timeout: 30000 })
    .catch(() => { /* proceed if never visible */ });

  // Wait for project cards to render (they have cursor-pointer + aspect-square)
  const card = page.locator('.aspect-square.cursor-pointer').first();
  await card.waitFor({ timeout: 15000 });

  // Grab canvas name for logging
  const name = await card.locator('text=/\\w/').first().textContent().catch(() => 'unknown');
  console.log(`Opening canvas: "${name?.trim()}"`);

  // Click to open canvas — this calls loadProject() + router.push('/cxd')
  await card.click();
  await page.waitForURL('**/cxd', { timeout: 15000 });

  // Wait for Yjs/canvas to settle (navbar appears, then elements)
  await page.waitForTimeout(4000);

  // The canvas may open in any mode (Framing/Canvas/Map/Plan).
  // Persistence tests need Canvas mode to interact with note cards.
  // Click the "Canvas" button in the center navbar to ensure we're in Canvas mode.
  try {
    const canvasNavBtn = page.locator('nav').locator('div').filter({ hasText: /^Canvas$/ }).first();
    if (await canvasNavBtn.count() > 0) {
      await canvasNavBtn.click({ timeout: 5000 });
      await page.waitForTimeout(1000);
      console.log('  Switched to Canvas mode');
    }
  } catch {
    console.log('  Could not switch to Canvas mode, continuing');
  }

  // Click "Fit All" to pan/zoom the canvas so all elements are visible in the viewport.
  // Canvas elements use CSS transforms, so scrollIntoViewIfNeeded() won't bring them into view.
  try {
    // Wait up to 5s for the navigation toolkit to render after Canvas mode switch
    const fitAllBtn = page.locator('button[title="Fit All"]').first();
    await fitAllBtn.waitFor({ state: 'visible', timeout: 5000 });
    await fitAllBtn.click({ timeout: 3000 });
    await page.waitForTimeout(800);
    console.log('  Fit All clicked — all elements should be visible');
  } catch {
    console.log('  Fit All button not found, continuing (elements may still be in viewport)');
  }

  return name?.trim() ?? 'unknown';
}

/** Find the first editable text area on the canvas and type a unique string.
 *
 * Note cards use TipTap for the body and a plain Input for the title.
 * The editing UI only appears while the card is in edit mode (isEditing === true),
 * triggered by a double-click on the card element.
 *
 * Strategy: prefer the note title Input (data-no-drag) which is faster to mount
 * than the TipTap contenteditable body editor.
 */
async function editFirstEditable(page: Page, tag: string): Promise<string> {
  const text = `pw-${tag}-${Date.now()}`;

  // Note cards have class card--note-resizable on both the outer absolute wrapper
  // and the inner FreeformCard div. Use [data-canvas-node] to target only the outer wrapper.
  const noteCard = page.locator('[data-canvas-node="true"].card--note-resizable').first();
  const noteCardCount = await noteCard.count();

  if (noteCardCount > 0) {
    // Double-click the note card to set isEditing = true.
    // Use force:true to bypass pointer-event interception from overlapping cards
    // (canvas elements are absolutely positioned and may overlap each other).
    // Note: scrollIntoViewIfNeeded() is NOT used — canvas elements use CSS transforms
    // that native scrollIntoView cannot resolve. fitAll() handles viewport alignment.
    await noteCard.dblclick({ delay: 100, force: true });

    // Prefer the title Input (data-no-drag) — it mounts immediately on isEditing=true
    // TipTap (contenteditable) is also present but takes slightly longer to initialize
    const titleInput = noteCard.locator('input[data-no-drag]').first();
    const hasTitleInput = await titleInput.count();

    if (hasTitleInput > 0) {
      await titleInput.waitFor({ state: 'visible', timeout: 10000 });
      // Triple-click to select all, force:true bypasses viewport check for canvas-transformed elements
      await titleInput.click({ clickCount: 3, force: true });
      await titleInput.fill(text);
    } else {
      // Fallback: TipTap contenteditable body
      const editable = page.locator('[contenteditable]').first();
      await editable.waitFor({ state: 'visible', timeout: 15000 });
      await editable.click({ clickCount: 3 });
      await editable.fill(text);
    }

    // Click outside to blur and trigger onBlurCard → save debounce
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);
  } else {
    // Fallback: try any contenteditable already in DOM (e.g. task title inputs)
    const editables = page.locator('[contenteditable="true"]');
    const count = await editables.count();
    if (count > 0) {
      const el = editables.first();
      await el.click({ clickCount: 3 });
      await el.fill(text);
      await page.locator('body').click({ position: { x: 10, y: 10 } });
    } else {
      throw new Error('No editable cards found on canvas. Is there at least one note card?');
    }
  }

  console.log(`  Typed: "${text}"`);
  return text;
}

async function waitForSave(page: Page) {
  // Debounce is ~2s, Supabase write adds more. 5s is a safe buffer.
  await page.waitForTimeout(5000);
}

async function hardReload(page: Page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Give Yjs time to load from IndexedDB + Supabase
  await page.waitForTimeout(4000);
}

async function pageContains(page: Page, text: string): Promise<boolean> {
  const body = await page.textContent('body');
  return body?.includes(text) ?? false;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Save Reliability', () => {

  test('Test 1: Owner edit persists after hard reload', async ({ page }) => {
    await openFirstCanvas(page);

    const text = await editFirstEditable(page, 'owner');
    await waitForSave(page);

    await hardReload(page);

    expect(await pageContains(page, text)).toBe(true);
    console.log('✓ Owner edit persisted after reload');
  });

  test('Test 2: Simultaneous edits from two tabs both persist', async ({ browser }) => {
    const ctxA = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const ctxB = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await openFirstCanvas(pageA);
    await openFirstCanvas(pageB);

    // Note cards only expose contenteditable after double-click (isEditing = true)
    // Use [data-canvas-node] to target only the outer wrapper (not the inner FreeformCard div).
    const noteCardsA = pageA.locator('[data-canvas-node="true"].card--note-resizable');
    const noteCardsB = pageB.locator('[data-canvas-node="true"].card--note-resizable');
    const countA = await noteCardsA.count();
    const countB = await noteCardsB.count();

    if (countA < 1 || countB < 1) {
      test.skip(true, 'No note cards found on canvas');
      return;
    }

    const ts = Date.now();
    const textA = `pw-tabA-${ts}`;
    const textB = `pw-tabB-${ts}`;

    // Edit first card in Tab A — double-click to enter edit mode, then fill.
    // Use force:true to bypass pointer-event interception from overlapping canvas cards.
    await noteCardsA.first().scrollIntoViewIfNeeded();
    await noteCardsA.first().dblclick({ delay: 100, force: true });
    const titleInputA = noteCardsA.first().locator('input[data-no-drag]').first();
    const hasTitleA = await titleInputA.count();
    if (hasTitleA > 0) {
      await titleInputA.waitFor({ state: 'visible', timeout: 10000 });
      await titleInputA.click({ clickCount: 3 });
      await titleInputA.fill(textA);
    } else {
      const editableA = pageA.locator('[contenteditable]').first();
      await editableA.waitFor({ state: 'visible', timeout: 15000 });
      await editableA.click({ clickCount: 3 });
      await editableA.fill(textA);
    }
    await pageA.locator('body').click({ position: { x: 10, y: 10 } });

    // Edit a different card in Tab B (last if >1, else first)
    const cardB = countB > 1 ? noteCardsB.last() : noteCardsB.first();
    await cardB.scrollIntoViewIfNeeded();
    await cardB.dblclick({ delay: 100, force: true });
    const titleInputB = cardB.locator('input[data-no-drag]').first();
    const hasTitleB = await titleInputB.count();
    if (hasTitleB > 0) {
      await titleInputB.waitFor({ state: 'visible', timeout: 10000 });
      await titleInputB.click({ clickCount: 3 });
      await titleInputB.fill(textB);
    } else {
      const editableB = pageB.locator('[contenteditable]').first();
      await editableB.waitFor({ state: 'visible', timeout: 15000 });
      await editableB.click({ clickCount: 3 });
      await editableB.fill(textB);
    }
    await pageB.locator('body').click({ position: { x: 10, y: 10 } });

    console.log(`  Tab A: "${textA}", Tab B: "${textB}"`);

    await Promise.all([waitForSave(pageA), waitForSave(pageB)]);

    await Promise.all([hardReload(pageA), hardReload(pageB)]);

    const bodyA = await pageA.textContent('body');
    const bodyB = await pageB.textContent('body');

    expect(bodyA).toContain(textA);
    expect(bodyB).toContain(textB);
    // Cross-check: both edits should be visible in both tabs
    expect(bodyA).toContain(textB);
    expect(bodyB).toContain(textA);

    await ctxA.close();
    await ctxB.close();
    console.log('✓ Both simultaneous edits persisted in both tabs');
  });

  test('Test 3: Edit survives 10s network interruption', async ({ page, context }) => {
    await openFirstCanvas(page);

    const text = await editFirstEditable(page, 'offline');

    // Let IndexedDB capture it (synchronous on Y.Doc update) before going offline
    await page.waitForTimeout(500);

    await context.setOffline(true);
    console.log('  → Offline');

    // Stay offline — Supabase retries will queue up, IndexedDB holds the data
    await page.waitForTimeout(10000);

    await context.setOffline(false);
    console.log('  → Online — waiting for retry saves...');

    // Retry saves: 1s + 2s + 4s = up to 7s for 3 retries
    await page.waitForTimeout(8000);

    await hardReload(page);

    expect(await pageContains(page, text)).toBe(true);
    console.log('✓ Edit survived network interruption');
  });

});
