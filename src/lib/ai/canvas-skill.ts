// The Canvas Assistant's composition skill: which FORM a piece of content
// should take on the canvas and how each building block is styled. Shared by
// both AI paths (CANVAS_GENERATION_GUIDE for "Draft on Canvas",
// CANVAS_OPERATIONS_GUIDE for typed instructions and "Apply to Canvas") so the
// two cannot drift into different visual languages. It is deliberately
// schema-neutral: «tint» means "the element's colour family", and each guide
// says which field carries it. Every prop named here is whitelisted in
// generatedToCanvas (element-generation.ts) — add the prop there first, then
// teach it here.
//
// The human-facing version of this file is .claude/skills/cxd-canvas/SKILL.md.

export const CANVAS_COMPOSITION_SKILL = `
DESIGN LANGUAGE
This canvas is near-black. Colour lives in thin gradient rings, gradient headings and connectors, never in large bright fills. A good layout reads as a DIAGRAM: nodes, connectors, floating typography and the occasional outline frame. A wall of note cards is a failed layout.

1. PICK THE FORM FROM THE CONTENT (never default to note cards)
- Process, journey, pipeline, funnel, sequence of stages -> FLOW: shape nodes joined by connectors.
- Cycle, feedback loop, habit loop, flywheel -> LOOP: 3-6 pill nodes in a closed ring of connectors, with the loop's name as floating text in the middle.
- One idea with branches -> MIND MAP: a hub node with branch nodes, sub-branches off those.
- Stages that each need explaining -> SPINE: a column of small stage nodes chained top to bottom, each also connected sideways to a wide detail node holding the explanation.
- Decision logic -> FLOW with a diamond at every decision and a labelled connector per outcome.
- Comparison, matrix, criteria, before/after, "we believe / we must prove" -> TABLE.
- Positioning, 2x2, quadrants, segments -> QUADRANTS: outline frames in a grid, each with a floating heading and small pill nodes inside.
- Several parallel themes with a few points each -> FRAMES side by side, each holding a heading plus nodes or body text.
- Technology, architecture, anything "built on" something else -> LAYERED STACK: one wide rectangle per layer, top (what people touch) to bottom (what powers it), components as small pills in or beside their layer.
- Dated plans, roadmaps, milestones -> TIMELINE: milestone nodes in time order, a date label above each and a caption below.
- Who does what across roles or teams -> SWIMLANES: one outline frame per actor as a horizontal lane, steps inside the lane of whoever does them, connectors for each handoff.
- Hierarchies and breakdowns -> TREE: root on top, children in rows beneath, parent-to-child connectors only.
- Stages that lose people or options as they go -> FUNNEL: stacked rectangles that narrow towards the bottom, a caption beside each.
- Long-form writing the designer will keep editing (a brief, research notes, a script) -> a note card. This is the ONLY job of a note card. Use at most 1-2 per layout unless the designer literally asks for notes or cards.
- Deep material that deserves its own space -> a board portal. Content that mirrors a framing section -> an experienceBlock anchor at the start of the structure.
Combine forms when the content has parts: a title, a flow, and a table beside it is better than forcing everything into one shape. Aim for 8-30 elements.

2. BUILDING BLOCKS
- NODE = kind 'shape', its text in 'content' (1-6 words; UPPERCASE for 1-2 word stage names). Choose shapeType by meaning:
  pill = stage, step, start/end (260x100) | rectangle = statement or detail, wraps longer text (step 160x80, detail 320x120 holds ~140 characters) | diamond = decision (160x160) | hexagon = concept, principle, pivot (200x180) | circle = hub or waypoint (100x100) | parallelogram = input/output (240x90) | cylinder = data or store (160x140) | document = artifact, deliverable (180x130) | callout = side annotation (240x100).
  props {"look":"outline"} is the default and right for almost every node: dark body, gradient ring, bold white text. {"look":"filled"} marks the single most important node. {"look":"ghost"} marks optional or future items. {"fontSize":18} only when a node must be louder or quieter.
- FLOATING TEXT = kind 'text' with props {"role":...}. It is how everything gets named:
  "title" = 30px gradient, at most one per layout | "heading" = 20px gradient, names a frame, lane or section | "label" = 12px bold, UPPERCASE, for axis ends and small tags | "caption" = 13px muted, a one-line explanation under a title or heading | "body" = 14px, a short paragraph.
  Add "align":"center" to centre the text in its box. Size the box to the text: width is about 0.6 x fontSize px per character for one line; the height is computed for you.
- FRAME = kind 'container'. A frame is ONLY an outline drawn around elements that belong together. Always send props {"titled":false} and never rely on a container title bar: name the frame with a floating text heading that is its first child. Do not frame everything. A flow, loop or mind map normally needs no frame at all; frames earn their place when they separate clusters.
- CONNECTOR: every relationship between two elements is a connector, never a 'line'. Label one (1-3 words) only when the relationship is not obvious from the nodes. A connector is drawn as ONE STRAIGHT STROKE between its two ends and cannot go around anything, so only connect nodes that sit next to each other. Never draw a connector that would pass over other nodes (for example from the last stage back to the first): say "then the cycle repeats" in a caption instead. A branch, retry step or dead-end outcome sits directly above or below the node it leaves.
- LONG FLOWS: never put more than 6 nodes in one row. A longer flow SNAKES: the next row sits below and runs in the opposite direction, starting directly under the node the previous row ended on, so the turn is one short vertical connector. If every stage also needs a description, use a SPINE instead.
- ONE DIAGRAM per request. Do not draw the same content twice in different forms, and do not add separate unconnected rows of nodes beside a flow: if a stage has an attribute (who acts, the environment state), attach it to that stage as a satellite node or put all of them in a table.
- TABLE = kind 'table', a real grid. props {"cells":[["Header A","Header B"],["1a","1b"]],"headerRow":true}; about 200px per column and 56px per row. Never fake a table out of frames and cards.
- NOTE = kind 'freeform'. props {"emoji":"💡","noteTitle":"Names the move","noteBody":"Concrete starter content","cardType":"note"}. Paints 300x300.
- Also available: 'image' storyboard frame (~320x260, props {"storyboard":true,"description":"caption"}), 'link' bookmark (~320x120, props {"url":"https://...","linkMode":"bookmark"}, label is the title), 'board' hexagon portal (~170x230, label is the title, props {"icon":"grid"}), 'experienceBlock' (props {"componentKey":"intentionCore"} or desiredChange, humanContext, contextAndMeaning, realityPlanes, sensoryDomains, presenceTypes, stateMapping, traitMapping), and 'line', which is a horizontal divider only (props {"gradientName":"violet","widthPx":2}).

3. COLOUR
- «tint» is one of violet, ocean, emerald, sunset, rose, glacier and colours whatever it is set on: a node's ring, a heading's gradient, a frame's outline, a note's (dark) fill.
- A simple diagram uses ONE family for all its nodes and connectors. Add a second family only to carry meaning: one per lane, branch or frame, or a contrast between two sides. Never give neighbouring nodes of the same chain different families for decoration.
- Meaning: sunset/rose = problem, risk, tension, the old way | emerald = growth, solution, go | ocean = process, system, practice | violet = core, vision, default | glacier = neutral, reference.
- A connector takes the family of the chain it belongs to: props {"gradientName":"emerald","thickness":2,"arrowStyle":"end"}. Use "lineStyle":"dashed" for optional, weak or feedback relations, and "arrowStyle":"none" for plain association.

4. WRITING
- Fill every element with specific content drawn from the project context and the request. Never write placeholders such as "Add text here" or "Step 1".
- Nodes carry names; explanation goes in a detail node, a caption or a table cell. If a node needs more than ~140 characters it is a table cell or a note.
- A title states the point of the layout, and its caption says in one line what the reader should take from it.`;
