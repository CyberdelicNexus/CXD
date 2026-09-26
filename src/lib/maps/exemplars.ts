// Hand-written exemplar graphs, derived from the CXD templates, shown to the
// graph+exemplars arm. Each must pass checkMapStructure and render cleanly
// (exemplars.verify.ts). Replaced by src/lib/maps/exemplars/ in Task 8.
import type { MapGraph, MapNode, MapRelation } from "./types";

export interface Exemplar {
  note: string;
  graph: MapGraph;
}

const node = (id: string, role: MapNode["role"], label: string, extra: Partial<MapNode> = {}): MapNode =>
  ({ id, label, detail: "", role, kind: "card", parent: "", props: "{}", tint: "", emphasis: "normal", ...extra });
const rel = (from: string, to: string): MapRelation =>
  ({ from, to, label: "", style: "solid", weight: "normal", direction: "forward" });

export const EXEMPLARS: Exemplar[] = [
  {
    note: "A visit told as a storyboard sequence (from the Storyboard Flow template): frames for visual beats, cards for interactions.",
    graph: {
      mapType: "flow",
      title: "First visit, as a storyboard",
      legend: [],
      nodes: [
        node("s1", "step", "Arrival", { kind: "frame", detail: "Guest steps in from the street; light and sound soften.", props: JSON.stringify({ storyboard: true, description: "Threshold moment" }) }),
        node("s2", "step", "Orientation", { kind: "frame", detail: "A host frames what the next hour holds.", props: JSON.stringify({ storyboard: true, description: "Welcome" }) }),
        node("s3", "step", "First interaction", { detail: "Guest chooses a scent that seeds their path.", props: JSON.stringify({ emoji: "🌿" }) }),
        node("s4", "step", "Peak moment", { kind: "frame", detail: "Room-scale projection responds to breath.", props: JSON.stringify({ storyboard: true, description: "The reveal" }) }),
        node("s5", "step", "Reflection", { detail: "Quiet room with a single prompt card to take home.", props: JSON.stringify({ emoji: "🕯️" }) }),
      ],
      relations: [rel("s1", "s2"), rel("s2", "s3"), rel("s3", "s4"), rel("s4", "s5")],
    },
  },
  {
    note: "Who an experience is for, anchored on the framing section (from the Human Context template).",
    graph: {
      mapType: "tree",
      title: "Who this is for",
      legend: [],
      nodes: [
        node("root", "root", "Human context", { kind: "anchor", props: JSON.stringify({ componentKey: "humanContext" }) }),
        node("needs", "branch", "Needs", { parent: "root", props: JSON.stringify({ emoji: "🧭" }) }),
        node("desires", "branch", "Desires", { parent: "root", props: JSON.stringify({ emoji: "🔥" }) }),
        node("role", "branch", "Role", { parent: "root", props: JSON.stringify({ emoji: "🎭" }) }),
        node("n1", "leaf", "Decompress after work", { parent: "needs" }),
        node("n2", "leaf", "Feel safe alone", { parent: "needs" }),
        node("d1", "leaf", "Be surprised", { parent: "desires" }),
        node("d2", "leaf", "Share it with friends", { parent: "desires" }),
        node("r1", "leaf", "Explorer, not audience", { parent: "role" }),
        node("r2", "leaf", "Occasional co-creator", { parent: "role" }),
      ],
      relations: [],
    },
  },
  {
    note: "Comparing two formats of the same experience: shared qualities in the middle, differences on the outside.",
    graph: {
      mapType: "doubleBubble",
      title: "App vs. in-person onboarding",
      legend: [],
      nodes: [
        node("lt", "leftTopic", "App onboarding", { kind: "bubble" }),
        node("rt", "rightTopic", "In-person onboarding", { kind: "bubble" }),
        node("s1", "shared", "Guided steps", { kind: "bubble" }),
        node("s2", "shared", "Personalised", { kind: "bubble" }),
        node("l1", "leftOnly", "Self-paced", { kind: "bubble" }),
        node("l2", "leftOnly", "Scales cheaply", { kind: "bubble" }),
        node("r1", "rightOnly", "Human warmth", { kind: "bubble" }),
        node("r2", "rightOnly", "Reads the room", { kind: "bubble" }),
      ],
      relations: [],
    },
  },
];
