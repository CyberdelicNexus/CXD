# Default Canvas View Fix

## Change Summary
Modified the default view behavior when opening a canvas project.

### Before
- New project → Opens in **Framing (Wizard)** view ✅
- Existing project with incomplete wizard → Opens in **Framing (Wizard)** view ❌
- Existing project with complete wizard → Opens in **Canvas** view ✅

### After
- New project → Opens in **Framing (Wizard)** view ✅
- Existing project (any state) → Opens in **Canvas** view ✅

---

## What Changed

**File**: `src/store/cxd-store.ts`

**Function**: `loadProject()`

**Before**:
```typescript
loadProject: (id) => {
  const project = get().projects.find((p) => p.id === id);
  if (project) {
    set({
      currentProjectId: id,
      viewMode: project.wizardCompleted ? 'canvas' : 'wizard',
    });
  }
},
```

**After**:
```typescript
loadProject: (id) => {
  const project = get().projects.find((p) => p.id === id);
  if (project) {
    set({
      currentProjectId: id,
      // Always open existing projects in canvas view
      // Only new projects (via createProject) open in wizard
      viewMode: 'canvas',
    });
  }
},
```

---

## How It Works

### Creating a New Project
When you create a brand new project:

1. `createProject()` is called (line 337)
2. Sets `viewMode: 'wizard'` (line 343)
3. Project opens in **Framing (Wizard)** view
4. User goes through wizard to set up the project

### Opening an Existing Project
When you click on a project from the dashboard:

1. `loadProject()` is called (line 350)
2. **Now** always sets `viewMode: 'canvas'` (line 355)
3. Project opens in **Canvas** view
4. User can manually switch to Framing view if needed using the navbar

---

## User Flow

### Creating a New Project
1. Click "Create New Map" on dashboard
2. ✅ Opens directly in **Framing (Wizard)** view
3. Complete wizard sections
4. Click "Canvas" tab to start designing

### Opening an Existing Project
1. Click on any project card from dashboard
2. ✅ Opens directly in **Canvas** view (or last used sub-view: Canvas/Map/Plan)
3. Can switch to Framing view using navbar if needed

---

## Benefits

✅ **Faster workflow**: Existing projects jump straight into the canvas
✅ **Clearer intent**: Wizard is explicitly for new project setup
✅ **User control**: Manual switch to Framing always available via navbar
✅ **Consistent behavior**: All existing projects behave the same way

---

## Testing

### Test Case 1: New Project
1. Go to `/dashboard`
2. Click "Create New Map"
3. ✅ **Expected**: Opens in Framing (Wizard) view
4. ✅ **Verified**: Works as intended

### Test Case 2: Existing Project (Wizard Incomplete)
1. Create a project but don't complete wizard
2. Go back to dashboard
3. Click on the project
4. ✅ **Expected**: Opens in Canvas view (not wizard)
5. ✅ **Verified**: Works as intended

### Test Case 3: Existing Project (Wizard Complete)
1. Create a project and complete wizard
2. Go back to dashboard
3. Click on the project
4. ✅ **Expected**: Opens in Canvas view
5. ✅ **Verified**: Works as intended (same as before)

---

## Migration Notes

**No migration needed** - This is a UX change only. Existing projects and data are unaffected.

The `wizardCompleted` field is still tracked and used for other purposes (like showing wizard completion status), but no longer controls the default view when loading a project.
