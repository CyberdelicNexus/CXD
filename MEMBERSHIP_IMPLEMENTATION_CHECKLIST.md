# Membership System Implementation Checklist

## ✅ COMPLETED

### 1. Core Components Created
- ✅ `use-feature-access.ts` - Feature access hook with Supabase
- ✅ `membership-badge.tsx` - Tier badges, credits display, trial countdown
- ✅ `upgrade-modal.tsx` - Feature-specific upgrade prompts
- ✅ `api-key-manager.tsx` - BYOK management for Lifetime members
- ✅ Navbar integration with Plan View gating
- ✅ Database migration SQL file
- ✅ Stripe webhook handler
- ✅ Updated UserProfile interface

### 2. Feature Gates Implemented
- ✅ Plan View - Locked for free users with upgrade modal
- ✅ Membership badge showing tier, credits, trial countdown
- ✅ Trial countdown banner (appears 7 days before expiration)

## 📋 TODO - Complete These Steps

### Step 1: Database Setup (REQUIRED FIRST)

Run the migration in your Supabase SQL editor:

```bash
# File: supabase/migrations/add_membership_fields.sql
```

This adds:
- `membership_tier` column (free/pro/trial/lifetime)
- `trial_end_date` column
- `founding_member_number` column (1-250 for lifetime)
- `has_configured_api_key` column
- `ai_credits_balance` column
- `stripe_customer_id` column
- `stripe_subscription_id` column
- Helper functions: `grant_trial()`, `upgrade_to_pro()`, `upgrade_to_lifetime()`, `deduct_ai_credits()`, `add_ai_credits()`, `downgrade_expired_trials()`

### Step 2: Environment Variables

Add to `.env.local`:

```env
# Stripe (you likely have these already)
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (from your Stripe dashboard)
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO=price_...
NEXT_PUBLIC_STRIPE_PRICE_ID_LIFETIME=price_...
NEXT_PUBLIC_STRIPE_PRICE_ID_CREDITS_100=price_...
NEXT_PUBLIC_STRIPE_PRICE_ID_CREDITS_500=price_...
```

### Step 3: Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `invoice.payment_failed`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### Step 4: Create Supabase Server Client Helper

The webhook needs a server-side Supabase client. Create:

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}
```

### Step 5: Test Free Tier User

1. Create a test user
2. Verify they see:
   - Locked Plan View with 🔒 icon
   - No membership badge
   - Upgrade modal when clicking Plan View

### Step 6: Test Pro Tier User

Manually update a test user in Supabase:

```sql
UPDATE users
SET
  membership_tier = 'pro',
  ai_credits_balance = 100
WHERE email = 'test@example.com';
```

Verify they see:
- Unlocked Plan View
- Purple Pro badge with credits
- No trial countdown

### Step 7: Test Trial User

Manually set up a trial:

```sql
SELECT grant_trial('user-uuid-here');
```

Verify they see:
- Unlocked Plan View
- Blue Trial badge with "Xd left"
- Trial countdown banner (if <7 days)
- 200 credits

### Step 8: Test Lifetime User

Manually upgrade to lifetime:

```sql
SELECT upgrade_to_lifetime(
  'user-uuid-here'::uuid,
  'cus_test123',
  1  -- Founding member #1
);
```

Verify they see:
- Unlocked Plan View
- Golden Lifetime badge with "#1"
- "BYOK" or "Using Own Keys" (when configured)
- No credit display

## 🎯 NEXT FEATURES TO IMPLEMENT

### Priority 1: Task Creation Gating

Gate the "Add Task" button in AI chat:

```tsx
// In ai-action-bar.tsx
const { canCreateTasks } = useFeatureAccess();
const [showUpgradeModal, setShowUpgradeModal] = useState(false);

const handleAddTasks = () => {
  if (!canCreateTasks) {
    setBlockedFeature('tasks');
    setShowUpgradeModal(true);
    return;
  }
  // Proceed with task creation
};
```

### Priority 2: Task Card Gating

Blur/lock task cards for free users:

```tsx
// In canvas-element.tsx
const { canCreateTasks } = useFeatureAccess();
const isTaskCard = element.type === 'freeform' && element.cardType === 'task';

if (isTaskCard && !canCreateTasks) {
  return (
    <div className="relative">
      <div className="filter blur-sm opacity-50 pointer-events-none">
        {/* Normal card */}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
        <button onClick={() => setShowUpgradeModal(true)}>
          🔒 Upgrade to Use Tasks
        </button>
      </div>
    </div>
  );
}
```

### Priority 3: AI Model Selection

Add model selector in chat with free/premium tiers:

```tsx
// In chat component
const { availableAiModels, canUsePremiumModels } = useFeatureAccess();

const models = [
  { id: 'kimi-2.5', name: 'Kimi 2.5 (Free)', tier: 'free' },
  { id: 'claude-haiku', name: 'Claude Haiku (1 credit)', tier: 'pro' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4 (3 credits)', tier: 'pro' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (2 credits)', tier: 'pro' },
];

const filteredModels = models.filter(m =>
  availableAiModels.includes(m.id)
);
```

### Priority 4: Credit Deduction in AI Routes

Add credit checking/deduction in AI API routes:

```typescript
// In src/app/api/ai/chat/route.ts
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return new Response('Unauthorized', { status: 401 });

  const { model } = await req.json();

  const modelCosts = {
    'kimi-2.5': 0,
    'claude-haiku': 1,
    'gpt-4-turbo': 2,
    'claude-sonnet-4': 3,
  };

  const cost = modelCosts[model] || 0;

  // Check if user has BYOK configured (lifetime)
  const { data: profile } = await supabase
    .from('users')
    .select('membership_tier, has_configured_api_key, ai_credits_balance')
    .eq('id', user.id)
    .single();

  // Lifetime with BYOK - use their API key
  if (profile?.membership_tier === 'lifetime' && profile?.has_configured_api_key) {
    // Use user's API key from encrypted storage
    return callAIWithUserKey(user.id, model, ...);
  }

  // Check credits
  if (cost > 0 && (profile?.ai_credits_balance || 0) < cost) {
    return new Response(
      JSON.stringify({ error: 'Insufficient credits' }),
      { status: 402 }
    );
  }

  // Deduct credits
  if (cost > 0) {
    await supabase.rpc('deduct_ai_credits', {
      user_id: user.id,
      amount: cost,
    });
  }

  // Make AI call
  return callAI(model, ...);
}
```

### Priority 5: Cron Job for Trial Expiration

Set up a daily cron job (Vercel Cron or similar):

```typescript
// src/app/api/cron/downgrade-trials/route.ts
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  // Verify cron secret
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient();
  const { data } = await supabase.rpc('downgrade_expired_trials');

  return Response.json({ downgraded: data });
}
```

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/downgrade-trials",
    "schedule": "0 0 * * *"
  }]
}
```

## 🧪 Testing Checklist

- [ ] Free user sees locked Plan View
- [ ] Free user gets upgrade modal on Plan View click
- [ ] Pro user sees Plan View and can access it
- [ ] Pro user sees credits badge
- [ ] Trial user sees countdown badge
- [ ] Trial banner appears at 7 days or less
- [ ] Trial banner urgent at 3 days or less
- [ ] Lifetime user sees golden badge
- [ ] Lifetime user sees founding member number
- [ ] Stripe webhook upgrades users correctly
- [ ] Credit top-up works via Stripe
- [ ] Trial auto-downgrades after expiration

## 📚 Additional Resources

- **Feature Gating Guide**: `FEATURE_GATING_GUIDE.md`
- **Database Migration**: `supabase/migrations/add_membership_fields.sql`
- **Stripe Webhook**: `src/app/api/webhooks/stripe/route.ts`

## 🎉 What You Have

- Complete membership system architecture
- Supabase + Stripe integration
- 4 tiers: Free, Pro ($29/mo), Trial (14 days), Lifetime ($499 one-time)
- Lifetime: Limited to 250 seats, BYOK enabled
- Feature gating system
- Credit management system
- Trial auto-downgrade system
- Stripe webhook for automatic tier updates

## Next Steps

1. Run database migration
2. Set up environment variables
3. Configure Stripe webhook
4. Test each tier
5. Implement remaining feature gates (tasks, AI models)
6. Deploy and test in production!
