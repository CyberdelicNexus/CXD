# Remove OpenAI Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all OpenAI model integrations from CXD, leaving only Google Gemini, Anthropic Claude, and Moonshot Kimi as AI providers.

**Architecture:** Surgically remove OpenAI references from the model config, provider registry, type system, UI components, API routes, and BYOK management. The Vercel AI SDK's `@ai-sdk/openai` package is still needed for Kimi (which uses an OpenAI-compatible API via NVIDIA), so we only remove direct OpenAI usage, not the SDK package itself.

**Tech Stack:** TypeScript, Next.js, Vercel AI SDK, Zustand

---

### Task 1: Remove OpenAI Models from Credit Config

**Files:**
- Modify: `src/lib/ai-credit-config.ts`

- [ ] **Step 1: Remove gpt-4o-mini model entry**

Remove lines 32-44 from `src/lib/ai-credit-config.ts`:

```typescript
// DELETE this entire block:
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    creditWeight: 1.5,
    pricing: {
      input: 0.15,
      output: 0.60,
    },
    contextWindow: 128_000,
    features: ['fast', 'smart', 'multimodal'],
    tier: 'budget',
  },
```

- [ ] **Step 2: Remove gpt-4o model entry**

Remove lines 71-83 from `src/lib/ai-credit-config.ts`:

```typescript
// DELETE this entire block:
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    creditWeight: 25,
    pricing: {
      input: 2.50,
      output: 10.00,
    },
    contextWindow: 128_000,
    features: ['smart', 'multimodal', 'vision'],
    tier: 'premium',
  },
```

- [ ] **Step 3: Remove gpt-4o-mini and gpt-4o from all tier allowedModels arrays**

In `TIER_CREDIT_ALLOWANCES`, remove `'gpt-4o-mini'` and `'gpt-4o'` from every `allowedModels` array:

```typescript
// In 'pro' tier (line ~145-154), change to:
    allowedModels: [
      'gemini-2.0-flash',
      'kimi',
      'claude-haiku-4.5',
      'gemini-2.5-pro',
      'claude-sonnet-4.5',
      'claude-opus-4.6',
    ] as ModelId[],

// In 'lifetime' tier (line ~160-169), change to:
    allowedModels: [
      'gemini-2.0-flash',
      'kimi',
      'claude-haiku-4.5',
      'gemini-2.5-pro',
      'claude-sonnet-4.5',
      'claude-opus-4.6',
    ] as ModelId[],

// In 'beta_tester' tier (line ~174-182), change to:
    allowedModels: [
      'gemini-2.0-flash',
      'kimi',
      'claude-haiku-4.5',
      'gemini-2.5-pro',
      'claude-sonnet-4.5',
    ] as ModelId[],
```

- [ ] **Step 4: Remove OpenAI pricing source comment**

Remove line 12 from the file header:

```typescript
// DELETE this line:
 * - OpenAI: https://openai.com/api/pricing/
```

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Errors in files that still reference `'gpt-4o'` or `'gpt-4o-mini'` — those will be fixed in subsequent tasks.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai-credit-config.ts
git commit -m "feat: remove OpenAI models from credit config"
```

---

### Task 2: Remove OpenAI from Provider Registry

**Files:**
- Modify: `src/lib/ai/provider-registry.ts`

- [ ] **Step 1: Remove OpenAI default import (keep createOpenAI for NVIDIA/Kimi)**

Change line 5 from:
```typescript
import { openai, createOpenAI } from "@ai-sdk/openai";
```
To:
```typescript
import { createOpenAI } from "@ai-sdk/openai";
```

- [ ] **Step 2: Remove GPT entries from MODEL_ID_MAP**

Remove lines 18-20:
```typescript
// DELETE these lines:
  // GPT - working
  'gpt-4o-mini': 'gpt-4o-mini',
  'gpt-4o': 'gpt-4o',
```

- [ ] **Step 3: Remove GPT config from MODEL_CONFIGS**

Remove the entire `gpt` block (lines 48-65):
```typescript
// DELETE this entire block:
  gpt: {
    chat: {
      provider: "gpt",
      tier: "chat",
      modelId: process.env.GPT_TIER1_MODEL || "gpt-4.1",
      displayName: "GPT-4.1",
      costMultiplier: 1.0,
      maxTokens: 4096,
    },
    analysis: {
      provider: "gpt",
      tier: "analysis",
      modelId: process.env.GPT_TIER2_MODEL || "gpt-4.1",
      displayName: "GPT-4.1",
      costMultiplier: 2.0,
      maxTokens: 8192,
    },
  },
```

- [ ] **Step 4: Remove GPT case from getModelInstance switch**

Remove lines 143-148:
```typescript
// DELETE this case:
    case "gpt":
      if (customApiKey) {
        const customOpenAI = createOpenAI({ apiKey: customApiKey });
        return customOpenAI(config.modelId);
      }
      return openai(config.modelId);
```

- [ ] **Step 5: Remove GPT branch from getModelInstanceByModelId**

Remove lines 187-192:
```typescript
// DELETE this block:
  if (modelId.startsWith('gpt-')) {
    if (customApiKey) {
      const customOpenAI = createOpenAI({ apiKey: customApiKey });
      return customOpenAI(apiModelId);
    }
    return openai(apiModelId);
  } else if (modelId.startsWith('claude-')) {
```

Replace with:
```typescript
  if (modelId.startsWith('claude-')) {
```

- [ ] **Step 6: Remove GPT from PROVIDER_INFO**

Remove line 223:
```typescript
// DELETE this line:
  gpt: { name: "GPT", icon: "openai" },
```

- [ ] **Step 7: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Errors in type definitions and UI components referencing `'gpt'`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/provider-registry.ts
git commit -m "feat: remove OpenAI from provider registry"
```

---

### Task 3: Remove OpenAI from Type Definitions

**Files:**
- Modify: `src/types/ai-types.ts`

- [ ] **Step 1: Remove 'gpt' from AIProviderKey**

Change line 128 from:
```typescript
export type AIProviderKey = 'gpt' | 'claude' | 'gemini' | 'kimi';
```
To:
```typescript
export type AIProviderKey = 'claude' | 'gemini' | 'kimi';
```

- [ ] **Step 2: Remove gpt from CREDIT_COSTS**

Change lines 168-173 from:
```typescript
export const CREDIT_COSTS: Record<CreditAction, Record<AIProviderKey, number>> = {
  chat: { gpt: 1, claude: 2, gemini: 1, kimi: 1 },
  suggestion: { gpt: 1, claude: 2, gemini: 1, kimi: 1 },
  analyze: { gpt: 5, claude: 8, gemini: 4, kimi: 5 },
  erd: { gpt: 15, claude: 20, gemini: 12, kimi: 15 },
};
```
To:
```typescript
export const CREDIT_COSTS: Record<CreditAction, Record<AIProviderKey, number>> = {
  chat: { claude: 2, gemini: 1, kimi: 1 },
  suggestion: { claude: 2, gemini: 1, kimi: 1 },
  analyze: { claude: 8, gemini: 4, kimi: 5 },
  erd: { claude: 20, gemini: 12, kimi: 15 },
};
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Type errors will surface in any file still referencing `'gpt'` as an AIProviderKey.

- [ ] **Step 4: Commit**

```bash
git add src/types/ai-types.ts
git commit -m "feat: remove gpt from AI type definitions"
```

---

### Task 4: Remove OpenAI from UI Components

**Files:**
- Modify: `src/components/cxd/ai-model-selector.tsx`
- Modify: `src/components/settings/api-key-manager.tsx`

- [ ] **Step 1: Remove OpenAI models from ai-model-selector.tsx**

Search for any hardcoded references to `gpt-4o`, `gpt-4o-mini`, or `openai` in `src/components/cxd/ai-model-selector.tsx` and remove them. The component dynamically reads from `AI_MODELS`, so if the config was cleaned up in Task 1, the models will already be gone from the dropdown. Check for any provider-specific icons or labels referencing OpenAI/GPT.

- [ ] **Step 2: Remove OpenAI from api-key-manager.tsx**

In `src/components/settings/api-key-manager.tsx`, remove the OpenAI API key input section. The component currently shows Anthropic and OpenAI key fields. Remove:
- The OpenAI key state variable
- The OpenAI input field and label
- The link to OpenAI's API key management page
- Any OpenAI-specific validation or save logic

Keep the Anthropic key field intact.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: PASS (no errors)

- [ ] **Step 4: Commit**

```bash
git add src/components/cxd/ai-model-selector.tsx src/components/settings/api-key-manager.tsx
git commit -m "feat: remove OpenAI from UI model selector and API key manager"
```

---

### Task 5: Remove OpenAI from API Routes

**Files:**
- Modify: `src/app/api/ai/chat/route.ts`
- Modify: `src/app/api/ai/byok/route.ts`
- Modify: `src/app/api/ai/analyze/route.ts` (if it references OpenAI)

- [ ] **Step 1: Remove OpenAI BYOK provider mapping from chat route**

In `src/app/api/ai/chat/route.ts`, find the provider mapping that maps `gpt` to `openai` for BYOK key lookup and remove it. The chat route uses `getModelInstanceByModelId` which was already cleaned in Task 2.

- [ ] **Step 2: Remove OpenAI key validation from byok route**

In `src/app/api/ai/byok/route.ts`, remove the `openai` case from `validateAPIKeyFormat()`. This function validates API key formats per provider. Remove:
```typescript
// DELETE the openai validation case
case 'openai':
  // whatever validation exists for OpenAI keys
```

- [ ] **Step 3: Check analyze route**

Read `src/app/api/ai/analyze/route.ts` and remove any OpenAI-specific references if present.

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ai/chat/route.ts src/app/api/ai/byok/route.ts src/app/api/ai/analyze/route.ts
git commit -m "feat: remove OpenAI from API routes"
```

---

### Task 6: Clean Up Environment Variables and Final Sweep

**Files:**
- Modify: `.env.example` or `.env.local.example` (if they exist)
- Check: `package.json` for direct `openai` dependency

- [ ] **Step 1: Search entire codebase for remaining OpenAI references**

Run: `grep -ri "openai\|gpt-4\|gpt-3\|GPT_TIER" src/ --include="*.ts" --include="*.tsx" -l`
Expected: No matches (or only `@ai-sdk/openai` imports in provider-registry.ts for Kimi)

- [ ] **Step 2: Remove OPENAI_API_KEY from env examples**

Search for and remove `OPENAI_API_KEY` from any `.env.example`, `.env.local.example`, or documentation files.

- [ ] **Step 3: Remove GPT_TIER env references**

Search for and remove `GPT_TIER1_MODEL` and `GPT_TIER2_MODEL` from any env files.

- [ ] **Step 4: Check package.json**

Run: `grep "openai" package.json`
Note: The `@ai-sdk/openai` package must stay because Kimi uses `createOpenAI` with the NVIDIA base URL. Only remove a direct `openai` package if it exists separately.

- [ ] **Step 5: Run full build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: clean up remaining OpenAI references and env vars"
```
