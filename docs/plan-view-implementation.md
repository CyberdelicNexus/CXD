# Plan View & Task System Implementation

## Overview
The CXD project now includes a complete project management system in the **Plan Tab**, where canvas cards can function as executable tasks while maintaining their expressive nature.

## Key Features

### 1. Plan View (Kanban, Table, Timeline, Calendar)
- **Location**: `src/components/cxd/plan/`
- **Entry Point**: Plan view is accessible via the navbar button alongside Canvas and Hypercube views
- **Views**:
  - **Kanban**: Drag-and-drop task cards across status columns (To Do, In Progress, Blocked, Done)
  - **Table**: Sortable columns with quick navigation to canvas
  - **Timeline**: Gantt-style visualization with date ranges
  - **Calendar**: Month view with daily task breakdowns

### 2. Task Qualification System
Cards automatically become tasks when they have **any** of these:
- **Markdown task syntax**: `- [ ]` or `- [x]` checkboxes in content
- **Explicit actionable flag**: Marked via context menu "Mark as Task" button
- **Hypercube face tags**: Tagged with any of the 6 core faces

This is handled in `src/utils/task-engine.ts` with the `qualifiesAsTask()` function.

### 3. Visual Indicators on Canvas
- **Purple dot indicator**: Small badge appears in the top-right corner of actionable cards
- **Non-intrusive**: Doesn't clutter the card, just a subtle visual cue
- **Applies to**: Freeform cards, shapes with text, and text elements

### 4. Task Metadata (Non-Visual)
Stored in `taskMetadata` field on canvas elements:
```typescript
{
  isActionable?: boolean;
  status?: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;  // ISO date
  startDate?: string;
  assignee?: string;
  estimatedHours?: number;
}
```

This metadata is **NOT visible on the card** in canvas mode - it's only visible and editable in the Plan tab.

### 5. Bidirectional Sync
- **Plan → Canvas**: Status changes, date updates sync back to the card's `taskMetadata`
- **Canvas → Plan**: Content edits (like checking checkboxes) immediately reflect in Plan views
- **Navigation**: Click "View in Canvas" to jump directly to the card with highlight animation

### 6. Context Menu Integration
Added "Mark as Task" button to freeform card toolbar:
- Toggles the `isActionable` flag
- Visual feedback: Button highlights purple when active
- Located between Bold and separator in the context menu

## Component Architecture

```
src/components/cxd/plan/
├── plan-view.tsx           # Main container with tab switching
├── kanban-view.tsx         # Kanban board with drag-and-drop
├── table-view.tsx          # Sortable table view
├── timeline-view.tsx       # Gantt-style timeline
├── calendar-view.tsx       # Monthly calendar grid
├── task-detail-panel.tsx   # Right sidebar for editing task metadata
└── task-filter-panel.tsx   # Left sidebar for filtering tasks
```

## Data Flow

1. **Canvas Elements** → `usePlanTasks` hook → **Task Projections**
2. Task projections are **computed on-demand**, not stored separately
3. Single source of truth: Canvas elements + boards
4. Updates flow back through store actions (`updateCanvasElement`)

## Custom Properties System
The Plan view includes predefined task properties (status, priority, dates, etc.) with the ability to add more through the `TaskMetadata` interface in `src/types/canvas-elements.ts`.

## Navigation Patterns

### From Plan → Canvas
```typescript
navigateToTask(taskId) // Centers viewport, switches board context, highlights element
```

### From Canvas → Plan
Click the Plan tab button in navbar - tasks are automatically discovered.

## Hypercube Integration
Cards tagged with hypercube faces automatically appear in Plan view, allowing you to:
- Filter by face (e.g., "Show only State Mapping tasks")
- Color-code by face in timeline/calendar views
- Group by face in kanban view

## Usage Examples

### Create a Task Card
1. **Option A**: Add markdown checkboxes
   ```
   - [ ] Research XR frameworks
   - [ ] Prototype gesture system
   - [x] Define experience goals
   ```

2. **Option B**: Use context menu "Mark as Task"
   - Select card → Click checkmark button in toolbar

3. **Option C**: Tag with hypercube face
   - Select card → Use hypercube tag dropdown

### Manage Tasks in Plan View
1. Switch to Plan tab (navbar button)
2. Choose view: Kanban / Table / Timeline / Calendar
3. Filter by status, priority, or hypercube face
4. Click task to open detail panel
5. Edit metadata (dates, assignee, status)
6. Click "View in Canvas" to jump to source card

### Navigate Back to Canvas
The navigation system preserves the board hierarchy and viewport position, so you always land in the right context.

## Technical Notes

- **No separate database**: Tasks are projections of existing canvas elements
- **Real-time sync**: Changes propagate through Zustand store
- **Type-safe**: Full TypeScript coverage with `TaskProjection` type
- **Performance**: Task computation is memoized via `useMemo` in the hook
- **Extensible**: Add new properties by extending `TaskMetadata` type

## Future Enhancements (Out of Scope)
- Drag-and-drop from Plan → Canvas to create new cards
- Dependencies between tasks
- Gantt chart edit mode (currently view-only)
- Bulk actions (multi-select tasks)
- Task templates
