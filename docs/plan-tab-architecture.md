# Plan Tab Architecture

> **Key Insight**: Tasks are not a separate entity type. They are **projections** of canvas cards that meet qualification criteria. This ensures a single source of truth.

## Overview

The Plan Tab is a **derived execution layer** that projects canvas cards as tasks WITHOUT creating separate task entities. Tasks are views into qualifying canvas elements, ensuring a single source of truth.

## Core Principle: Cards ARE Tasks

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Canvas Elements                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Freeform   │  │    Text     │  │   Shape     │  │   Image    │ │
│  │   Card      │  │  Element    │  │  Element    │  │  (no task) │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────────┘ │
│         │                │                │                         │
│         └────────────────┼────────────────┘                         │
│                          ▼                                          │
│              ┌───────────────────────┐                              │
│              │  QUALIFICATION CHECK  │                              │
│              │  ──────────────────── │                              │
│              │  □ Markdown tasks?    │                              │
│              │  □ isActionable flag? │                              │
│              │  □ Hypercube tags?    │                              │
│              └───────────┬───────────┘                              │
│                          │ YES (any)                                │
│                          ▼                                          │
│              ┌───────────────────────┐                              │
│              │   TaskProjection      │◄── Computed view, not stored │
│              │   (derived data)      │                              │
│              └───────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PLAN TAB VIEWS                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐          │
│  │  Kanban  │  │  Table   │  │ Timeline │  │  Calendar  │          │
│  │   View   │  │   View   │  │   View   │  │    View    │          │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘          │
│         └────────────────┬────────────────────┘                     │
│                          │                                          │
│              ALL VIEWS QUERY THE SAME                               │
│              UNDERLYING CANVAS ELEMENTS                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Task Qualification Rules

A canvas card appears in the Plan Tab if it meets **ANY** of these conditions:

### 1. Contains Markdown Task Syntax
```markdown
- [ ] Unchecked task
- [x] Completed task
- [ ] Another task item
```

### 2. Explicitly Marked as Actionable
```typescript
element.taskMetadata = {
  isActionable: true
};
```

### 3. Tagged with Hypercube Faces
```typescript
element.hypercubeTags = ['Reality Planes', 'Sensory Domains'];
```

## Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    USER ACTION IN PLAN TAB                       │
│                                                                  │
│  1. Toggle subtask checkbox    ──────────────────────────────┐   │
│  2. Change task status         ──────────────────────────────┤   │
│  3. Set priority               ──────────────────────────────┤   │
│  4. Add due date               ──────────────────────────────┤   │
│                                                              │   │
└──────────────────────────────────────────────────────────────┼───┘
                                                               │
                                                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    UPDATE SOURCE CARD                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  FreeformElement                                          │   │
│  │  ──────────────────                                       │   │
│  │  content: "- [x] Task 1\n- [ ] Task 2"  ◄── Updated      │   │
│  │  taskMetadata: {                         ◄── Updated      │   │
│  │    status: 'in_progress',                                 │   │
│  │    priority: 'high',                                      │   │
│  │    dueDate: '2025-02-01'                                  │   │
│  │  }                                                        │   │
│  │  hypercubeTags: ['Reality Planes']       ◄── Existing     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                                                               │
                                                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    AUTO-SYNC TO CANVAS                           │
│                                                                  │
│  • Changes persist to localStorage/Supabase                      │
│  • Canvas view reflects updated card                             │
│  • Hypercube view shows updated tags                             │
│  • Plan view re-queries and updates                              │
└──────────────────────────────────────────────────────────────────┘
```

## Hypercube Face Filtering

The Plan Tab integrates deeply with the Hypercube model:

```
┌─────────────────────────────────────────────────────────────────┐
│                      HYPERCUBE FACES                            │
│                                                                 │
│  ┌─────────────────┐   ┌─────────────────┐   ┌───────────────┐ │
│  │ Reality Planes  │   │ Sensory Domains │   │ Presence Types│ │
│  │    (Purple)     │   │     (Pink)      │   │    (Cyan)     │ │
│  └────────┬────────┘   └────────┬────────┘   └───────┬───────┘ │
│           │                     │                     │         │
│  ┌────────┴────────┐   ┌────────┴────────┐   ┌───────┴───────┐ │
│  │  State Mapping  │   │  Trait Mapping  │   │   Meaning     │ │
│  │    (Amber)      │   │   (Emerald)     │   │ Architecture  │ │
│  │                 │   │                 │   │   (Indigo)    │ │
│  └─────────────────┘   └─────────────────┘   └───────────────┘ │
│                                                                 │
└──────────────────────────────────────────────────────┬──────────┘
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FILTER BY FACE                               │
│                                                                 │
│  Filter: [Reality Planes] [Sensory Domains]                     │
│  Mode: ○ Any (OR)  ● All (AND)                                  │
│                                                                 │
│  Results: Cards tagged with selected faces                      │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Card A       │  │ Card B       │  │ Card C       │          │
│  │ [RP][SD]     │  │ [RP]         │  │ [SD][PT]     │          │
│  │ ✓ Matches    │  │ AND: ✗       │  │ AND: ✗       │          │
│  │              │  │ OR:  ✓       │  │ OR:  ✓       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## View Configurations

### Kanban View
Groups tasks into columns by status (default) or other fields:
- **Columns**: To Do, In Progress, Blocked, Done
- **Group by**: status | priority | hypercubeFace | assignee
- **Drag-drop**: Moves task between columns, updates source card

### Table View
Flat sortable list with columns:
- Status, Title, Hypercube Faces, Priority, Due Date, Progress
- Sortable and filterable
- Inline editing updates source card

### Timeline View
Gantt-style visualization:
- Tasks with start/due dates shown as bars
- Group by hypercube face for CXD alignment
- Shows experience phase relationships

### Calendar View
Month/week/day grid:
- Tasks placed on due dates
- Color-coded by face or status
- Click to navigate to source card

## Linking Back to Source

Every TaskProjection maintains references:

```typescript
interface TaskProjection {
  // Direct link to source
  sourceElementId: string;       // Canvas element ID
  sourceElementType: string;     // 'freeform' | 'text' | 'shape'
  sourceBoardId: string | null;  // Board containing element
  
  // Hypercube integration  
  hypercubeTags: HypercubeFaceTag[];  // Direct face tags
  
  // Indirect intent link
  // Intent is derived by traversing board hierarchy:
  // Task → Board → Parent Board → ... → Project Intent
}
```

### Navigation Actions
- **"Go to Card"**: Navigates canvas to source element, highlights it
- **"Open Board"**: If in nested board, navigates to that board
- **Click Face Tag**: Filters Plan to that face, or opens Hypercube focused on face

## State Synchronization Rules

| Plan Tab Action | Source Card Update |
|-----------------|-------------------|
| Toggle subtask | Update content markdown |
| Change status | Update `taskMetadata.status` |
| Set priority | Update `taskMetadata.priority` |
| Set due date | Update `taskMetadata.dueDate` |
| Add assignee | Update `taskMetadata.assignee` |
| Add tag | Update `taskMetadata.customTags` OR `hypercubeTags` |
| Drag to column | Update based on column grouping field |
| Delete task | **Cannot** - must delete source card |

## Filter Persistence

```typescript
interface SavedFilter {
  id: string;
  name: string;
  filter: TaskFilter;
  isDefault?: boolean;  // Auto-applied on load
}

// Example saved filters
const experienceDesignFilter = {
  name: "Experience Design Tasks",
  filter: {
    hypercubeFaces: ['Reality Planes', 'Sensory Domains', 'Presence Types'],
    requireAllFaces: false,
    showCompleted: false
  }
};

const integrationFilter = {
  name: "Integration Phase",
  filter: {
    hypercubeFaces: ['Trait Mapping'],
    customTags: ['integration']
  }
};
```

## Performance Considerations

1. **Lazy Projection**: Tasks projected only when Plan Tab is active
2. **Memoization**: Query results cached until canvas changes
3. **Virtual Lists**: Large task lists use windowing
4. **Debounced Sync**: Updates batched before persisting

## File Structure

```
src/
├── types/
│   └── plan-types.ts          # All Plan Tab types
├── utils/
│   └── task-engine.ts         # Core query/projection logic
├── components/
│   └── cxd/
│       └── plan/
│           ├── plan-tab.tsx           # Main container
│           ├── plan-filter-panel.tsx  # Filter UI
│           ├── kanban-view.tsx        # Kanban implementation
│           ├── table-view.tsx         # Table implementation
│           ├── timeline-view.tsx      # Timeline implementation
│           ├── calendar-view.tsx      # Calendar implementation
│           └── task-detail-panel.tsx  # Task inspector
└── hooks/
    └── use-plan-tasks.ts      # React hook for task queries
```
