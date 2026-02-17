# Feature Gating Implementation Guide

This guide shows how to implement the membership-based feature gating system across your app.

## 1. Navbar Integration

Add the membership badge and trial countdown to your navbar:

```tsx
// src/components/cxd/cxd-navbar.tsx
import { MembershipBadge, TrialCountdownBanner } from '@/components/nav/membership-badge';

export function CXDNavbar() {
  return (
    <>
      <TrialCountdownBanner />
      <nav className="...">
        {/* Your existing nav items */}

        {/* Add membership badge */}
        <MembershipBadge showCredits showTrial />
      </nav>
    </>
  );
}
```

## 2. Plan View Gate

Gate access to the Plan view:

```tsx
// In your view mode switcher (e.g., cxd-navbar.tsx or canvas view controls)
import { useFeatureAccess } from '@/hooks/use-feature-access';
import { UpgradeModal } from '@/components/modals/upgrade-modal';
import { useState } from 'react';

export function ViewModeSwitcher() {
  const { canAccessPlanView } = useFeatureAccess();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [blockedFeature, setBlockedFeature] = useState<'plan-view' | null>(null);
  const setCanvasViewMode = useCXDStore(state => state.setCanvasViewMode);

  const handleSwitchToPlanView = () => {
    if (!canAccessPlanView) {
      setBlockedFeature('plan-view');
      setShowUpgradeModal(true);
      return;
    }

    setCanvasViewMode('plan');
  };

  return (
    <>
      <button
        onClick={handleSwitchToPlanView}
        className="..."
      >
        {!canAccessPlanView && <Lock className="w-3 h-3" />}
        Plan View
      </button>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={blockedFeature || 'plan-view'}
      />
    </>
  );
}
```

## 3. Task Creation Gate

Gate the "Add Task" button in the AI chatbot:

```tsx
// src/components/cxd/canvas/ai-action-bar.tsx
import { useFeatureAccess } from '@/hooks/use-feature-access';
import { Lock } from 'lucide-react';

export function AIActionBar({ extractedTasks, ... }: AIActionBarProps) {
  const { canCreateTasks } = useFeatureAccess();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleAddTask = () => {
    if (!canCreateTasks) {
      setBlockedFeature('tasks');
      setShowUpgradeModal(true);
      return;
    }

    // Proceed with task creation
    createTasksFromAI(...);
  };

  return (
    <>
      <button
        onClick={handleAddTask}
        disabled={!canCreateTasks}
        className={cn(
          "relative ...",
          !canCreateTasks && "opacity-60 cursor-not-allowed"
        )}
      >
        {!canCreateTasks && (
          <Lock className="absolute -top-1 -right-1 w-3 h-3 text-orange-400" />
        )}
        Add {extractedTasks.length} Task{extractedTasks.length !== 1 ? 's' : ''}
      </button>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="tasks"
      />
    </>
  );
}
```

## 4. Task Card Gate

Prevent task cards from being created by free users:

```tsx
// src/components/cxd/canvas/canvas-element.tsx
import { useFeatureAccess } from '@/hooks/use-feature-access';

export function CanvasElement({ element, ... }: CanvasElementProps) {
  const { canCreateTasks } = useFeatureAccess();

  // If it's a task card and user can't create tasks, show upgrade overlay
  const isTaskCard = element.type === 'freeform' && element.cardType === 'task';

  if (isTaskCard && !canCreateTasks) {
    return (
      <div className="relative">
        {/* Render the card but blurred */}
        <div className="filter blur-sm opacity-50 pointer-events-none">
          {/* Your normal card rendering */}
        </div>

        {/* Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg border border-orange-500/50">
          <button
            onClick={() => {/* Show upgrade modal */}}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium"
          >
            <Lock className="w-4 h-4 inline mr-2" />
            Upgrade to Use Tasks
          </button>
        </div>
      </div>
    );
  }

  // Normal rendering for accessible cards
  return <div>{/* Your normal card rendering */}</div>;
}
```

## 5. AI Model Selection

Filter available AI models based on tier:

```tsx
// In your AI chat component
import { useFeatureAccess } from '@/hooks/use-feature-access';

export function AIChatInterface() {
  const { availableAiModels, canUsePremiumModels, usesOwnApiKey } = useFeatureAccess();

  const modelOptions = [
    {
      id: 'kimi-2.5',
      name: 'Kimi 2.5',
      speed: 'Slower',
      quality: 'Good',
      cost: 'Free',
      available: true, // Always available
    },
    {
      id: 'claude-haiku',
      name: 'Claude Haiku',
      speed: 'Fast',
      quality: 'Good',
      cost: usesOwnApiKey ? 'Your API' : '1 credit',
      available: canUsePremiumModels,
      locked: !canUsePremiumModels,
    },
    {
      id: 'claude-sonnet-4',
      name: 'Claude Sonnet 4',
      speed: 'Fast',
      quality: 'Excellent',
      cost: usesOwnApiKey ? 'Your API' : '3 credits',
      available: canUsePremiumModels,
      locked: !canUsePremiumModels,
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      speed: 'Fast',
      quality: 'Excellent',
      cost: usesOwnApiKey ? 'Your API' : '2 credits',
      available: canUsePremiumModels,
      locked: !canUsePremiumModels,
    },
  ].filter(model => availableAiModels.includes(model.id));

  return (
    <select>
      {modelOptions.map(model => (
        <option
          key={model.id}
          value={model.id}
          disabled={model.locked}
        >
          {model.name} - {model.cost}
          {model.locked && ' 🔒'}
        </option>
      ))}
    </select>
  );
}
```

## 6. Canvas Limit Gate

Prevent creating more canvases when limit is reached:

```tsx
// In your canvas creation flow
import { useFeatureAccess } from '@/hooks/use-feature-access';

export function CreateCanvasButton() {
  const { canCreateCanvas, maxCanvases, tier } = useFeatureAccess();
  const projects = useCXDStore(state => state.projects);
  const currentCanvasCount = projects.length;

  const handleCreateCanvas = () => {
    if (!canCreateCanvas(currentCanvasCount)) {
      setBlockedFeature('canvases');
      setShowUpgradeModal(true);
      return;
    }

    // Proceed with canvas creation
    createNewCanvas();
  };

  return (
    <button onClick={handleCreateCanvas}>
      Create New Canvas
      {tier === 'free' && (
        <span className="text-xs opacity-70">
          ({currentCanvasCount}/{maxCanvases})
        </span>
      )}
    </button>
  );
}
```

## 7. API Key Management (Lifetime Only)

Add API key settings to user settings page:

```tsx
// src/app/settings/page.tsx
import { useFeatureAccess } from '@/hooks/use-feature-access';
import { ApiKeyManager } from '@/components/settings/api-key-manager';

export default function SettingsPage() {
  const { isLifetimeMember } = useFeatureAccess();

  const handleSaveApiKeys = async (keys: Record<string, string>) => {
    // Call your API to save encrypted keys
    const response = await fetch('/api/user/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });

    if (!response.ok) throw new Error('Failed to save API keys');
  };

  return (
    <div>
      <h1>Settings</h1>

      {/* Other settings */}

      {/* API Key Management - Lifetime only */}
      {isLifetimeMember && (
        <section>
          <h2>API Keys (Lifetime Feature)</h2>
          <ApiKeyManager onSave={handleSaveApiKeys} />
        </section>
      )}
    </div>
  );
}
```

## 8. Backend Integration

### Check membership on API routes:

```typescript
// src/lib/membership.ts
import { auth, currentUser } from '@clerk/nextjs/server';

export async function getUserMembership() {
  const user = await currentUser();
  if (!user) throw new Error('Unauthorized');

  const metadata = user.publicMetadata as {
    tier?: MembershipTier;
    aiCreditsBalance?: number;
    hasConfiguredApiKey?: boolean;
  };

  return {
    userId: user.id,
    tier: metadata.tier || 'free',
    aiCreditsBalance: metadata.aiCreditsBalance || 0,
    hasConfiguredApiKey: metadata.hasConfiguredApiKey || false,
  };
}

export async function deductCredits(userId: string, amount: number) {
  // Call your API to deduct credits
  // This should also check if user has enough credits
}
```

### Use in API routes:

```typescript
// src/app/api/ai/chat/route.ts
import { getUserMembership, deductCredits } from '@/lib/membership';

export async function POST(req: Request) {
  const membership = await getUserMembership();
  const { model } = await req.json();

  // Check if user can use this model
  const modelCosts = {
    'kimi-2.5': 0,
    'claude-haiku': 1,
    'gpt-4-turbo': 2,
    'claude-sonnet-4': 3,
  };

  const cost = modelCosts[model] || 0;

  // If using own API key (lifetime), skip credit check
  if (membership.tier === 'lifetime' && membership.hasConfiguredApiKey) {
    // Use their API key
    return callAIWithUserKey(membership.userId, model, ...);
  }

  // Check credits
  if (cost > 0 && membership.aiCreditsBalance < cost) {
    return Response.json(
      { error: 'Insufficient credits' },
      { status: 402 }
    );
  }

  // Deduct credits
  if (cost > 0) {
    await deductCredits(membership.userId, cost);
  }

  // Make AI call
  return callAI(model, ...);
}
```

## Summary

**Feature Gates Implemented:**
1. ✅ Plan View - Pro/Trial/Lifetime only
2. ✅ Task Creation - Pro/Trial/Lifetime only
3. ✅ Task Cards - Pro/Trial/Lifetime only
4. ✅ Premium AI Models - Pro/Trial/Lifetime only
5. ✅ Canvas Limits - Free: 3, Pro+: Unlimited
6. ✅ Smart Templates - Pro/Trial/Lifetime only
7. ✅ Team Collaboration - Pro: 3 slots, Lifetime: 5 slots
8. ✅ BYOK - Lifetime only

**Next Steps:**
1. Add membership data to Clerk user metadata
2. Implement credit deduction in AI API routes
3. Add BYOK logic for Lifetime members
4. Set up trial expiration cron job
5. Create pricing page with Stripe integration
6. Test upgrade flows
