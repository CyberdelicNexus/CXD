// Run: npx tsx src/lib/lab/__verify__/library.verify.ts
// Offline. Calls the library route handlers and store directly in a throwaway
// temp dir (chdir): gating, promote checks (structure, legend, corpus
// similarity, faithfulness), atomic pending writes, a publish that fails
// part-way leaving everything consistent, and PROMPT_VERSION changing
// exactly once per publish.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { MapGraph } from "@/lib/maps/types";
import type { Cell, Run } from "../types";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};

const env = process.env as Record<string, string | undefined>;
const BASE = "http://localhost:3001";
function req(pathname: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): Request {
  return new Request(`${BASE}${pathname}`, {
    method: init.method ?? "GET",
    headers: { host: "localhost:3001", ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
const post = (pathname: string, body: unknown, headers: Record<string, string> = {}) =>
  req(pathname, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });

async function listTmp(dir: string): Promise<string[]> {
  try { return (await fs.readdir(dir)).filter((f) => f.endsWith(".tmp")); } catch { return []; }
}

async function main() {
  const originalCwd = process.cwd();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lab-library-"));
  process.chdir(tmp);

  const library = await import("@/app/api/lab/library/route");
  const promote = await import("@/app/api/lab/library/promote/route");
  const retire = await import("@/app/api/lab/library/retire/route");
  const publish = await import("@/app/api/lab/library/publish/route");
  const store = await import("../store");
  const lib = await import("../library-store");
  const { EXEMPLARS } = await import("@/lib/maps/exemplars");
  const { renderMap } = await import("@/lib/maps/render");
  const { CORPUS } = await import("../corpus");
  const { PROMPT_VERSION } = await import("../prompts");

  // The exemplar's own graph and input are mutually faithful (exemplars.verify
  // enforces this for every exemplar), so pairing them here means the "good"
  // fixture below is faithful by construction, and mutating either the graph
  // (legend/faithfulness violations) or the input (corpus clash) in isolation
  // exercises exactly one rule at a time.
  const goodExemplar = EXEMPLARS[0];
  const good = goodExemplar.graph;
  const goodInput = { id: "custom-good", type: goodExemplar.input.type, title: goodExemplar.input.title, text: goodExemplar.input.text, cards: goodExemplar.input.cards, expectedTypes: [], custom: true as const };
  const rendered = renderMap(good);

  const badGraph: MapGraph = JSON.parse(JSON.stringify(good));
  badGraph.nodes[0].tint = "rose"; // tinted with no legend entry

  const badNumberGraph: MapGraph = JSON.parse(JSON.stringify(good));
  // An invented number nothing in goodInput.text says.
  badNumberGraph.nodes[0].detail = `${badNumberGraph.nodes[0].detail} (48213 confirmed)`;

  const badUrlGraph: MapGraph = JSON.parse(JSON.stringify(good));
  const linkNode = badUrlGraph.nodes.find((n) => n.kind === "link");
  if (!linkNode) throw new Error("fixture: goodExemplar has no link node to mutate for the URL test");
  linkNode.props = JSON.stringify({ url: "https://not-in-the-input.example/report" });

  const base = (id: string, extra: Partial<Cell>): Cell => ({
    id, runId: "run-lib", inputId: goodInput.id, arm: "graphExemplars", modelId: "claude-haiku-4-5", status: "done",
    mapType: good.mapType, graph: good, elements: rendered.elements, edges: rendered.edges,
    structureViolations: [], rubricErrors: [], rubricWarnings: [], judges: [], latencyMs: 1,
    costUsd: 0, genCostUsd: 0, judgeCostUsd: 0, promptVersion: PROMPT_VERSION, forcedType: null, error: null, ...extra,
  });
  const run: Run = {
    id: "run-lib", createdAt: "2026-09-26T00:00:00.000Z", estimateUsd: 0, spentUsd: 0, status: "done",
    config: { inputIds: [goodInput.id, CORPUS[2].id], arms: ["graphExemplars"], modelIds: ["claude-haiku-4-5"], forcedType: null, judges: [], budgetUsd: 1 },
    cells: [
      base("aaaaaaaa-0000-4000-8000-000000000001", {}),
      base("bbbbbbbb-0000-4000-8000-000000000002", { graph: badGraph }),
      base("cccccccc-0000-4000-8000-000000000003", { status: "failed", error: "structure" }),
      base("dddddddd-0000-4000-8000-000000000004", { arm: "baseline", graph: null, mapType: null }),
      base("eeeeeeee-0000-4000-8000-000000000005", { inputId: "custom-copy" }),
      base("ffffffff-0000-4000-8000-000000000006", { graph: badNumberGraph }),
      base("11111111-0000-4000-8000-000000000007", { graph: badUrlGraph }),
    ],
  };
  // A custom input that copies another corpus input's text: its maps must not become examples.
  await store.saveCustomInput({ id: "custom-good", type: goodInput.type, title: goodInput.title, text: goodInput.text, cards: goodInput.cards, expectedTypes: [], custom: true });
  await store.saveCustomInput({ id: "custom-copy", type: "topic", title: "Copied brief", text: CORPUS[2].text, cards: [], expectedTypes: [], custom: true });
  await store.saveRun(run);
  const [A, B, C, D, E, F, G] = run.cells.map((c) => c.id);
  const promotedDir = path.join(tmp, "src", "lib", "maps", "exemplars", "promoted");
  const manifest = path.join(promotedDir, "manifest.ts");

  try {
    // ── Gating ──
    const prev = env.NODE_ENV;
    env.NODE_ENV = "production";
    check("production: GET library is 404", (await library.GET(req("/api/lab/library"))).status === 404);
    check("production: POST publish is 404", (await publish.POST(post("/api/lab/library/publish", {}))).status === 404);
    check("production: POST promote is 404", (await promote.POST(post("/api/lab/library/promote", { cellId: A, note: "x" }))).status === 404);
    env.NODE_ENV = prev ?? "development";
    check("cross-origin promote is 403", (await promote.POST(post("/api/lab/library/promote", { cellId: A, note: "x" }, { origin: "https://evil.example" }))).status === 403);
    check("text/plain publish is 403",
      (await publish.POST(req("/api/lab/library/publish", { method: "POST", headers: { "content-type": "text/plain" }, body: {} }))).status === 403);
    check("cross-origin retire is 403", (await retire.POST(post("/api/lab/library/retire", { id: "x" }, { origin: "http://localhost:4000" }))).status === 403);

    // ── Promote preview ──
    const preview = async (cellId: string) => {
      const res = await promote.GET(req(`/api/lab/library/promote?cellId=${cellId}`));
      return { status: res.status, body: (await res.json()) as { eligible: boolean; reason: string | null; gain: unknown[]; tags: unknown } };
    };
    const pa = await preview(A);
    check("a clean done cell is eligible, with derived tags and a gain list", pa.status === 200 && pa.body.eligible && !!pa.body.tags && Array.isArray(pa.body.gain));
    const pb = await preview(B);
    check(`a legend mismatch is refused with the reason (${pb.body.reason})`, pb.status === 200 && !pb.body.eligible && /legend/.test(pb.body.reason ?? ""));
    const pc = await preview(C);
    check("a failed cell is refused", !pc.body.eligible && /done/.test(pc.body.reason ?? ""));
    const pd = await preview(D);
    check("a baseline cell (no graph) is refused", !pd.body.eligible && /graph/.test(pd.body.reason ?? ""));
    const pe = await preview(E);
    check(`an input too close to a corpus input is refused (${pe.body.reason})`, !pe.body.eligible && /too close to a corpus input/.test(pe.body.reason ?? "") && (pe.body.reason ?? "").includes(CORPUS[2].id));
    check("promoting it is 409", (await promote.POST(post("/api/lab/library/promote", { cellId: E, note: "Copied" }))).status === 409);
    check("an unknown cell is 404", (await promote.GET(req("/api/lab/library/promote?cellId=nope"))).status === 404);
    const pf = await preview(F);
    check(`an invented number is refused as unfaithful (${pf.body.reason})`, !pf.body.eligible && /unfaithful/.test(pf.body.reason ?? "") && (pf.body.reason ?? "").includes("48213"));
    check("promoting an invented-number map is 409", (await promote.POST(post("/api/lab/library/promote", { cellId: F, note: "Nice numbers" }))).status === 409);
    const pg = await preview(G);
    check(`an invented URL is refused as unfaithful (${pg.body.reason})`, !pg.body.eligible && /unfaithful/.test(pg.body.reason ?? "") && /not-in-the-input\.example/.test(pg.body.reason ?? ""));
    check("promoting an invented-URL map is 409", (await promote.POST(post("/api/lab/library/promote", { cellId: G, note: "Nice source" }))).status === 409);

    // ── Promote ──
    const noNote = await promote.POST(post("/api/lab/library/promote", { cellId: A, note: " " }));
    check("promote without a note is 400", noNote.status === 400);
    const refused = await promote.POST(post("/api/lab/library/promote", { cellId: B, note: "Good colour" }));
    check("promoting an ineligible cell is 409", refused.status === 409);
    const ok = await promote.POST(post("/api/lab/library/promote", { cellId: A, note: "Clear sequence of scenes", labels: ["lab", "scenes"], title: "" }));
    const okBody = (await ok.json()) as { item: { id: string } };
    check(`promote is 201 (${okBody.item?.id})`, ok.status === 201 && !!okBody.item?.id);
    const pendingRaw = JSON.parse(await fs.readFile(path.join(tmp, "lab-data", "library-pending.json"), "utf8"));
    check("pending state is written and parses", pendingRaw.pending.length === 1 && pendingRaw.retired.length === 0);
    check("the example records the input it came from", pendingRaw.pending[0].provenance.inputId === goodInput.id);
    check("no tmp files left in lab-data", (await listTmp(path.join(tmp, "lab-data"))).length === 0);
    check("promoting the same map twice is 409", (await promote.POST(post("/api/lab/library/promote", { cellId: A, note: "Again" }))).status === 409);

    // ── Library listing ──
    const view1 = (await (await library.GET(req("/api/lab/library"))).json()) as {
      items: { id: string; status: string }[]; pendingCount: number; promptVersion: { onDisk: string; afterPublish: string };
    };
    check("library lists the pending example", view1.items.some((i) => i.id === okBody.item.id && i.status === "pending") && view1.pendingCount === 1);
    check("library lists authored examples", view1.items.filter((i) => i.status === "authored").length === EXEMPLARS.length);
    check("publishing would change the prompt version", view1.promptVersion.onDisk !== view1.promptVersion.afterPublish);
    check("retiring an authored example is 409", (await retire.POST(post("/api/lab/library/retire", { id: EXEMPLARS[0].id }))).status === 409);

    // ── A publish that fails part-way leaves everything as it was ──
    const realWrite = lib.libraryDeps.writeFile;
    lib.libraryDeps.writeFile = async (file: string, data: string) => {
      if (file.endsWith("manifest.ts")) throw new Error("disk full");
      return realWrite(file, data);
    };
    const failed = await publish.POST(post("/api/lab/library/publish", {}));
    lib.libraryDeps.writeFile = realWrite;
    check("a failed publish is 500 with the reason", failed.status === 500 && /disk full/.test(((await failed.json()) as { error: string }).error));
    const leftover = await fs.readdir(promotedDir).catch(() => [] as string[]);
    check(`a failed publish leaves no example files (${leftover.join(",")})`, leftover.filter((f) => f.endsWith(".json")).length === 0);
    check("a failed publish leaves no manifest", !(await fs.stat(manifest).then(() => true, () => false)));
    check("a failed publish keeps the pending example", (await lib.readPending()).pending.length === 1);

    // ── A good publish writes once and bumps the version once ──
    let manifestWrites = 0;
    lib.libraryDeps.writeFile = async (file: string, data: string) => {
      if (file.endsWith("manifest.ts")) manifestWrites++;
      return realWrite(file, data);
    };
    const pub = await publish.POST(post("/api/lab/library/publish", {}));
    lib.libraryDeps.writeFile = realWrite;
    const pubBody = (await pub.json()) as { written: string[]; removed: string[]; promptVersion: { before: string; after: string } };
    check("publish is 200 and reports what it wrote", pub.status === 200 && pubBody.written.join(",") === okBody.item.id);
    check("the manifest is written exactly once", manifestWrites === 1);
    check("the prompt version changes once, before != after", pubBody.promptVersion.before !== pubBody.promptVersion.after);
    check("the prompt version before is the one the library view showed on disk", pubBody.promptVersion.before === view1.promptVersion.onDisk);
    check("the prompt version after is the one the library view predicted", pubBody.promptVersion.after === view1.promptVersion.afterPublish);
    check("the example file exists", await fs.stat(path.join(promotedDir, `${okBody.item.id}.json`)).then(() => true, () => false));
    check("the manifest imports it", (await fs.readFile(manifest, "utf8")).includes(`./${okBody.item.id}.json`));
    check("pending state is cleared", (await lib.readPending()).pending.length === 0);
    check("no tmp files left in promoted/", (await listTmp(promotedDir)).length === 0);
    check("nothing left to publish is 409", (await publish.POST(post("/api/lab/library/publish", {}))).status === 409);

    // ── Retire a published example, then publish the removal ──
    const ret = await retire.POST(post("/api/lab/library/retire", { id: okBody.item.id }));
    check("retire marks the published example", ret.status === 200 && (await lib.readPending()).retired.includes(okBody.item.id));
    const view2 = (await (await library.GET(req("/api/lab/library"))).json()) as { items: { id: string; status: string }[] };
    check("the retired example shows as retiring", view2.items.some((i) => i.id === okBody.item.id && i.status === "retiring"));
    const undo = await retire.POST(post("/api/lab/library/retire", { id: okBody.item.id, undo: true }));
    check("undo restores it", undo.status === 200 && !(await lib.readPending()).retired.includes(okBody.item.id));
    await retire.POST(post("/api/lab/library/retire", { id: okBody.item.id }));
    const pub2 = await publish.POST(post("/api/lab/library/publish", {}));
    const pub2Body = (await pub2.json()) as { removed: string[]; promptVersion: { before: string; after: string } };
    check("publishing a retirement removes the file", pub2.status === 200 && pub2Body.removed.join(",") === okBody.item.id &&
      !(await fs.stat(path.join(promotedDir, `${okBody.item.id}.json`)).then(() => true, () => false)));
    check("the manifest no longer imports it", !(await fs.readFile(manifest, "utf8")).includes(`${okBody.item.id}.json`));
    check("the second publish starts from the first one's version", pub2Body.promptVersion.before === pubBody.promptVersion.after);
    check("and returns to the authored-only version", pub2Body.promptVersion.after === pubBody.promptVersion.before);
    check("retiring an unknown example is 404", (await retire.POST(post("/api/lab/library/retire", { id: "no-such" }))).status === 404);

    // ── Concurrent writers: the lost-update race ──
    // library-pending.json is a single shared file with no natural
    // partitioning, so promote/retire/publish must serialize every
    // read-modify-write through one queue. Below: N concurrent promotes for
    // different eligible cells (the exact race a reviewer found — two calls
    // both return 201 with distinct payloads, but an unguarded
    // read-then-write let the second write clobber the first with no error
    // anywhere), then a promote racing a retire, then a promote racing a
    // publish. Each step must leave every write accounted for: nothing
    // silently dropped.
    const raceExemplar = (i: number) => EXEMPLARS[i % EXEMPLARS.length];
    const raceCell = (tag: string, index: number): { cell: Cell; input: typeof goodInput } => {
      const e = raceExemplar(index);
      const input = { id: `race-input-${tag}`, type: e.input.type, title: e.input.title, text: e.input.text, cards: e.input.cards, expectedTypes: [], custom: true as const };
      const r = renderMap(e.graph);
      const cell = base(`race-cell-${tag}`, {
        runId: "run-race", inputId: input.id, graph: e.graph, mapType: e.graph.mapType, elements: r.elements, edges: r.edges,
      });
      return { cell, input };
    };
    // seedRaceCells does its own read-modify-write of the shared "run-race"
    // document, so (unlike promoteCell/retireExample/publishLibrary, which is
    // what this test is verifying) it is NOT safe to call concurrently with
    // itself — every batch of fixture cells is seeded in one go, sequentially
    // with respect to other batches, before the concurrent calls under test fire.
    const seedRaceCells = async (specs: Array<{ tag: string; index: number }>): Promise<{ cell: Cell; input: typeof goodInput }[]> => {
      const built = specs.map(({ tag, index }) => raceCell(tag, index));
      for (const { input } of built) await store.saveCustomInput(input);
      const existing = await store.readRun("run-race");
      const raceRun2: Run = existing ?? { id: "run-race", createdAt: "2026-09-26T00:00:00.000Z", estimateUsd: 0, spentUsd: 0, status: "done", config: run.config, cells: [] };
      const newIds = new Set(built.map((b) => b.cell.id));
      raceRun2.cells = [...raceRun2.cells.filter((c) => !newIds.has(c.id)), ...built.map((b) => b.cell)];
      await store.saveRun(raceRun2);
      return built;
    };
    const seedRaceCell = async (tag: string, index: number) => (await seedRaceCells([{ tag, index }]))[0];
    const promoteReq = (cellId: string, note: string) => promote.POST(post("/api/lab/library/promote", { cellId, note }));

    // N concurrent promotes of different eligible cells: all must persist.
    const raceSeeds = await seedRaceCells([1, 2, 3, 4].map((i) => ({ tag: `n${i}`, index: i })));
    const raceResults = await Promise.all(raceSeeds.map((s, i) => promoteReq(s.cell.id, `Concurrent promote ${i}`)));
    check("all N concurrent promotes return 201", raceResults.every((r) => r.status === 201));
    const raceBodies = (await Promise.all(raceResults.map((r) => r.json()))) as { item: { id: string } }[];
    const raceIds = raceBodies.map((b) => b.item.id);
    check("N distinct promoted ids came back", new Set(raceIds).size === raceIds.length);
    const afterRace = await lib.readPending();
    check(`all ${raceIds.length} concurrent promotions persisted (no lost update)`,
      afterRace.pending.length === raceIds.length && raceIds.every((id) => afterRace.pending.some((p) => p.id === id)));

    // A promote concurrent with a retire of one of those pending items.
    const seed5 = await seedRaceCell("r1", 5);
    const [retireDuringPromote, promoteDuringRetire] = await Promise.all([
      retire.POST(post("/api/lab/library/retire", { id: raceIds[0] })),
      promoteReq(seed5.cell.id, "Promote racing a retire"),
    ]);
    check("the racing retire is 200", retireDuringPromote.status === 200);
    check("the racing promote is 201", promoteDuringRetire.status === 201);
    const seed5Body = (await promoteDuringRetire.json()) as { item: { id: string } };
    const afterRetireRace = await lib.readPending();
    const expectedAfterRetire = [...raceIds.slice(1), seed5Body.item.id];
    check("promote-vs-retire: the retired id is gone, the new promotion is present, nothing else lost",
      afterRetireRace.pending.length === expectedAfterRetire.length &&
      expectedAfterRetire.every((id) => afterRetireRace.pending.some((p) => p.id === id)) &&
      !afterRetireRace.pending.some((p) => p.id === raceIds[0]));

    // A promote concurrent with a publish of the currently-pending items.
    const seed6 = await seedRaceCell("r2", 6);
    const [publishDuringPromote, promoteDuringPublish] = await Promise.all([
      publish.POST(post("/api/lab/library/publish", {})),
      promoteReq(seed6.cell.id, "Promote racing a publish"),
    ]);
    check("the racing publish is 200", publishDuringPromote.status === 200);
    check("the racing promote is 201", promoteDuringPublish.status === 201);
    const seed6Body = (await promoteDuringPublish.json()) as { item: { id: string } };
    const expectedSet = [...expectedAfterRetire, seed6Body.item.id];
    const publishedAfterRace = await lib.publishedIds();
    const pendingAfterRace = (await lib.readPending()).pending.map((p) => p.id);
    const observedSet = [...publishedAfterRace.filter((id) => expectedSet.includes(id)), ...pendingAfterRace];
    check("promote-vs-publish: every expected id landed in exactly one of published/pending, none lost or duplicated",
      new Set(observedSet).size === observedSet.length &&
      expectedSet.every((id) => observedSet.includes(id)) &&
      !pendingAfterRace.some((id) => publishedAfterRace.includes(id)));

    // Clean up the race fixtures so they don't leak into a differently-ordered rerun's assumptions.
    for (const id of pendingAfterRace) await retire.POST(post("/api/lab/library/retire", { id }));
    for (const id of publishedAfterRace.filter((pid) => expectedSet.includes(pid))) await retire.POST(post("/api/lab/library/retire", { id }));
    await publish.POST(post("/api/lab/library/publish", {})).catch(() => undefined);
  } finally {
    process.chdir(originalCwd);
    // Windows can briefly hold a file handle open after a write settles
    // (more so with this file's added concurrent-writer tests); retry rather
    // than let tmp-dir cleanup flake the whole run.
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
      try {
        await fs.rm(tmp, { recursive: true, force: true });
        break;
      } catch (e) {
        if (attempt === 4) console.error(`warning: could not remove tmp dir ${tmp}:`, e);
      }
    }
  }

  if (failures) { console.error(`${failures} FAILED`); process.exit(1); }
  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); });
