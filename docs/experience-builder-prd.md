# CXD Experience Builder: product requirements and production pipeline

Status: proposal, not scheduled. Nothing here is needed for product-market fit of
the current canvas. It describes the evolutionary step after it: the canvas stops
at a design today, and this makes it produce a running prototype.

Sizing uses load, not time: **S** (one focused agent session or a short human
decision), **M** (several sessions, some review), **L** (a workstream with design
risk). Owner is **H** (human), **A** (agent), or **H+A** (agent builds, human
decides or tests).

## 1. The idea in one paragraph

A CXD project already holds what an experience is for (the framing fields), how
it is structured (canvas elements, edges, Hypercube tags) and how it will be
produced (Plan tasks). What it lacks is anything executable. The Experience
Builder adds a node-based **Build surface** where the designer wires scenes,
moments, triggers and stimuli, and a pipeline that turns that graph into a
running prototype in a real engine: first a Three.js web build, then Unity, then
other targets.

## 2. The decision that shapes everything: compile to a spec, not to an engine

The canvas should never talk to Unity or Three.js directly. It compiles the
graph into a platform-neutral **Experience Spec (XSpec)**, a versioned JSON
document. Each target has an adapter that turns XSpec into a build.

```
framing fields ─┐
canvas + tags  ─┼─► Build graph ─► XSpec (JSON, validated) ─► target adapter ─► prototype
assets         ─┘                        ▲                                        │
                                         └──────── playtest notes, status ◄───────┘
```

Why this matters:

- **One graph, many targets.** Adding TouchDesigner or a mobile target later is a
  new adapter, with no change to the editor.
- **Agents get a contract.** An agent with a Unity MCP does far better against a
  precise spec than against a screenshot of a canvas.
- **It is testable.** XSpec can be validated, diffed and versioned without any
  engine installed.
- **It protects the existing canvas.** The diagram canvas keeps its loose,
  expressive model. Only the Build surface has strict semantics.

## 3. How CXD connects to engines

There are two ways to reach an engine, and they suit different targets.

| Route | How it works | Fits |
|---|---|---|
| **In-app generation** | The CXD server asks a model to generate a web build from XSpec, stores the bundle, shows it in a preview frame | Three.js / WebGL / WebXR |
| **CXD as an MCP server** | CXD exposes the project (framing, XSpec, assets, status write-back) as MCP tools. The designer's own Claude, which also has the Unity MCP connected, pulls the spec and builds locally | Unity, TouchDesigner, anything that runs on the designer's machine |

The second route is the important one. Unity runs on the designer's computer, and
the CXD app runs in the cloud, so the cloud cannot drive the editor. Making CXD an
MCP server means CXD does not have to orchestrate engines at all. Any agent
harness that can hold two MCP connections can do the build, and CXD stays the
source of truth for intent and structure. The existing bridge endpoint
(`src/app/api/bridge/task-writeback`) is the precedent for authenticated
write-back into a project.

### Target order

1. **Three.js web build.** No install, the preview lives inside CXD, the loop
   from graph edit to running prototype is the shortest, and WebXR gives a path
   to headset viewing from the same build.
2. **Unity through the CXD MCP server.** This is the real production engine for
   VR and mixed reality, and it has already been tested by hand with Claude and
   a Unity MCP.
3. **Later:** mobile (through Unity or the web build), TouchDesigner or other
   live-visual engines, audio engines. Each needs a check that a usable MCP or
   scripting interface exists before committing.

## 4. The Build graph

A new surface next to Canvas, Map and Plan. Nodes are typed and have ports;
edges are either **flow** (what happens next) or **data** (a value feeding a
parameter). This is stricter than the diagram canvas, where `CanvasEdge` joins
any two elements with no meaning.

| Node | What it represents | Draws on |
|---|---|---|
| **Scene** | A space or environment the participant is in | `realityPlanes` |
| **Moment** | A beat inside a scene with a duration or an exit condition | canvas journey stages |
| **Trigger** | What starts something: time, gaze, proximity, input, voice, biosignal | `presenceTypes` |
| **Stimulus** | What the participant perceives: visual, audio, haptic, text, light | `sensoryDomains` |
| **State target** | The inner state a moment aims for, with intensity | `stateMapping`, `traitMapping` |
| **Logic** | Branch, wait, loop, random, counter | none |
| **Asset** | A model, texture, sound, video or shader, by reference | Storage |
| **Variable** | A value shared across the experience | none |

Requirements:

- **R1.** Every node kind has a fixed set of typed input and output ports. An
  edge that joins incompatible ports cannot be created.
- **R2.** A node can link back to the canvas element or framing field it came
  from, so the designer can see why a scene exists.
- **R3.** The graph validates continuously and shows problems on the node: no
  entry point, a moment with no exit, a stimulus with a missing asset.
- **R4.** The assistant can draft a first Build graph from the framing and the
  canvas, propose-only, the same way tag suggestions work today.
- **R5.** A node carries a free-text **intent** field. The spec carries it to
  the adapter so the building agent knows the feeling aimed for, not only the
  mechanics.

## 5. XSpec

- **R6.** One JSON document per build, with a schema version, validated by zod
  on the server. Nothing reaches an adapter unvalidated.
- **R7.** It contains: project intent (a compact digest of the framing),
  scenes, moments, triggers, stimuli, logic, variables, asset references with
  URLs and sizes, and per-target hints.
- **R8.** It is deterministic: the same graph produces the same spec and the
  same content hash. The hash identifies a build.
- **R9.** It is engine-neutral. Units, coordinate conventions and timing are
  defined once in the spec; adapters convert.
- **R10.** Each element keeps the id of its source node, so playtest feedback
  can be attached to the right node on the way back.

## 6. UX flow

1. **Design** as today: wizard, canvas, Hypercube.
2. **Open Build.** The assistant offers a drafted graph from what already
   exists. The designer accepts, edits or starts blank.
3. **Wire** scenes, moments, triggers and stimuli. Validation runs live.
4. **Preview** the web build in a side panel. Edit a node, regenerate, compare
   with the previous build.
5. **Port** to Unity: the designer connects their Claude to the CXD MCP server
   and the Unity MCP, and asks it to build the current spec. Progress and the
   result are written back to the project.
6. **Playtest and return.** Notes from a playtest land on the originating nodes
   as comments, and can become Plan tasks.

## 7. Storage requirements

The base64 incident sets the rule: **project rows hold references only.**

| Data | Where | Notes |
|---|---|---|
| Build graph (nodes, edges) | Y.Doc, a new collection | Needs the serializer, the bridge observer guard and the load-time reconciler, as CLAUDE.md requires for any new collection |
| XSpec snapshots | A `cxd_builds` table, one row per build | Immutable, keyed by content hash, stores the spec JSON |
| Assets (models, audio, video, textures) | Storage bucket, per project | Never inline. Size and type limits per plan. Large files need resumable upload |
| Generated web builds | Storage bucket, per build | Served to the preview frame from a separate origin |
| Build runs | `cxd_build_runs` table | Target, spec hash, status, log, artifact URL, who or what ran it |
| MCP access tokens | A tokens table, hashed | Per project, revocable, scoped read or read-plus-write-back |

- **R11.** A save-time guard rejects or externalizes any embedded binary in the
  project row, with a Sentry alert on rows above a size threshold.
- **R12.** Storage use is metered per account, with plan limits, because 3D
  assets are orders of magnitude larger than canvas images.
- **R13.** Generated code runs sandboxed: a separate origin, a restrictive
  CSP, no access to the CXD session.

## 8. Production pipeline

Each stage has a gate. A build does not advance past a failed gate.

| Stage | Output | Gate |
|---|---|---|
| 1. Frame | Framing fields, canvas, tags | Existing readiness checks |
| 2. Graph | Build graph | Graph validation passes |
| 3. Compile | XSpec plus hash | Schema validation passes |
| 4. Gather | All referenced assets present | No missing or oversized asset |
| 5. Build | Web bundle, or a Unity scene built by an agent | Build completes, smoke check runs |
| 6. Review | Human playtest | Designer accepts or sends notes back |
| 7. Return | Comments and tasks on source nodes | none |

## 9. Workstreams and task load

### A. Foundations

| Task | Owner | Load |
|---|---|---|
| Define the node vocabulary and port types with real experiences as test cases | H | M |
| Write the XSpec schema (zod) and a hand-written example spec for one real experience | H+A | M |
| Graph-to-XSpec compiler as a pure function, with a `__verify__` script | A | M |
| Save-time binary guard and row-size alert | A | S |

### B. Build surface

| Task | Owner | Load |
|---|---|---|
| New Y.Doc collection for build nodes and edges, with serializer, observer guard and reconciler | A | M |
| Node editor UI: typed ports, flow and data edges, palette, inspector | H+A | L |
| Live validation with on-node problems | A | M |
| Assistant drafts a graph from framing and canvas, propose-only | A | M |
| Interaction design review of the editor against Unity and TouchDesigner habits | H | S |

### C. Web target

| Task | Owner | Load |
|---|---|---|
| Three.js runtime that plays an XSpec (scenes, timeline, triggers, stimuli) | A | L |
| Decide: fixed runtime that interprets the spec, or model-generated code per build | H | S |
| Sandboxed preview panel and build storage | A | M |
| Asset upload pipeline with limits and metering | A | M |
| WebXR mode for headset viewing | A | M |

### D. CXD MCP server and Unity

| Task | Owner | Load |
|---|---|---|
| MCP server exposing project digest, XSpec, asset list and status write-back | A | M |
| Token issuing and revoking in project settings | A | S |
| A build skill for the agent: how to read XSpec and realise it through the Unity MCP | H+A | M |
| Unity project template the agent builds into (XR rig, input, scene loader) | H | M |
| Run the same example spec through Unity end to end and record what broke | H+A | M |

### E. Loop back

| Task | Owner | Load |
|---|---|---|
| Playtest notes attach to source nodes as comments | A | S |
| Build history and compare in the Build surface | A | M |
| Notes to Plan tasks | A | S |

## 10. The smallest slice that proves it

Before any editor UI exists:

1. Write one XSpec by hand for a short real experience (**H+A, M**).
2. Build the Three.js runtime that plays it (**A, L**).
3. Give the same spec to Claude with the Unity MCP and see how far it gets
   (**H+A, M**).

If both targets produce something recognisably the same experience from one
spec, the architecture holds and the editor is worth building. If they do not,
the spec is wrong, and that is cheap to learn at this point.

## 11. Open decisions

- **Interpreter or generator for the web target.** A fixed runtime is
  predictable and safe; generated code is more expressive and harder to trust.
  A fixed runtime with generated shaders and behaviours as plug-ins is a
  possible middle.
- **How much the Build graph and the canvas share.** Separate surface with
  links back (proposed here), or build semantics added to existing canvas
  elements.
- **Pricing.** Builds cost model credits and storage. This is likely a paid
  tier feature.
- **Which engines after Unity.** Depends on which have a usable MCP or
  scripting interface at the time.
- **Collaboration.** Whether two people can edit the Build graph live, as on
  the canvas, from the first version.

## 12. Risks

- **Scope pull.** This is a second product. The slice in section 10 is the
  guard against building an editor before the pipeline is proven.
- **Spec too thin or too heavy.** Too thin and the agent guesses; too heavy and
  designers will not fill it in. The intent field (R5) is the pressure valve.
- **Local setup friction.** The Unity route needs the designer to connect two
  MCP servers. A guided setup and a project template reduce it but do not
  remove it.
- **Storage cost.** 3D assets change the cost model. Metering has to exist
  before assets are opened to all accounts.
- **Generated code safety.** Anything model-written that runs in the browser
  must be sandboxed from the first build.
