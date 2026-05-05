# How to Verify the "Ask AI" Bug Fix

## 🎯 What Was Fixed

The "Ask AI" button on diagnostic cards now shows clean, user-friendly messages instead of raw debug data.

---

## ✅ Quick Verification Steps

### Step 1: Create a Project with Reality Planes
1. Open the app in dev mode: `npm run dev`
2. Create a new project
3. Add 3+ Reality Planes in the wizard
4. Complete the wizard
5. Go to the Hypercube Map view

### Step 2: Trigger a Diagnostic
1. The System Insights panel (left side) should show diagnostics
2. Look for a diagnostic that says "No canvas elements tagged to Reality Planes"

### Step 3: Click "Ask AI"
1. Click the **"Ask AI"** button on the diagnostic card
2. Check the AI chat panel that opens

### Step 4: Verify the Message is Clean

**✅ CORRECT (After Fix):**
```
Reality Planes has structure defined but no visual artifacts on canvas. (43% complete)

Some questions to consider:
• What canvas elements should I create for Reality Planes?
• How do I tag existing elements to Reality Planes?
```

**❌ WRONG (Before Fix):**
```
reality Planes has structure defined but no visual artifacts on canvas.

Context:
- face: reality Planes
- completion: 0.42857142857142855
- elementCount: 0
```

---

## 🔍 What to Check For

### ✅ Face Names
- Should be: **"Reality Planes"** (capital R, capital P)
- NOT: "reality Planes" (lowercase r)
- NOT: "realityPlanes" (camelCase)

### ✅ Completion Values
- Should be: **"43% complete"** or similar percentage
- NOT: "0.42857142857142855" (raw float)
- NOT: "603.4285714285714" (unclamped value)

### ✅ Message Format
- Should be: Clean natural language with suggested questions
- NOT: "Context:\n- face: ...\n- completion: ..." (debug format)

---

## 🧪 Automated Test

Run the test suite (once test runner is configured):
```bash
npm test diagnostic-chat-handoff.test.ts
```

Expected output:
```
PASS  src/utils/__tests__/diagnostic-chat-handoff.test.ts
  Diagnostic Chat Handoff
    Face name formatting
      ✓ should use proper display names, not camelCase
      ✓ should not have lowercase-start face names like "reality Planes"
    Completion value formatting
      ✓ should not contain raw float values
      ✓ should format completion as percentage when displayed to user
      ✓ should clamp completion values above 1
      ✓ should clamp completion values below 0
    Debug string removal
      ✓ should not contain Context:- debug strings
    User message simulation
      ✓ should produce clean user-visible messages
    Face display name utility
      ✓ should convert all face keys to proper display names
      ✓ should pass through unknown keys unchanged

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

---

## 🐛 If Bug Still Appears

1. **Clear browser cache** - Old JavaScript may be cached
2. **Hard refresh** - Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
3. **Check console** - Look for warnings about out-of-range completion values
4. **Verify files changed**:
   - `src/lib/display-utils.ts` - Should exist
   - `src/utils/diagnostic-engine.ts` - Check imports include `getFaceDisplayName`
   - `src/components/cxd/canvas/ai-chat-panel.tsx` - Check useEffect uses `formatCompletion`

---

## 📊 Expected Behavior for All Face Types

| Face Key | Display Name | Example Message |
|---|---|---|
| realityPlanes | Reality Planes | Reality Planes has structure defined... (43% complete) |
| sensoryDomains | Sensory Domains | Sensory Domains has structure defined... (60% complete) |
| presence | Presence Types | Presence Types has structure defined... (33% complete) |
| stateMapping | State Mapping | State Mapping has structure defined... (47% complete) |
| traitMapping | Trait Mapping | Trait Mapping has structure defined... (31% complete) |
| contextAndMeaning | Meaning Architecture | Meaning Architecture has structure defined... (70% complete) |

All should show:
- ✅ Proper capitalization
- ✅ Percentage format (not raw float)
- ✅ Natural language (not debug strings)

---

## 🎉 Success Criteria

The fix is working if:
- [x] No camelCase face keys visible to user
- [x] No raw float values (0.428571...) visible to user
- [x] No "Context:-" debug strings visible to user
- [x] Completion shown as percentage (43%)
- [x] Suggested questions appear below summary
- [x] Message reads naturally and professionally
