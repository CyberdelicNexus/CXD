# Coding Conventions

**Analysis Date:** 2026-03-18

## Naming Patterns

**Files:**
- Components: PascalCase with `.tsx` extension (e.g., `cxd-navbar.tsx`, `canvas-element.tsx`)
- Hooks: `use` prefix in camelCase (e.g., `use-collaboration.ts`, `use-ai-credits.ts`)
- Utilities/Libraries: camelCase with `.ts` extension (e.g., `utils.ts`, `encryption.ts`)
- Types: PascalCase in `types/` directory (e.g., `canvas-elements.ts`, `cxd-schema.ts`)
- API routes: kebab-case in `app/api/` structure (e.g., `create-checkout/route.ts`)
- Context files: `*-context.tsx` (e.g., `collaboration-context.tsx`)

**Functions:**
- Standard functions and utilities: camelCase (e.g., `extractCenterColor()`, `generateUserColor()`)
- React components: PascalCase function names (e.g., `CXDNavbar`, `CanvasElementRenderer`)
- Hook functions: `use` prefix + camelCase (e.g., `useCollaboration()`, `useAICredits()`)
- Utility factories: camelCase with descriptive names (e.g., `getSupabaseAdmin()`, `getModelConfig()`)

**Variables:**
- Constants: UPPER_SNAKE_CASE for magic numbers and global constants (e.g., `MAX_HISTORY_SIZE = 50`, `HYPERCUBE_DEFAULT_VIEWPORT`)
- State variables: camelCase (e.g., `collaborators`, `isConnected`, `currentUser`)
- Private variables/refs: camelCase with optional `_` prefix for truly private (e.g., `channelRef`, `cursorThrottleRef`)
- DOM/element IDs: camelCase or kebab-case in templates (e.g., `activeBoardId`, `canvas-id`)

**Types/Interfaces:**
- Type definitions: PascalCase (e.g., `CanvasElement`, `CollaboratorPresence`, `CXDProject`)
- Union types: PascalCase with descriptive names (e.g., `ViewMode = 'home' | 'wizard' | 'canvas'`)
- Config objects: UPPER_SNAKE_CASE or PascalCase depending on export style
- Discriminated unions: Use `type` field (e.g., `type: 'field_update' | 'element_add'`)

## Code Style

**Formatting:**
- Prettier 3.3.3 configured with default settings
- Line length: Standard Prettier default (80 chars)
- Indentation: 2 spaces
- Semicolons: Required (Prettier enforces)
- Quotes: Double quotes in imports, template literals for dynamic strings

**Linting:**
- No ESLint config detected - TypeScript strict mode enforces many checks
- TypeScript strict mode enabled in `tsconfig.json`
- Compiler options: `strict: true`, `forceConsistentCasingInFileNames: true`

**File Organization:**
- `"use client"` directive at top of client components (before imports)
- `export const dynamic = 'force-dynamic'` in API routes when needed (before imports)
- Imports organized in groups: external libs → relative imports → types

## Import Organization

**Order (enforced by observation):**
1. External packages (`react`, `next`, Radix UI, third-party libraries)
2. Zustand/state management (`@/store/*`)
3. Internal utilities (`@/lib/*`, `@/supabase/*`)
4. Components (`@/components/*`)
5. Hooks (`@/hooks/*`)
6. Types (can be mixed but often grouped with related imports using `import type`)
7. Context providers (`@/contexts/*`)

**Pattern Observed:**
```typescript
// React & Next imports
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// Zustand store
import { useCXDStore } from "@/store/cxd-store";

// Types
import type { CXDProject } from "@/types/cxd-schema";
import type { CanvasElement } from "@/types/canvas-elements";

// Utils & Libraries
import { extractCenterColor } from "@/lib/utils";
import { createClient } from "@/supabase/client";

// UI Components
import { Button } from "@/components/ui/button";

// Custom Components
import { CXDNavbar } from "@/components/cxd/cxd-navbar";

// Hooks
import { useCollaboration } from "@/hooks/use-collaboration";
```

**Path Aliases:**
- `@/*` → `./src/*` (main source alias)
- `@emails/*` → `./emails/*` (email templates)

## Error Handling

**Patterns:**
- Try-catch blocks used for async operations (132 occurrences across 64 files)
- Direct `console.error()` logging on catch (no structured error logging library)
- API routes return `NextResponse.json()` with `{ error: "message", status: number }`
- Graceful fallbacks with sensible defaults (e.g., `extractCenterColor()` returns `'#1a0b2e'` on parse failure)
- Validation errors caught and logged before sending 400/401 responses

**Error Response Pattern:**
```typescript
if (error) {
  console.error('Error context:', error);
  return NextResponse.json(
    { error: 'User-friendly message', projects: [] },
    { status: 500 }
  );
}
```

**Common Status Codes Used:**
- 400: Missing required fields, malformed requests
- 401: Authentication failed, unauthorized
- 500: Server errors, configuration issues

## Logging

**Framework:** `console` object directly (no logging library)

**Patterns:**
- `console.error()` for error cases with context (e.g., `console.error('Auth error:', authError)`)
- `console.log()` for debug traces with prefixes (e.g., `console.log('[YjsProject] Loaded persisted state')`)
- Prefix pattern: `[Component/Module Name]` for easy filtering (e.g., `[usePlanTasks]`, `[YjsProject]`)
- No structured logging - all messages are strings

**When to Log:**
- Error boundaries (all catch blocks log errors)
- Major state changes (project load, sync operations)
- Debug traces for complex operations (prefixed with module name in brackets)
- Database operation results when significant

## Comments

**When to Comment:**
- Complex algorithms or non-obvious logic
- Business logic tied to specific domain concepts (e.g., CXD Reality Planes)
- Important side effects or state mutations
- TODO/FIXME markers for incomplete work (observed in codebase)

**JSDoc/TSDoc:**
- Used selectively for public functions and utilities
- Example from `utils.ts`:
```typescript
/**
 * Creates a semi-transparent background color from a hex color
 * @param hexColor - Hex color string (e.g., "#1a0b2e")
 * @param opacity - Opacity value 0-1 (default 0.8)
 */
export function hexToRgba(hexColor: string, opacity: number = 0.8): string
```
- Configuration documentation uses block comments explaining design decisions
- Not required for every function, focused on complex/public APIs

## Function Design

**Size:** Functions typically 20-50 lines, with some components reaching 100+ lines due to render logic

**Parameters:**
- Named parameters preferred for functions with multiple options
- Options pattern used for hook configurations: `interface UseCollaborationOptions { onRemoteUpdate?: (update) => void }`
- Type annotations required for all parameters (TypeScript strict mode)

**Return Values:**
- Explicit return types on all exported functions
- React components return `JSX.Element` or `React.FC<Props>`
- Hooks return typed objects, arrays, or single values
- API routes return `NextResponse` or stream responses

**Async Patterns:**
- Heavy use of async/await
- Error handling with try-catch
- Supabase client calls are async
- Zustand actions can be synchronous or async

## Module Design

**Exports:**
- Named exports for utilities, functions, types
- Default exports for React components (both named and default observed)
- Type-only exports: `export type InterfaceName = { ... }`
- Re-exports pattern not heavily used

**Barrel Files:**
- Limited barrel file usage observed
- Direct path imports preferred (e.g., `@/hooks/use-collaboration` not via index)
- Exceptions: UI component barrel files (e.g., `@/components/ui/button`)

**Module Cohesion:**
- Utility modules focused on single concern (e.g., `utils.ts` for style utilities, `encryption.ts` for crypto)
- Hook modules wrap specific functionality (collaboration, AI credits, project sync)
- Store modules centralized in `@/store/cxd-store.ts`
- API routes closely mirror database schema structure

## React Conventions

**Component Declaration:**
- Functional components with `"use client"` directive at top
- Props typed with TypeScript interfaces
- Example:
```typescript
"use client";

import { FC } from "react";

interface CXDNavbarProps {
  projectId: string;
}

export const CXDNavbar: FC<CXDNavbarProps> = ({ projectId }) => {
  // Component body
};
```

**Hooks Usage:**
- `useState` for local component state
- `useEffect` for side effects with dependency arrays
- `useCallback` for memoized callbacks (critical for performance in canvas operations)
- `useRef` for DOM refs and mutable values
- `useMemo` for expensive computations with explicit dependencies
- Custom hooks for shared logic

**State Management:**
- Zustand store (`useCXDStore`) for global application state
- Context API for provider patterns (`YjsProjectProvider`, `CollaborationProvider`)
- Local state for UI-only concerns (modals, forms)

---

*Convention analysis: 2026-03-18*
