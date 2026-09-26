// Two original exemplars (from the CXD templates) in the library format, and
// the comparison that replaces the third: "App vs. in-person onboarding"
// repeated corpus input cmp-app-live almost word for word.
import type { AuthoredExemplar } from "../types";
import { node, props, rel } from "./helpers";

export const MIGRATED: AuthoredExemplar[] = [
  {
    id: "storyboard-first-visit",
    title: "First visit, as a storyboard",
    note: "A visit told as a storyboard sequence: frames for visual beats, cards for the interactions the designer will build on.",
    labels: ["storyboard", "installation"],
    input: {
      type: "topic",
      title: "First visit storyboard",
      text: "Storyboard a first-time guest's visit to our scent-and-light installation, from the street door to the moment they leave.",
      cards: [],
    },
    graph: {
      mapType: "flow",
      title: "First visit, as a storyboard",
      legend: [],
      nodes: [
        node("s1", "step", "Arrival", { kind: "frame", detail: "Guest steps in from the street; light and sound soften.", props: props({ storyboard: true, description: "Threshold moment" }) }),
        node("s2", "step", "Orientation", { kind: "frame", detail: "A host frames what the next hour holds.", props: props({ storyboard: true, description: "Welcome" }) }),
        node("s3", "step", "First interaction", { detail: "Guest chooses a scent that seeds their path.", props: props({ emoji: "🌿" }) }),
        node("s4", "step", "Peak moment", { kind: "frame", detail: "Room-scale projection responds to breath.", props: props({ storyboard: true, description: "The reveal" }) }),
        node("s5", "step", "Reflection", { detail: "Quiet room with a single prompt card to take home.", props: props({ emoji: "🕯️" }) }),
      ],
      relations: [rel("s1", "s2"), rel("s2", "s3"), rel("s3", "s4"), rel("s4", "s5")],
    },
  },
  {
    id: "who-this-is-for",
    title: "Who this is for",
    note: "Loose audience cards sorted into needs, desires and role, rooted on the Human context framing section.",
    labels: ["audience"],
    input: {
      type: "canvasCards",
      title: "Audience signal cards",
      text: "Sort these cards about who the experience is for.",
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
        node("needs", "branch", "Needs", { parent: "root", props: props({ emoji: "🧭" }) }),
        node("desires", "branch", "Desires", { parent: "root", props: props({ emoji: "🔥" }) }),
        node("role", "branch", "Role", { parent: "root", props: props({ emoji: "🎭" }) }),
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
    id: "guided-vs-self-led",
    title: "Guided vs. self-led sound bath",
    note: "Two formats of the same session compared: shared qualities in the middle, differences on the outside, all as bubbles because they are qualities.",
    labels: ["sound bath", "format"],
    input: {
      type: "comparison",
      title: "Guided or self-led sound bath",
      text: "We run a Sunday sound bath. Should it stay teacher-guided, or become self-led with a recorded soundtrack and headphones? Compare the two formats for regulars and newcomers.",
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
        node("r1", "rightOnly", "Runs without staff", { kind: "bubble" }),
        node("r2", "rightOnly", "Private volume", { kind: "bubble" }),
      ],
      relations: [],
    },
  },
];
