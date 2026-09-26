// Run: npx tsx src/lib/maps/__verify__/starter.verify.ts
// Each authored starter exemplar exists, clears the library bar, and carries
// the map type, input type, kinds and pairings it was written to show.
import { EXEMPLARS } from "../exemplars";
import type { PairingId } from "../exemplars/pairings";
import type { ExemplarInputType } from "../exemplars/types";
import { exemplarProblems } from "../exemplars/validate";
import type { MapType, NodeKind } from "../types";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};

interface Expect { id: string; mapType: MapType; inputType: ExemplarInputType; kinds: NodeKind[]; pairings: PairingId[] }

const EXPECTED: Expect[] = [
  { id: "retreat-weekend", mapType: "spider", inputType: "brainDump", kinds: ["card", "task", "table", "heading", "caption"], pairings: ["headingsRegions"] },
  { id: "pass-pricing-tiers", mapType: "tree", inputType: "comparison", kinds: ["card", "task", "portal", "table", "zone"], pairings: ["zoneTableCards", "treePortal"] },
  { id: "membership-churn", mapType: "multiFlow", inputType: "brainDump", kinds: ["card"], pairings: [] },
  { id: "rooftop-go-no-go", mapType: "tree", inputType: "brainDump", kinds: ["card", "task", "waypoint", "caption"], pairings: ["waypointBranches"] },
  { id: "ocean-room-scenes", mapType: "flow", inputType: "topic", kinds: ["task", "frame"], pairings: ["framesToTask"] },
  { id: "onboarding-path", mapType: "flow", inputType: "canvasCards", kinds: ["card", "waypoint", "shape"], pairings: ["strongMainPath", "starGoal"] },
  { id: "sprint-day-owners", mapType: "brace", inputType: "brainDump", kinds: ["card", "task", "heading"], pairings: ["headingsRegions"] },
  { id: "retreat-purpose", mapType: "brace", inputType: "topic", kinds: ["card", "anchor", "caption"], pairings: ["twoAnchors"] },
  { id: "wellness-ecosystem", mapType: "conceptMap", inputType: "topic", kinds: ["card", "bubble"], pairings: ["conceptMapDashedTwoWay"] },
  { id: "community-evidence", mapType: "conceptMap", inputType: "canvasCards", kinds: ["card", "link", "caption"], pairings: ["linksSupportIdeas"] },
];

for (const e of EXPECTED) {
  const ex = EXEMPLARS.find((x) => x.id === e.id);
  check(`${e.id} exists`, !!ex);
  if (!ex) continue;
  const problems = exemplarProblems(ex.graph);
  check(`${e.id} passes the library checks${problems.length ? `: ${problems.slice(0, 3).join("; ")}` : ""}`, problems.length === 0);
  check(`${e.id} is a ${e.mapType} map for a ${e.inputType} input`, ex.tags.mapType === e.mapType && ex.tags.inputType === e.inputType);
  check(`${e.id} uses ${e.kinds.join(", ")}`, e.kinds.every((k) => ex.tags.kinds.includes(k)));
  check(`${e.id} shows ${e.pairings.join(", ") || "no named pairing"}`, e.pairings.every((p) => ex.tags.pairings.includes(p)));
}

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
