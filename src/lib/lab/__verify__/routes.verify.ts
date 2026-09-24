// Run: npx tsx src/lib/lab/__verify__/routes.verify.ts
// Calls the lab route handlers directly with constructed Requests. Offline: no
// request reaches validation-passing paid work (the arm is faked through
// runnerDeps, and paid judges are never selected). Works in a throwaway temp
// dir (chdir): no lab-data/ junk left behind.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};

const env = process.env as Record<string, string | undefined>;
const BASE = "http://localhost:3001";

function req(pathname: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): Request {
  const headers: Record<string, string> = { host: "localhost:3001", ...init.headers };
  return new Request(`${BASE}${pathname}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
  });
}
const json = (body: unknown, headers: Record<string, string> = {}) =>
  ({ method: "POST", headers: { "content-type": "application/json", ...headers }, body });

async function main() {
  const originalCwd = process.cwd();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lab-routes-"));
  process.chdir(tmp);

  const runs = await import("@/app/api/lab/runs/route");
  const meta = await import("@/app/api/lab/meta/route");
  const inputs = await import("@/app/api/lab/inputs/route");
  const votes = await import("@/app/api/lab/votes/route");
  const leaderboard = await import("@/app/api/lab/leaderboard/route");
  const pair = await import("@/app/api/lab/pair/route");
  const runById = await import("@/app/api/lab/runs/[id]/route");
  const retry = await import("@/app/api/lab/runs/[id]/retry/route");

  const runner = await import("../runner");
  // Belt and braces: if any request below were to start a run, it must not call a model.
  const { EXEMPLARS } = await import("@/lib/maps/exemplars");
  const { renderMap } = await import("@/lib/maps/render");
  const { CORPUS } = await import("../corpus");
  const { CONFIRM_THRESHOLD_USD } = await import("../config");
  const rendered = renderMap(EXEMPLARS[0].graph);
  let armCalls = 0;
  let allowArm = false;
  runner.runnerDeps.runArm = async () => {
    armCalls++;
    if (!allowArm) throw new Error("offline verify: no model calls");
    return {
      graph: EXEMPLARS[0].graph, elements: rendered.elements, edges: rendered.edges, structureViolations: [],
      inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 1,
    };
  };
  const waitSettled = async (id: string) => {
    for (let i = 0; i < 200; i++) {
      const r = await runner.getRun(id);
      if (r && r.status !== "running") return r;
      await new Promise((res) => setTimeout(res, 20));
    }
    throw new Error("run did not settle");
  };

  // A config that fails validation (no inputs), so a request that passes the gate stops at 400.
  const invalidRun = { confirmed: true, config: { inputIds: [], arms: ["graph"], modelIds: ["claude-haiku-4-5"], forcedType: null, judges: [], budgetUsd: 1 } };

  try {
    // ── I1: production 404 ──
    const prevEnv = env.NODE_ENV;
    env.NODE_ENV = "production";
    check("production: GET meta is 404", (await meta.GET(req("/api/lab/meta"))).status === 404);
    check("production: POST runs is 404", (await runs.POST(req("/api/lab/runs", json(invalidRun)))).status === 404);
    check("production: GET run by id is 404", (await runById.GET(req("/api/lab/runs/x"), { params: { id: "x" } })).status === 404);
    env.NODE_ENV = prevEnv ?? "development";

    // ── I1: foreign Host ──
    check("foreign Host is 403", (await runs.POST(req("/api/lab/runs", json(invalidRun, { host: "evil.example:3001" })))).status === 403);
    check("LAN address Host is 403", (await meta.GET(req("/api/lab/meta", { headers: { host: "192.168.1.20:3001" } }))).status === 403);
    check("rebinding-style Host with userinfo is 403", (await meta.GET(req("/api/lab/meta", { headers: { host: "evil@localhost:3001" } }))).status === 403);
    check("non-loopback X-Forwarded-For is 403",
      (await meta.GET(req("/api/lab/meta", { headers: { "x-forwarded-for": "192.168.1.20" } }))).status === 403);

    // ── I1: cross-site Origin / Sec-Fetch-Site ──
    check("cross-site Origin is 403", (await runs.POST(req("/api/lab/runs", json(invalidRun, { origin: "https://evil.example" })))).status === 403);
    check("other loopback port Origin is 403", (await runs.POST(req("/api/lab/runs", json(invalidRun, { origin: "http://localhost:4000" })))).status === 403);
    check("opaque null Origin is 403", (await runs.POST(req("/api/lab/runs", json(invalidRun, { origin: "null" })))).status === 403);
    check("Sec-Fetch-Site cross-site is 403",
      (await runs.POST(req("/api/lab/runs", json(invalidRun, { "sec-fetch-site": "cross-site" })))).status === 403);

    // ── I1: text/plain POST (the no-preflight CSRF shape) ──
    const plain = await runs.POST(req("/api/lab/runs", { method: "POST", headers: { "content-type": "text/plain" }, body: invalidRun }));
    check("text/plain POST to runs is 403", plain.status === 403);
    const noType = await votes.POST(req("/api/lab/votes", { method: "POST", headers: {}, body: "{}" }));
    check("POST without content-type to votes is 403", noType.status === 403);
    const plainRetry = await retry.POST(req("/api/lab/runs/x/retry", { method: "POST", headers: { "content-type": "text/plain" }, body: { cellId: "c" } }), { params: { id: "x" } });
    check("text/plain POST to retry is 403", plainRetry.status === 403);
    const plainInput = await inputs.POST(req("/api/lab/inputs", { method: "POST", headers: { "content-type": "text/plain;charset=UTF-8" }, body: {} }));
    check("text/plain POST to inputs is 403", plainInput.status === 403);

    // ── I1: the good request passes the gate and stops at validation ──
    const good = await runs.POST(req("/api/lab/runs", json(invalidRun, { origin: BASE, "sec-fetch-site": "same-origin", "x-forwarded-for": "127.0.0.1" })));
    check(`same-origin JSON POST passes the gate and fails validation (${good.status})`, good.status === 400);
    const goodCharset = await runs.POST(req("/api/lab/runs", json(invalidRun, { "content-type": "application/json; charset=utf-8" })));
    check("application/json with charset passes the gate", goodCharset.status === 400);
    check("GET meta from localhost is 200", (await meta.GET(req("/api/lab/meta"))).status === 200);
    check("GET meta via 127.0.0.1 is 200", (await meta.GET(req("/api/lab/meta", { headers: { host: "127.0.0.1:3001" } }))).status === 200);
    check("GET meta via [::1] is 200", (await meta.GET(req("/api/lab/meta", { headers: { host: "[::1]:3001", "x-forwarded-for": "::1" } }))).status === 200);
    const lbDefault = await leaderboard.GET(req("/api/lab/leaderboard"));
    const lbBody = (await lbDefault.json()) as { leaderboard: { promptVersion: string | null }; currentPromptVersion: string };
    check("GET leaderboard defaults to the current prompt version",
      lbDefault.status === 200 && lbBody.leaderboard.promptVersion === lbBody.currentPromptVersion && !!lbBody.currentPromptVersion);
    const lbAll = (await (await leaderboard.GET(req("/api/lab/leaderboard?versions=all"))).json()) as typeof lbBody;
    check("GET leaderboard?versions=all counts every version", lbAll.leaderboard.promptVersion === null);
    check("GET pair from localhost is 200", (await pair.GET(req("/api/lab/pair"))).status === 200);
    check("GET inputs from localhost is 200", (await inputs.GET(req("/api/lab/inputs"))).status === 200);
    check("GET runs from localhost is 200", (await runs.GET(req("/api/lab/runs"))).status === 200);
    check("no model was called", armCalls === 0);

    // ── M3: declining confirmation caps the budget server-side ──
    allowArm = true;
    const cheap = (confirmed: boolean, budgetUsd: number) => ({
      confirmed,
      config: { inputIds: [CORPUS[0].id], arms: ["graph"], modelIds: ["gemini-3.8-flash"], forcedType: null, judges: ["rubric"], budgetUsd },
    });
    const unconfirmed = await runs.POST(req("/api/lab/runs", json(cheap(false, 150))));
    const uBody = (await unconfirmed.json()) as { run: { id: string; config: { budgetUsd: number } } };
    check(`unconfirmed run budget is clamped to $${CONFIRM_THRESHOLD_USD} (${uBody.run?.config.budgetUsd})`,
      unconfirmed.status === 201 && uBody.run.config.budgetUsd === CONFIRM_THRESHOLD_USD);
    const confirmedRes = await runs.POST(req("/api/lab/runs", json(cheap(true, 150))));
    const cBody = (await confirmedRes.json()) as { run: { id: string; config: { budgetUsd: number } } };
    check("confirmed run keeps its budget", confirmedRes.status === 201 && cBody.run.config.budgetUsd === 150);
    const under = await runs.POST(req("/api/lab/runs", json(cheap(false, 1))));
    const underBody = (await under.json()) as typeof uBody;
    check("unconfirmed budget under the threshold is kept", underBody.run.config.budgetUsd === 1);
    await waitSettled(underBody.run.id);

    // ── I2: retry refusals surface as 409 with a message ──
    const settled = await waitSettled(uBody.run.id);
    const doneCell = settled.cells.find((c) => c.status === "done");
    check("clamped run completed a cell", !!doneCell);
    const refused = await retry.POST(req(`/api/lab/runs/${settled.id}/retry`, json({ cellId: doneCell!.id })), { params: { id: settled.id } });
    const refusedBody = (await refused.json()) as { error?: string };
    check("retrying a done cell is 409 with a message", refused.status === 409 && /already succeeded/.test(refusedBody.error ?? ""));
    const missingRun = await retry.POST(req("/api/lab/runs/run-nope/retry", json({ cellId: "c" })), { params: { id: "run-nope" } });
    check("retrying in an unknown run is 404", missingRun.status === 404);
    await waitSettled(cBody.run.id);
    allowArm = false;
  } finally {
    process.chdir(originalCwd);
    await new Promise((r) => setTimeout(r, 100));
    await fs.rm(tmp, { recursive: true, force: true });
  }

  if (failures) { console.error(`${failures} FAILED`); process.exit(1); }
  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); });
