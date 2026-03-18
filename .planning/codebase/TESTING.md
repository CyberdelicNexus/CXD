# Testing Patterns

**Analysis Date:** 2026-03-18

## Test Framework

**Runner:**
- Node.js built-in `node:test` module (no external test framework required for basic tests)
- Jest for more comprehensive test suites (@jest/globals for expect assertions)
- Assertion libraries: `node:assert/strict` and Jest's `expect()`

**Config:**
- No Jest config file detected
- No Vitest config detected
- Tests run via `node --test` for simple cases or Jest when `@jest/globals` is imported

**Run Commands:**
```bash
npm test                    # Not defined in package.json - would need to be added
node --test src/**/*.test.ts # Manual test execution with Node
npm run build               # Only build script defined (no explicit test script)
```

**Note:** No test runner is currently configured in `package.json`. Testing appears ad-hoc.

## Test File Organization

**Location:**
- Co-located with source code in same directory
- `__tests__/` subdirectories for grouped tests (observed in `src/lib/ai/__tests__/`)

**Naming:**
- `.test.ts` suffix for test files (e.g., `card-type-utils.test.ts`)
- Alternative: `__tests__` directory pattern (e.g., `ai-response-classifier.test.ts` in `__tests__/`)

**Structure:**
```
src/
├── components/
│   └── cxd/
│       └── canvas/
│           ├── canvas-element.tsx
│           └── card-type-utils.test.ts          # Co-located test
├── lib/
│   └── ai/
│       ├── ai-response-classifier.ts
│       └── __tests__/
│           └── ai-response-classifier.test.ts   # Grouped in subdirectory
└── utils/
    ├── diagnostic-engine.ts
    └── __tests__/
        └── diagnostic-chat-handoff.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe('Feature Name', () => {
  describe('Sub-feature or scenario', () => {
    it('should do specific behavior', () => {
      // Test implementation
    });

    it('should handle edge case', () => {
      // Test implementation
    });
  });
});
```

**Patterns Observed:**

### Using Node.js Test Module:
```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("card type guards", () => {
  it("returns task type for actionable cards", () => {
    const task = baseFreeform({ taskMetadata: { isActionable: true } });
    assert.equal(getFreeformCardType(task), "task");
  });

  it("prevents resize updates for task cards", () => {
    const task = baseFreeform({ cardType: "task" });
    assert.equal(canResizeFreeformCard(task), false);
    assert.deepEqual(
      sanitizeFreeformResizeUpdate(task, { width: 900, height: 600 }),
      { x: 40 }
    );
  });
});
```

### Using Jest:
```typescript
import { describe, it, expect } from '@jest/globals';
import { classifyResponse } from '../ai-response-classifier';

describe('AI Response Classifier', () => {
  describe('Task Detection', () => {
    it('should extract tasks from numbered lists', () => {
      const response = '1. Add VR headset\n2. Create sensory palette';
      const result = classifyResponse(response);

      expect(result.type).toBe('tasks');
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].title).toContain('Add VR headset');
    });
  });
});
```

**Setup/Teardown:**
- No global setup files detected
- Factory functions used for test data (e.g., `baseFreeform()` creates base element)
- Minimal teardown needs (mostly pure functions)

## Mocking

**Framework:**
- Jest's built-in mocking for `@jest/globals` tests
- No mocking library for Node.js `node:test` module tests

**Patterns Observed:**

### Factory Functions for Test Data:
```typescript
function baseFreeform(partial: Partial<FreeformElement>): FreeformElement {
  return {
    id: "card-1",
    type: "freeform",
    x: 0,
    y: 0,
    width: 300,
    height: 180,
    zIndex: 1,
    content: "",
    ...partial,
  };
}

// Usage in tests
const task = baseFreeform({ taskMetadata: { isActionable: true } });
const note = baseFreeform({ cardType: "note" });
```

### Minimal Project Factory:
```typescript
const createMinimalProject = (overrides: Partial<CXDProject> = {}): CXDProject => ({
  id: 'test-project',
  name: 'Test Project',
  description: '',
  canvasBackground: '',
  wizardCompleted: false,
  // ... more fields
  ...overrides,
} as CXDProject);
```

**What to Mock:**
- Complex objects (projects, elements) created with factory functions
- API responses when testing business logic (not currently mocked in observed tests)
- External service calls in integration tests

**What NOT to Mock:**
- Pure utility functions - test directly
- Type validation logic - test with real types
- Domain classification logic (e.g., AI response classifier) - test with realistic inputs

## Fixtures and Factories

**Test Data:**
- Factory functions return realistic test objects with full type safety
- Example pattern:
```typescript
interface UseCollaborationOptions {
  onRemoteUpdate?: (update: CanvasUpdate) => void;
  onCollaboratorJoin?: (collaborator: CollaboratorPresence) => void;
}
```

**Location:**
- Defined inline in test files (no separate fixtures directory)
- Reusable factories defined at top of test file
- Per-test overrides via object spread

## Coverage

**Requirements:** No coverage requirements enforced

**View Coverage:**
```bash
# Not configured - would need to be added to package.json
node --test --coverage
```

**Current State:** Minimal test coverage - only 3 test files found:
- `card-type-utils.test.ts` - Type guard and utility tests
- `ai-response-classifier.test.ts` - AI classification logic (comprehensive - 97+ test cases)
- `diagnostic-chat-handoff.test.ts` - Diagnostic formatting and display

## Test Types

**Unit Tests:**
- Scope: Individual functions, utilities, type guards
- Approach: Pure function testing with realistic inputs
- Example: `getFreeformCardType()` tested with various element states
- File: `src/components/cxd/canvas/card-type-utils.test.ts`

**Integration Tests:**
- Scope: Not extensively used - only basic integration of classifiers
- Approach: Would test how modules interact (e.g., AI classifier → task creation)
- Not currently implemented

**E2E Tests:**
- Framework: Not used
- Approach: Not applicable (Next.js app would use Playwright/Cypress)
- Note: Mobile notice redirect would be good candidate (`src/app/cxd/page.tsx` line 50-59)

## Test Examples

### Basic Unit Test (Node.js):
```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCenterColor } from "@/lib/utils";

describe("extractCenterColor", () => {
  it("extracts center color from radial gradient", () => {
    const gradient = "radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)";
    const result = extractCenterColor(gradient);
    assert.equal(result, "#1a0b2e");
  });

  it("returns solid color as-is", () => {
    const result = extractCenterColor("#1a0b2e");
    assert.equal(result, "#1a0b2e");
  });

  it("returns fallback for invalid input", () => {
    const result = extractCenterColor("invalid");
    assert.equal(result, "#1a0b2e");
  });
});
```

### Comprehensive Classification Test (Jest):
```typescript
describe('AI Response Classifier', () => {
  it('should classify as tasks_and_note when both present', () => {
    const response = `Your current State Mapping shows a good arc.

However, transitions need more definition.

## Recommendations
1. Define breathwork patterns for state transitions
2. Add somatic anchoring techniques

These additions will make induction more reliable.`;

    const result = classifyResponse(response);

    expect(result.type).toBe('tasks_and_note');
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.noteContent.length).toBeGreaterThan(0);
  });

  it('should detect multiple faces in task content', () => {
    const response = `1. Add VR headset support and haptic feedback`;
    const result = classifyResponse(response, {
      sourceFaces: ['presence'],
    });

    expect(result.sourceFaces).toContain('presence');
    expect(result.sourceFaces).toContain('realityPlanes'); // VR keyword
    expect(result.sourceFaces).toContain('sensoryDomains'); // haptic keyword
  });
});
```

### Async Error Handling (current pattern in components):
```typescript
// From use-collaboration.ts
useEffect(() => {
  async function getUser() {
    const { data: { user } } = await supabaseRef.current.auth.getUser();
    if (user) {
      setCurrentUser({
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || user.email?.split('@')[0],
      });
    }
  }
  getUser();
}, []);
```

## Assertion Patterns

**Node.js Assert:**
- `assert.equal(actual, expected)` - Strict equality
- `assert.deepEqual(actual, expected)` - Deep object equality
- `assert.match(string, regex)` - String pattern matching

**Jest Expect:**
- `expect(value).toBe(expected)` - Strict equality
- `expect(value).toEqual(expected)` - Deep equality
- `expect(array).toHaveLength(n)` - Array length
- `expect(string).toContain(substring)` - String inclusion
- `expect(string).toMatch(regex)` - Regex matching
- `expect(value).toBeGreaterThan(n)` - Numeric comparison
- `expect(string).not.toMatch(regex)` - Negative matches

## Gap Areas

**Not Tested:**
- Hooks (useCollaboration, useAICredits) - no hook tests found
- React components - no component snapshot or render tests
- API routes - no request/response testing
- Zustand store actions - no store tests
- Async operations - minimal async testing (only function classification)
- Error boundaries - no error scenario tests

**Recommendation Areas for Future Testing:**
- Canvas element mutations (high complexity, high impact)
- Real-time collaboration updates (critical for feature)
- API endpoint request/response validation
- Zustand store state transitions
- Hook lifecycle and cleanup

---

*Testing analysis: 2026-03-18*
