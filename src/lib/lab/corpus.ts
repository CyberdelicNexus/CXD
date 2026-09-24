import type { LabCard, LabInput } from "./types";

const cards = (...pairs: [string, string][]): LabCard[] => pairs.map(([title, body]) => ({ title, body }));

export const CORPUS: LabInput[] = [
  // ── Messy brain dumps ─────────────────────────────────────────────
  {
    id: "bd-retreat", type: "brainDump", title: "Weekend retreat, unsorted", cards: [], expectedTypes: ["spider", "tree"],
    text: "ok so the retreat. friday night arrival needs to feel soft, maybe candles, no phones?? saturday is the big day — breathwork in the morning, then the forest walk, lunch should be long and slow, afternoon free or a workshop on sound. need to sort food: vegetarian mostly, someone mentioned allergies. rooms — shared or private, cost difference is big. sunday closing circle, then people leave around 2. also budget, we have maybe 8k total and the venue alone is 5k. marketing: instagram plus the newsletter, early bird pricing?",
  },
  {
    id: "bd-launch", type: "brainDump", title: "Launch-week worries", cards: [], expectedTypes: ["multiFlow", "tree"],
    text: "the app launches in 3 weeks and honestly I'm anxious. onboarding still has that confusing permissions step, which I think is why the beta testers dropped off. the press embargo lifts the same day, so if onboarding breaks we get bad reviews in public. support team is two people. pricing page isn't final. if the reviews are bad then the waitlist conversion drops and the investors notice. but if it goes well we'll get a wave of signups that our servers might not handle.",
  },
  {
    id: "bd-museum", type: "brainDump", title: "Immersive room notes", cards: [], expectedTypes: ["spider", "radial"],
    text: "the ocean room. sound: whale song but slowed down, low rumble in the floor. light: caustic patterns on the ceiling, deep blues shifting to green. touch: cool air, maybe mist at the entrance. story: you're sinking slowly, getting calmer the deeper you go. tech: 6 projectors, spatial audio, a haptic floor if budget allows. accessibility: seating along the edges, captions for the narration, quiet version for sensitive visitors.",
  },
  {
    id: "bd-habits", type: "brainDump", title: "Why people quit the meditation app", cards: [], expectedTypes: ["multiFlow"],
    text: "interviews say: sessions feel repetitive after week 2. streaks make people feel guilty when they miss a day, then they just stop opening it. notifications at the wrong time. some felt the voice was too 'salesy'. those who stayed had a friend doing it too. when people quit they also cancel the subscription and leave bad reviews about 'nagging'. churn is highest right after the free trial.",
  },
  {
    id: "bd-festival", type: "brainDump", title: "Festival logistics dump", cards: [], expectedTypes: ["tree"],
    text: "stages: main stage, forest stage, silent disco. food: 12 vendors, need vegan and gluten-free, water refill stations. safety: medical tent, lost & found, security at gates, fire marshal walkthrough. transport: shuttle from the station every 20 mins, bike parking, car parking is limited. volunteers: 80 needed, shifts of 4 hours, training the day before. sustainability: no single-use plastic, compost bins.",
  },
  {
    id: "bd-workshop", type: "brainDump", title: "Workshop run-of-show", cards: [], expectedTypes: ["flow"],
    text: "people arrive, coffee, name tags. then I do a 10 min intro on why we're here. warm-up exercise in pairs. then the main thing: map your customer's worst day in small groups, 40 mins. share-outs, each group 3 mins. then we vote on the pain points that matter most. break. then solution sketching. then we pick 2 to prototype next week. close with one-word check-out.",
  },

  // ── Loose canvas cards ────────────────────────────────────────────
  {
    id: "cc-mariana", type: "canvasCards", title: "Mariana System cards", text: "Organise these loose cards from my board into a clear structure.", expectedTypes: ["tree", "conceptMap"],
    cards: cards(
      ["AI note taker", "Captures meetings from Teams, WhatsApp and email"],
      ["Second brain", "Claude Projects holding all project knowledge"],
      ["Mariana's brain", "Personal preferences, voice, context"],
      ["Claude agent", "Acts on the second brain to draft and plan"],
      ["Interactive artifact", "Dashboards the agent publishes"],
      ["Project lifetime", "Pre-sourcing, execution, O&M"],
      ["Weekly review", "Agent summarises what changed"],
    ),
  },
  {
    id: "cc-sensory", type: "canvasCards", title: "Sensory trigger cards", text: "Group these sensory ideas so the team can see the palette.", expectedTypes: ["bubble", "tree"],
    cards: cards(
      ["Cedar scent", "At the entrance"], ["Low drone", "Under the floor"], ["Warm stones", "In the palm during breathwork"],
      ["Amber light", "Sunset tone"], ["Bird call", "Signals the transition"], ["Rough linen", "Blankets"],
      ["Citrus tea", "Served at the close"], ["Silence", "Two full minutes"],
    ),
  },
  {
    id: "cc-onboarding", type: "canvasCards", title: "Onboarding steps (shuffled)", text: "These are our onboarding steps in no particular order. Put them in sequence.", expectedTypes: ["flow"],
    cards: cards(
      ["Invite a friend", "Optional, after first session"], ["Create account", "Email or Apple"], ["First guided session", "5 minutes"],
      ["Choose intention", "Sleep, focus or calm"], ["Set reminder time", ""], ["Welcome screen", "Brand promise"],
    ),
  },
  {
    id: "cc-personas", type: "canvasCards", title: "Persona signals", text: "Sort these research signals into who they describe.", expectedTypes: ["tree"],
    cards: cards(
      ["Books on Sunday night", "Plans the week ahead"], ["Comes with partner", "Couples"], ["Wants certificates", "Professional growth"],
      ["Leaves early", "Parents with childcare"], ["Asks about teacher training", "Aspiring practitioners"], ["Shares on Instagram", "Social sharers"],
      ["Pays for premium add-ons", "High spenders"], ["Only attends free events", "Price-sensitive"],
    ),
  },
  {
    id: "cc-risks", type: "canvasCards", title: "Risk cards", text: "What causes the key risk here and what does it lead to?", expectedTypes: ["multiFlow"],
    cards: cards(
      ["Venue cancels", "The key risk"], ["Single supplier", "Only one venue option in town"], ["Late payment", "Our deposit was late"],
      ["Refund wave", "Guests ask for money back"], ["Reputation hit", "Reviews mention chaos"], ["Team burnout", "Rebooking everything"],
    ),
  },
  {
    id: "cc-research", type: "canvasCards", title: "Research findings", text: "How do these findings relate to each other?", expectedTypes: ["conceptMap"],
    cards: cards(
      ["Loneliness", "Top reason people join"], ["Belonging", "What regulars describe"], ["Rituals", "Weekly circle, shared tea"],
      ["Retention", "Regulars stay 3x longer"], ["Facilitator warmth", "Most-cited factor"], ["Group size", "Under 12 feels intimate"],
    ),
  },

  // ── One-line topics ───────────────────────────────────────────────
  { id: "tp-sensory-onboarding", type: "topic", title: "Sensory onboarding", cards: [], expectedTypes: ["flow"], text: "Plan a sensory onboarding experience for a new wellness studio's first-time guests." },
  { id: "tp-brand-world", type: "topic", title: "VR meditation brand world", cards: [], expectedTypes: ["brace", "tree"], text: "Break down the world, story and magic of a VR meditation brand." },
  { id: "tp-community", type: "topic", title: "Remote community", cards: [], expectedTypes: ["radial", "spider"], text: "Brainstorm ways to keep a remote creative community engaged between events." },
  { id: "tp-exhibition", type: "topic", title: "Great exhibitions", cards: [], expectedTypes: ["bubble"], text: "What qualities make an immersive exhibition feel unforgettable?" },
  { id: "tp-bakery", type: "topic", title: "Bakery journey", cards: [], expectedTypes: ["flow"], text: "Map the customer journey of a neighbourhood bakery from first hearing about it to becoming a regular." },
  { id: "tp-creator-economy", type: "topic", title: "Creator economy", cards: [], expectedTypes: ["conceptMap"], text: "How do AI tools, creators, audiences and platforms relate to each other in the creator economy?" },

  // ── Comparisons and decisions ─────────────────────────────────────
  { id: "cmp-app-live", type: "comparison", title: "App vs. in-person", cards: [], expectedTypes: ["doubleBubble"], text: "Compare onboarding through our app with onboarding in person at the studio." },
  { id: "cmp-vr-ar", type: "comparison", title: "VR vs. AR", cards: [], expectedTypes: ["doubleBubble"], text: "Compare VR headsets and AR on phones for a museum's new wing." },
  { id: "cmp-pricing", type: "comparison", title: "Subscription or one-time", cards: [], expectedTypes: ["doubleBubble", "multiFlow"], text: "Should our experience pass be a monthly subscription or a one-time purchase?" },
  { id: "cmp-churn", type: "comparison", title: "Churn causes and effects", cards: [], expectedTypes: ["multiFlow"], text: "What causes members to cancel their membership, and what happens to the community when they do?" },
  { id: "cmp-retreat-parts", type: "comparison", title: "Anatomy of a retreat", cards: [], expectedTypes: ["brace"], text: "Break down what a great weekend retreat is made of." },
  { id: "cmp-tools", type: "comparison", title: "Planning tools", cards: [], expectedTypes: ["tree", "doubleBubble"], text: "Compare Notion, Miro and CXD for planning an immersive experience, across collaboration, structure, visuals and cost." },
];
