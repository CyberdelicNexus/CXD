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

  // ── Element-rich inputs (element library spec §6): content that calls for a
  // table, links, a portal, tasks, a decision, frames, colour with meaning, and
  // relation styles. ──
  {
    id: "cmp-pricing-numbers", type: "comparison", title: "Membership options, by the numbers", cards: [], expectedTypes: ["tree", "brace"],
    text: "Compare our three membership options on the numbers. Starter: 29 a month, 2 classes, book 3 days ahead. Plus: 59 a month, 6 classes, book 7 days ahead, one guest pass. Unlimited: 95 a month, any class, book 14 days ahead, two guest passes, 10% off retreats. Last quarter we had 140 Starter, 210 Plus and 60 Unlimited members. Which should the homepage push?",
  },
  {
    id: "bd-research-sources", type: "brainDump", title: "Research brief with sources", cards: [], expectedTypes: ["conceptMap", "tree"],
    text: "pulling together the brief on why people join breathwork classes. the ONS wellbeing survey says loneliness is up for 16 to 29 year olds (ons.gov.uk, wellbeing section). our own 30 interviews: stress relief first, then meeting people. the Stanford study on cyclic sighing (Cell Reports Medicine, 2023) is what everyone quotes for mood. the Headspace annual report says most people drop a new habit within two weeks. I need to show which claim rests on which source.",
  },
  {
    id: "tp-journey-subjourney", type: "topic", title: "Gallery visit with a booking sub-journey", cards: [], expectedTypes: ["flow"],
    text: "Map a guest's journey through our immersive gallery, from first hearing about it to telling friends afterwards. Booking is its own long sub-journey (choosing a slot, group tickets, access needs, payment, reminders) that deserves a separate space of its own.",
  },
  {
    id: "bd-workshop-owners", type: "brainDump", title: "Community workshop, who does what", cards: [], expectedTypes: ["flow", "brace"],
    text: "community workshop saturday 10 to 4. Priya does the welcome and the why (20 min). then Tom runs the listening exercise in threes. lunch from the cafe, Jo orders it by thursday. afternoon: Priya facilitates the ideas wall, Tom collects the votes, closing reflections by me. still need someone to set up chairs at 9 and someone to send the follow-up email on monday.",
  },
  {
    id: "cmp-go-no-go", type: "comparison", title: "Winter market stall: go or no-go", cards: [], expectedTypes: ["tree", "flow"],
    text: "Decide whether to take a stall at the winter market. It costs 900 for four weekends. Go if we can staff both days and pre-sell at least 40 class passes by 1 November; otherwise no-go and put the money into online ads. If go: order the heater, print vouchers, build the rota. If no-go: brief the ads freelancer.",
  },
  {
    id: "bd-event-scenes", type: "brainDump", title: "Launch night as scenes", cards: [], expectedTypes: ["flow"],
    text: "picture the launch night: guests come up the candlelit stairs, coats taken, a glass of something warm. then the room goes dark and the first gong sounds. twenty minutes of sound, people lying down. lights come up slowly, amber, the founder says a few words. people drift to the tea bar, chatting. last scene: everyone leaves with a small bag of tea and a card with a code for their first class. afterwards the team needs a debrief.",
  },
  {
    id: "cc-risks-opps", type: "canvasCards", title: "Risks and opportunities review", text: "Review these cards for the new studio: which are risks and which are opportunities?", expectedTypes: ["doubleBubble", "tree"],
    cards: cards(
      ["Landlord wants a 5-year lease", "Locks us in"], ["Yoga studio next door closing", "Their members need a new home"],
      ["Two teachers may leave", "Both teach evening classes"], ["Council wellbeing grant", "Up to 10k, deadline March"],
      ["Rising energy bills", "Heating the hall in winter"], ["Corporate wellness enquiries", "Three companies asked this month"],
    ),
  },
  {
    id: "tp-ecosystem-ties", type: "topic", title: "Creative ecosystem, with uncertain ties", cards: [], expectedTypes: ["conceptMap"],
    text: "How do our venue, the local artists, the council, a streaming partner and our audience relate? The artists and the venue promote each other. The council's funding might depend on audience numbers, but we are not sure. The streaming partner could bring new audiences, which is unproven. The audience supports the artists directly through tips.",
  },
];
