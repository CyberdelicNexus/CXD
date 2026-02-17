# Step-by-Step Migration Guide

## ⚠️ IMPORTANT: You Have Existing Subscriptions Table

Since you already have a subscriptions database, we'll integrate the membership system carefully without breaking your existing setup.

## 🗄️ Database Migration Steps

### Step 1: Run ONLY the Column Additions First

Go to your Supabase SQL Editor and run **ONLY THIS PART**:

```sql
-- Add membership columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS membership_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS founding_member_number INTEGER,
ADD COLUMN IF NOT EXISTS has_configured_api_key BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_credits_balance INTEGER DEFAULT 0;

-- Add constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_membership_tier_check'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_membership_tier_check
        CHECK (membership_tier IN ('free', 'pro', 'trial', 'lifetime'));
    END IF;
END $$;

-- Add stripe columns if they don't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Add timestamps
ALTER TABLE users
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
```

✅ **Verify**: Check that the columns were added successfully.

### Step 2: Add Indexes

```sql
-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_membership_tier ON users(membership_tier);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
```

### Step 3: Create Update Trigger

```sql
-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Step 4: Drop OLD Functions (If They Exist)

```sql
-- Drop any existing functions with old signatures
DROP FUNCTION IF EXISTS grant_trial(UUID);
DROP FUNCTION IF EXISTS upgrade_to_pro(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS upgrade_to_lifetime(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS deduct_ai_credits(UUID, INTEGER);
DROP FUNCTION IF EXISTS add_ai_credits(UUID, INTEGER);
DROP FUNCTION IF EXISTS downgrade_expired_trials();
```

### Step 5: Create NEW Helper Functions

```sql
-- Grant trial (14 days)
CREATE FUNCTION grant_trial(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET
        membership_tier = 'trial',
        trial_end_date = NOW() + INTERVAL '14 days',
        ai_credits_balance = COALESCE(ai_credits_balance, 0) + 200
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Upgrade to pro
CREATE FUNCTION upgrade_to_pro(
    p_user_id UUID,
    p_stripe_cust_id TEXT,
    p_stripe_sub_id TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET
        membership_tier = 'pro',
        stripe_customer_id = p_stripe_cust_id,
        stripe_subscription_id = p_stripe_sub_id,
        trial_end_date = NULL,
        ai_credits_balance = COALESCE(ai_credits_balance, 0) + 100
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Upgrade to lifetime
CREATE FUNCTION upgrade_to_lifetime(
    p_user_id UUID,
    p_stripe_cust_id TEXT,
    p_founding_number INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET
        membership_tier = 'lifetime',
        stripe_customer_id = p_stripe_cust_id,
        founding_member_number = p_founding_number,
        trial_end_date = NULL
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deduct AI credits
CREATE FUNCTION deduct_ai_credits(
    p_user_id UUID,
    p_amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance INTEGER;
BEGIN
    SELECT COALESCE(ai_credits_balance, 0) INTO v_current_balance
    FROM users
    WHERE id = p_user_id;

    IF v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    UPDATE users
    SET ai_credits_balance = ai_credits_balance - p_amount
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add AI credits
CREATE FUNCTION add_ai_credits(
    p_user_id UUID,
    p_amount INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET ai_credits_balance = COALESCE(ai_credits_balance, 0) + p_amount
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Downgrade expired trials
CREATE FUNCTION downgrade_expired_trials()
RETURNS INTEGER AS $$
DECLARE
    v_affected_rows INTEGER;
BEGIN
    UPDATE users
    SET
        membership_tier = 'free',
        trial_end_date = NULL
    WHERE
        membership_tier = 'trial'
        AND trial_end_date < NOW();

    GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
    RETURN v_affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 6: Grant Permissions

```sql
-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION grant_trial TO authenticated;
GRANT EXECUTE ON FUNCTION upgrade_to_pro TO authenticated;
GRANT EXECUTE ON FUNCTION upgrade_to_lifetime TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_ai_credits TO authenticated;
GRANT EXECUTE ON FUNCTION add_ai_credits TO authenticated;
```

### Step 7: Verify Migration

Run this to check everything:

```sql
-- Check columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN (
    'membership_tier',
    'trial_end_date',
    'founding_member_number',
    'has_configured_api_key',
    'ai_credits_balance',
    'stripe_customer_id',
    'stripe_subscription_id'
);

-- Check functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
    'grant_trial',
    'upgrade_to_pro',
    'upgrade_to_lifetime',
    'deduct_ai_credits',
    'add_ai_credits',
    'downgrade_expired_trials'
);
```

## ✅ Expected Results

You should see:
- 7 new columns in users table
- 6 new functions created
- All functions with correct signatures

## 🧪 Test the Setup

### Test 1: Grant Trial to Yourself

```sql
-- Replace with your actual user ID
SELECT grant_trial('your-user-id-uuid-here');

-- Verify
SELECT id, email, membership_tier, trial_end_date, ai_credits_balance
FROM users
WHERE id = 'your-user-id-uuid-here';
```

You should see:
- `membership_tier`: 'trial'
- `trial_end_date`: 14 days from now
- `ai_credits_balance`: 200

### Test 2: Check in Your App

1. Refresh your app: `http://localhost:3000`
2. You should see:
   - Blue "Trial" badge in navbar
   - "Xd left" countdown
   - Plan View is unlocked ✅

## 🔗 Existing Subscriptions Integration

Since you already have a subscriptions table, you have two options:

### Option A: Keep Both Systems (Recommended)

- Keep your existing `subscriptions` table for Stripe subscription tracking
- Use the new `users.membership_tier` for feature access
- Sync between them via the webhook

### Option B: Migrate to Users Table Only

- Move subscription status to `users` table
- Deprecate old `subscriptions` table gradually

**I recommend Option A** to avoid breaking your existing setup.

## 📝 Next: Configure Stripe Webhook

Once migration is complete, configure your Stripe webhook to point to:

```
https://your-domain.com/api/webhooks/stripe
```

Select events:
- ✅ `checkout.session.completed`
- ✅ `customer.subscription.deleted`
- ✅ `payment_intent.succeeded`

## 🚨 Troubleshooting

**Error: "function already exists"**
- Run Step 4 first to drop old functions

**Error: "column already exists"**
- That's OK! The `IF NOT EXISTS` handles this

**Error: "parameter name mismatch"**
- Make sure you dropped the old functions first (Step 4)

**Nothing showing in app**
- Make sure you granted trial to your user (Test 1)
- Check browser console for errors
- Verify Supabase connection

## ✅ Success Checklist

- [ ] Columns added to users table
- [ ] Functions created successfully
- [ ] Trial granted to test user
- [ ] App shows Trial badge
- [ ] Plan View unlocked
- [ ] No console errors

Once all checkboxes are ✅, you're ready for production!
