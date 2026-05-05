# CXD Canvas - AI Intelligence Layer Architecture

## Codebase Analysis

### Data Layer Overview

All application state is managed through a centralized **Zustand store** (`src/store/cxd-store.ts`) with 120+ actions. The database uses **Supabase PostgreSQL** with a `cxd_projects` table storing all project data as a `project_data: jsonb` column.

### View-to-Data Mapping

| View | Data Source (in CXDProject) | Key Properties |
|------|---------------------------|----------------|
| **Framing (Wizard)** | `intentionCore`, `desiredChange`, `humanContext`, `contextAndMeaning` | Text inputs: projectName, mainConcept, coreMessage, world, story, magic, etc. |
| **Canvas** | `canvasLayout.elements`, `canvasLayout.edges`, `canvasLayout.boards` | Elements (freeform, image, shape, text, link, board, container, experienceBlock), connectors, nested boards |
| **Map (Hypercube)** | `realityPlanesV2`, `sensoryDomains`, `presenceTypes`, `stateMapping`, `traitMapping`, `contextAndMeaning` | Slider values, toggle states, text inputs per face. Elements tagged via `hypercubeTags[]` |
| **Plan** | Derived from `canvasLayout.elements` | Tasks are projections of qualifying canvas cards (has markdown tasks, isActionable, or hypercubeTags) |

### Hypercube Face System

6 data faces defined in `CUBE_FACES` array (`src/components/cxd/canvas/hypercube-3d.tsx`):

| Face | Section ID | Hue | Data Type |
|------|-----------|-----|-----------|
| Reality | `realityPlanes` | 280 (purple) | Toggle array with interface/modality |
| Sensory | `sensoryDomains` | 45 (amber) | 5 sensory sliders (0-100) |
| Presence | `presence` | 195 (cyan) | 6 presence type sliders (0-100) |
| States | `stateMapping` | 160 (teal) | 4 quadrant text inputs |
| Traits | `traitMapping` | 260 (violet) | 4 quadrant text inputs |
| Meaning | `contextAndMeaning` | 320 (magenta) | 3 text areas (world, story, magic) |

Plus **Core** (integration overview, hue 195) and **General AI** (holistic assistant, hue 220).

### Existing Feature Gates

`src/lib/plans.ts` defines `hasAI: boolean` per plan tier:
- Free: `hasAI: false`
- Pro/Lifetime/Beta Tester: `hasAI: true`

`src/hooks/use-subscription.ts` exposes `hasAI` as a derived boolean.

### Current Chat Implementation (Pre-AI)

The Map view (`hypercube-3d.tsx`) has a placeholder chat UI shell:
- Local `useState<Record<string, ChatMessage[]>>` keyed by face ID or `"general"`
- Sends a hardcoded auto-reply ("This chatbot will be activated in the next release...")
- Core face shows an overview panel (6-face grid) instead of a chat window
- `ChatMessage` type: `{ id, role: 'user'|'assistant', content, timestamp }`

---

## AI Intelligence Layer Design

### Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  CONTEXT AGGREGATOR                  │
│  src/utils/ai-context-aggregator.ts                 │
│  Pure functions reading from Zustand store           │
├──────────┬──────────┬──────────┬────────────────────┤
│ FRAMING  │  CANVAS  │   MAP    │       PLAN         │
│ wizard   │ elements │ faces    │  task projections  │
│ inputs   │ edges    │ insights │  from qualifying   │
│ sliders  │ boards   │ tagged   │  canvas elements   │
│          │          │ elements │                    │
└──────────┴──────────┴──────────┴────────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  SYSTEM PROMPT  │
              │  ENGINE         │
              │  src/lib/ai/    │
              │  system-prompts │
              └────────┬────────┘
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
   ┌─────────────────┐  ┌─────────────────┐
   │  FACE CHAT AI   │  │  AI ASSISTANT   │
   │  Per-face       │  │  General/Core   │
   │  filtered slice │  │  full context   │
   └────────┬────────┘  └────────┬────────┘
            │                    │
            ▼                    ▼
   ┌─────────────────┐  ┌─────────────────┐
   │  Vercel AI SDK  │  │  Vercel AI SDK  │
   │  streamText()   │  │  generateText() │
   │  Tier 1 models  │  │  Tier 2 models  │
   └────────┬────────┘  └────────┬────────┘
            │                    │
            ▼                    ▼
   ┌─────────────────────────────────────┐
   │  PROVIDER REGISTRY                  │
   │  src/lib/ai/provider-registry.ts    │
   │  GPT / Claude / Gemini adapters     │
   │  via @ai-sdk/* packages             │
   └─────────────────────────────────────┘
```

### Context Aggregator Schema

The aggregator produces a `AIProjectContext` JSON object injected into system prompts:

```typescript
{
  version: "1.0",
  projectId: string,
  projectName: string,
  lastUpdated: ISO-8601,
  sections: {
    framing: {
      intentionCore: { projectName, mainConcept, coreMessage },
      desiredChange: { insights, feelings, states, knowledge },
      humanContext: { audienceNeeds, audienceDesires, userRole },
      contextAndMeaning: { world, story, magic },
      lastUpdated: ISO-8601
    },
    canvas: {
      elementCount: number,
      elementSummary: [{ type, count }],
      boards: [{ id, title, elementCount }],
      connectorCount: number,
      contentDigest: string, // Top 20 cards summarized
      lastUpdated: ISO-8601
    },
    map: {
      faces: [{
        id: string,
        label: string,
        completion: number,
        state: 'undeveloped'|'emerging'|'active'|'coherent',
        data: Record<string, any>, // Face-specific values
        taggedElementCount: number,
        taggedElements: [{ id, title, excerpt }],
        starredMessages: [{ content, timestamp }]
      }],
      diagnostics: [{ category, severity, message }],
      overallCompletion: number,
      lastUpdated: ISO-8601
    },
    plan: {
      totalTasks: number,
      tasksByStatus: Record<string, number>,
      tasksByPriority: Record<string, number>,
      upcomingDeadlines: [{ title, dueDate }],
      lastUpdated: ISO-8601
    }
  }
}
```

Face chats receive a **filtered slice** (only their face data). Core and General AI receive the **full context**.

### Multi-Model Routing

Users select a provider (GPT/Claude/Gemini). Each provider has two tiers:

| Provider | Tier 1 (Chat) | Tier 2 (Analysis/ERD) |
|----------|--------------|----------------------|
| GPT | gpt-4.1 | gpt-o3 |
| Claude | claude-sonnet-4-5 | claude-sonnet-4-5 (extended thinking) |
| Gemini | gemini-2.5-pro | gemini-2.5-pro (thinking) |

The Vercel AI SDK (`ai` package) provides a unified adapter pattern - adding a new provider requires only a new `@ai-sdk/*` package and registry entry.

### Database Additions

Two new tables:
1. `ai_chat_threads` - Per (project, user, face) chat history stored as JSONB messages array
2. `ai_credits` + `ai_credit_transactions` - Per-user credit ledger with atomic deduction

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ai/chat` | POST | Streaming chat (SSE via Vercel AI SDK) |
| `/api/ai/analyze` | POST | Tier 2 deep analysis (non-streaming) |
| `/api/ai/threads` | GET/PUT | Chat thread persistence |
| `/api/ai/credits` | GET | Credit balance + model selection |

### Credit System

500 credits/month for Pro users. Costs vary by provider (Claude 2x, GPT 1x, Gemini 1x for chat; higher for analysis/ERD). Atomic SQL deduction prevents race conditions. Monthly reset via period check on each API call.
