// End-to-end: start a tiny real run (2 inputs x 2 arms, Gemini 3.8 Flash,
// no LLM judges — well under $0.05), wait for it, cast votes, and confirm the
// leaderboard renders. Requires `npm run dev` serving the lab at LAB_URL.
//
// LAB_URL: base URL of the dev server, e.g. LAB_URL=http://localhost:3047
// (`npx next dev -p 3047`). The :3000 fallback is only the Next.js default;
// set LAB_URL whenever another app already holds port 3000.
//
// Cost safety: the script refuses to click "start" unless exactly the intended
// 4 cells are selected and the page's own estimate is <= MAX_ESTIMATE_USD, and
// it never confirms a cost-confirmation step: it aborts instead.
//
// Playwright is not a project dependency; `import "playwright"` resolves through
// Node's parent-directory lookup (e.g. a user-level node_modules) or a local install.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.LAB_URL ?? "http://localhost:3000";
const MAX_ESTIMATE_USD = 0.1;
const EXPECTED_CELLS = 4;
const INPUTS = ["cmp-app-live", "cmp-churn"];
const ARMS = ["graph", "graphExemplars"];
const MODEL = "gemini-3.8-flash";
const LLM_JUDGES = ["llmStrong", "llmCheap"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
// No native dialogs are expected; never accept one blindly.
page.on("dialog", (d) => d.dismiss());

/** First of several waits to settle; the losers are swallowed so they can't crash the process later. */
function firstOf(waits) {
  return Promise.race(waits.map(([label, p]) => p.then(() => label, () => "timeout")));
}

/** Leave exactly `wanted` checked among the checkboxes whose testid starts with `prefix`. */
async function selectExactly(prefix, wanted) {
  const boxes = page.locator(`input[type="checkbox"][data-testid^="${prefix}"]`);
  const n = await boxes.count();
  for (let i = 0; i < n; i++) {
    const box = boxes.nth(i);
    const id = (await box.getAttribute("data-testid")).slice(prefix.length);
    const want = wanted.includes(id);
    if ((await box.isChecked()) !== want && (await box.isEnabled())) await box.setChecked(want);
  }
  for (const id of wanted) {
    if (!(await page.getByTestId(`${prefix}${id}`).isChecked())) throw new Error(`${prefix}${id} is not checked`);
  }
}

try {
  await page.goto(`${BASE}/lab`);
  await page.getByTestId("tab-runs").click();
  await page.getByTestId(`input-option-${INPUTS[0]}`).waitFor({ timeout: 60_000 });

  // Defaults today: arm "graph", model Sonnet 5, judges rubric + structure. Set everything explicitly.
  await selectExactly("input-option-", INPUTS);
  await selectExactly("arm-", ARMS);
  await selectExactly("model-", [MODEL]);
  for (const j of LLM_JUDGES) {
    const box = page.getByTestId(`judge-${j}`);
    if ((await box.count()) && (await box.isChecked())) await box.uncheck();
    if ((await box.count()) && (await box.isChecked())) throw new Error(`LLM judge ${j} is still on`);
  }
  // Smallest valid budget: the runner halts once it is spent.
  await page.getByTestId("budget").fill("0.5");

  // ── Cost gate: read the live form before starting ──
  const cells = Number((await page.locator("dt", { hasText: /^Cells$/ }).locator("xpath=following-sibling::dd").textContent()).trim());
  const estimateText = (await page.getByTestId("estimate").textContent()).trim();
  const estimate = Number(estimateText.replace(/[^0-9.]/g, ""));
  console.log(`pre-start: cells=${cells}, estimate=${estimateText}`);
  if (cells !== EXPECTED_CELLS) throw new Error(`ABORT: expected ${EXPECTED_CELLS} cells, form shows ${cells}`);
  if (!Number.isFinite(estimate) || estimate > MAX_ESTIMATE_USD) {
    throw new Error(`ABORT: estimate ${estimateText} is over the $${MAX_ESTIMATE_USD} safety cap`);
  }

  await page.getByTestId("start-run").click();
  const outcome = await firstOf([
    ["started", page.getByTestId("run-status").waitFor({ timeout: 30_000 })],
    ["confirm", page.getByTestId("confirm-run").waitFor({ timeout: 30_000 })],
  ]);
  if (outcome === "timeout") throw new Error("the run did not start within 30s");
  if (outcome === "confirm") throw new Error("ABORT: the server asked for cost confirmation; not confirming");

  await page.waitForFunction(
    () => /done|stopped/.test(document.querySelector('[data-testid="run-status"]')?.textContent ?? ""),
    null,
    { timeout: 240_000 },
  );
  const statuses = await page.getByTestId("cell-status").allTextContents();
  const done = statuses.filter((s) => s.trim() === "done").length;
  console.log(`cells: ${statuses.join(", ")}`);

  // Summary of the newest run, straight from the lab API (read-only GETs).
  const summary = await page.evaluate(async () => {
    const { runs } = await (await fetch("/api/lab/runs")).json();
    const latest = [...runs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    const { run } = await (await fetch(`/api/lab/runs/${encodeURIComponent(latest.id)}`)).json();
    return {
      id: run.id, status: run.status, spentUsd: run.spentUsd, estimateUsd: run.estimateUsd,
      cells: run.cells.map((c) => ({
        input: c.inputId, arm: c.arm, model: c.modelId, status: c.status, mapType: c.mapType,
        costUsd: c.costUsd, latencyMs: c.latencyMs, error: c.error, structureViolations: c.structureViolations,
      })),
    };
  });
  console.log(`run summary: ${JSON.stringify(summary, null, 2)}`);
  if (done < 2) throw new Error(`expected at least 2 done cells, got ${done}`);

  await page.getByTestId("tab-compare").click();
  const voteReady = page.locator('[data-testid="vote-left"]:not([disabled])');
  let votes = 0;
  for (let i = 0; i < 3; i++) {
    // Wait for the next pair (buttons enabled) or the empty state.
    const state = await firstOf([
      ["empty", page.getByTestId("no-pairs").waitFor({ timeout: 20_000 })],
      ["pair", voteReady.waitFor({ timeout: 20_000 })],
    ]);
    if (state === "timeout") throw new Error("neither a pair nor the empty state appeared within 20s");
    if (state === "empty") break;
    await page.getByTestId("vote-left").click();
    votes++;
    // The reveal keeps the buttons disabled for ~1.4s; let it start before re-checking.
    await page.locator('[data-testid="vote-left"][disabled]').waitFor({ timeout: 5_000 }).catch(() => {});
  }
  if (votes < 1) throw new Error("no pairs were offered for voting");

  await page.getByTestId("tab-leaderboard").click();
  await page.waitForSelector('[data-testid="leaderboard-row"]', { timeout: 15_000 });
  console.log(`E2E PASS: ${done} cells done, ${votes} vote(s) cast, leaderboard rendered`);
} catch (e) {
  mkdirSync("lab-data", { recursive: true });
  await page.screenshot({ path: "lab-data/e2e-failure.png", fullPage: true }).catch(() => {});
  console.error("E2E FAIL:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
