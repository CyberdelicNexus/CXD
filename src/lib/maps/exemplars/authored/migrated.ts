// Two original exemplars (from the CXD templates) in the library format, and
// the comparison that replaces the third: "App vs. in-person onboarding"
// repeated corpus input cmp-app-live almost word for word. The storyboard now
// follows a hotel arrival, so the library is not all studios and museums.
// Every fact in a graph is in its input (faithful.ts).
import type { AuthoredExemplar } from "../types";
import { node, props, rel } from "./helpers";

export const MIGRATED: AuthoredExemplar[] = [
  {
    id: "storyboard-first-visit",
    title: "First hotel arrival, as a storyboard",
    note: "Because an arrival is told in moments, each visual beat is a frame and the peak is strong; the one interaction the designer will build on is a card.",
    labels: ["storyboard", "hospitality"],
    input: {
      type: "topic",
      title: "Hotel arrival storyboard",
      text: "Storyboard a first-time guest's arrival at our small spa hotel, from the taxi door to the moment they settle into their room.",
      cards: [],
    },
    graph: {
      mapType: "flow",
      title: "First hotel arrival, as a storyboard",
      legend: [],
      nodes: [
        node("s1", "step", "Arrival", { kind: "frame", detail: "The taxi door opens onto a quiet, lit entrance.", props: props({ storyboard: true, description: "Threshold moment" }) }),
        node("s2", "step", "Welcome", { kind: "frame", detail: "A host greets the guest by name.", props: props({ storyboard: true, description: "Welcome" }) }),
        node("s3", "step", "First interaction", { detail: "The guest chooses a scent for their room.", props: props({ emoji: "🌿" }) }),
        node("s4", "step", "Peak moment", { kind: "frame", emphasis: "strong", detail: "The room door opens on warm light and the chosen scent.", props: props({ storyboard: true, description: "The reveal" }) }),
        node("s5", "step", "Reflection", { kind: "frame", detail: "The guest sits by the window and settles in.", props: props({ storyboard: true, description: "Settling" }) }),
      ],
      relations: [rel("s1", "s2"), rel("s2", "s3"), rel("s3", "s4"), rel("s4", "s5")],
    },
  },
  {
    id: "who-this-is-for",
    title: "Who this is for",
    note: "Because the cards describe the audience and the ask sorts them three ways, each way is a heading under the Human context anchor, and each card keeps its body as detail.",
    labels: ["audience"],
    input: {
      type: "canvasCards",
      title: "Audience signal cards",
      text: "Sort these cards about who the experience is for into what they need, what they desire and the role they play.",
      cards: [
        { title: "Decompress after work", body: "From exit interviews" },
        { title: "Feel safe alone", body: "Many come by themselves" },
        { title: "Be surprised", body: "Said by most first-timers" },
        { title: "Share it with friends", body: "Photos at the exit" },
        { title: "Explorer, not audience", body: "They want to wander" },
        { title: "Occasional co-creator", body: "Some leave a trace" },
      ],
    },
    graph: {
      mapType: "tree",
      title: "Who this is for",
      legend: [],
      nodes: [
        node("root", "root", "Human context", { kind: "anchor", props: props({ componentKey: "humanContext" }) }),
        node("needs", "branch", "Needs", { kind: "heading", parent: "root" }),
        node("desires", "branch", "Desires", { kind: "heading", parent: "root" }),
        node("role", "branch", "Role", { kind: "heading", parent: "root" }),
        node("n1", "leaf", "Decompress after work", { parent: "needs", detail: "From exit interviews" }),
        node("n2", "leaf", "Feel safe alone", { parent: "needs", detail: "Many come by themselves" }),
        node("d1", "leaf", "Be surprised", { parent: "desires", detail: "Said by most first-timers" }),
        node("d2", "leaf", "Share it with friends", { parent: "desires", detail: "Photos at the exit" }),
        node("r1", "leaf", "Explorer, not audience", { parent: "role", detail: "They want to wander" }),
        node("r2", "leaf", "Occasional co-creator", { parent: "role", detail: "Some leave a trace" }),
      ],
      relations: [],
    },
  },
  {
    id: "guided-vs-self-led",
    title: "Guided vs. self-led sound bath",
    note: "Because two formats of one session are compared, shared qualities sit in the middle and differences outside, all bubbles; no colour, since nothing in the ask gives it a meaning.",
    labels: ["sound bath", "format"],
    input: {
      type: "comparison",
      title: "Guided or self-led sound bath",
      text: "We run a 45-minute Sunday sound bath in a calm, dim room. Should it stay teacher-guided, with live gongs, a teacher who reads the room and questions answered afterwards? Or become self-led with a recorded soundtrack on headphones, which runs without staff, lets each person set their own volume and can run at any time slot? Compare the two formats.",
      cards: [],
    },
    graph: {
      mapType: "doubleBubble",
      title: "Guided vs. self-led sound bath",
      legend: [],
      nodes: [
        node("lt", "leftTopic", "Teacher-guided", { kind: "bubble" }),
        node("rt", "rightTopic", "Self-led with headphones", { kind: "bubble" }),
        node("s1", "shared", "Calm, dim room", { kind: "bubble" }),
        node("s2", "shared", "Same 45 minutes", { kind: "bubble" }),
        node("l1", "leftOnly", "Reads the room", { kind: "bubble" }),
        node("l2", "leftOnly", "Live gongs", { kind: "bubble" }),
        node("l3", "leftOnly", "Questions answered after", { kind: "bubble" }),
        node("r1", "rightOnly", "Runs without staff", { kind: "bubble" }),
        node("r2", "rightOnly", "Own volume", { kind: "bubble" }),
        node("r3", "rightOnly", "Any time slot", { kind: "bubble" }),
      ],
      relations: [],
    },
  },
];
