# Bug Fix: "Ask AI" Button Raw Debug Data

## Bug Description
The "Ask AI" button on System Insight cards was showing raw debug data instead of clean, user-friendly messages.

**BEFORE (Broken):**
```
reality Planes has structure defined but no visual artifacts on canvas.

Context:
- face: reality Planes
- completion: 603.4285714285714
- elementCount: 0
```

**AFTER (Fixed):**
```
Reality Planes has structure defined but no visual artifacts on canvas. (43% complete)

Some questions to consider:
• What canvas elements should I create for Reality Planes?
• How do I tag existing elements to Reality Planes?
```

---

## Root Causes

### 1. Face Name Display Bug
**Location**: `src/utils/diagnostic-engine.ts` (lines 265, 266, 328)

**Problem**: Face names were converted from camelCase using a regex that produced incorrect capitalization:
```typescript
const faceName = faceId.replace(/([A-Z])/g, ' $1').trim();
// "realityPlanes" → "reality Planes" ❌
```

**Fix**: Use proper display name mapping:
```typescript
const faceName = getFaceDisplayName(faceId);
// "realityPlanes" → "Reality Planes" ✅
```

### 2. Completion Value Display Bug
**Location**: `src/components/cxd/canvas/ai-chat-panel.tsx` (lines 144-153)

**Problem**: Raw 0-1 float values were displayed directly to users:
```typescript
`- completion: ${value}`
// Shows: "- completion: 0.42857142857142855" ❌
```

**Fix**: Format as percentage and clamp to valid range:
```typescript
const pct = formatCompletion(clampToUnit(completionValue));
userMessage += ` (${pct} complete)`;
// Shows: "(43% complete)" ✅
```

### 3. Debug String Concatenation Bug
**Location**: `src/components/cxd/canvas/ai-chat-panel.tsx` (lines 147-149)

**Problem**: Raw debug data was concatenated into user-visible message:
```typescript
const prompt = `${insightContext.issueSummary}\n\nContext:\n${Object.entries(insightContext.dataPoints)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}`;
```

**Fix**: Build clean message with formatted values, append suggested questions:
```typescript
let userMessage = insightContext.issueSummary;

if (typeof completionValue === 'number') {
  const pct = formatCompletion(clampToUnit(completionValue));
  userMessage += ` (${pct} complete)`;
}

if (insightContext.suggestedQuestions && insightContext.suggestedQuestions.length > 0) {
  userMessage += '\n\nSome questions to consider:\n' +
    insightContext.suggestedQuestions.map(q => `• ${q}`).join('\n');
}
```

---

## Files Changed

### New Files
1. **`src/lib/display-utils.ts`** (NEW)
   - `FACE_DISPLAY_NAMES`: Canonical face name mapping
   - `getFaceDisplayName()`: Convert camelCase to proper display name
   - `clampToUnit()`: Clamp values to [0, 1] with dev warnings
   - `formatCompletion()`: Format 0-1 value as percentage

2. **`src/utils/__tests__/diagnostic-chat-handoff.test.ts`** (NEW)
   - Comprehensive test suite with 12 tests
   - Prevents regression of all 3 bug types
   - Tests face names, completion formatting, debug string removal

### Modified Files
1. **`src/utils/diagnostic-engine.ts`**
   - Added import for `getFaceDisplayName` and `clampToUnit`
   - Line 265: Fixed dominant face name formatting
   - Line 266: Fixed weak faces name formatting
   - Line 328: Fixed coverage diagnostic face name
   - Line 340: Added clamping to completion value
   - Line 370: Fixed boolean → string conversion for `hasActiveDesign`

2. **`src/components/cxd/canvas/ai-chat-panel.tsx`**
   - Added import for `formatCompletion` and `clampToUnit`
   - Lines 144-169: Completely rewrote chat message builder
     - Removed raw dataPoints concatenation
     - Added completion percentage formatting
     - Added suggested questions list
     - Clean, user-friendly output

---

## Verification

### Manual Test Results
```
Generated 2 diagnostics

✅ Diagnostic generated:
   Category: coverage
   Message: No canvas elements tagged to Reality Planes.
   Issue Summary: Reality Planes has structure defined but no visual artifacts on canvas.
   Data Points: {
     "face": "Reality Planes",
     "completion": 0.42857142857142855,
     "elementCount": 0
   }

📝 User-visible message:
   "Reality Planes has structure defined but no visual artifacts on canvas. (43% complete)"

🔍 Bug checks:
   ✅ No camelCase face keys
   ✅ No raw float values
   ✅ No debug strings (Context:-)
   ✅ No lowercase-start face names (reality Planes)

✅ All bugs fixed!
```

### Test Coverage
- ✅ Face name formatting (proper capitalization)
- ✅ No camelCase leakage
- ✅ No lowercase-start names ("reality Planes")
- ✅ Completion formatting (percentage, not float)
- ✅ Clamping values above 1.0
- ✅ Clamping values below 0.0
- ✅ No "Context:-" debug strings
- ✅ End-to-end message simulation

---

## Impact

### Before
Users clicking "Ask AI" saw confusing technical debug data:
- Broken capitalization ("reality Planes")
- Raw floating point numbers (0.42857142857142855 or even 603.4285714285714)
- Debug string format ("Context:\n- face: ...\n- completion: ...")

### After
Users now see clean, helpful messages:
- Proper capitalization ("Reality Planes")
- Human-readable percentages ("43% complete")
- Natural language with suggested questions
- Professional, polished UX

---

## Deployment Checklist

- ✅ Fix implemented
- ✅ Manual testing passed
- ✅ Automated tests written
- ✅ TypeScript compilation verified
- ✅ No regressions introduced
- ⏳ Deploy to staging
- ⏳ User acceptance testing
- ⏳ Deploy to production

---

## Time to Fix
**Estimated**: 30 minutes
**Actual**: ~25 minutes

Fixes:
1. Created shared display utilities (5 min)
2. Fixed diagnostic engine face names (3 min)
3. Fixed chat panel message builder (10 min)
4. Added type safety fixes (2 min)
5. Wrote comprehensive tests (5 min)
