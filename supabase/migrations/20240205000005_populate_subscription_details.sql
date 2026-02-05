-- Comprehensive fix for Beta Tester population and RLS permissions
-- This ensures user_name and user_email are populated in subscriptions
-- and that users have permission to update their own profiles/subscriptions

-- 1. Ensure columns exist in subscriptions (just in case they were added manually)
-- If they don't exist, this will add them safely.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'user_name') THEN
        ALTER TABLE public.subscriptions ADD COLUMN user_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'user_email') THEN
        ALTER TABLE public.subscriptions ADD COLUMN user_email TEXT;
    END IF;
END $$;

-- 2. Update handle_new_user to populate these columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  initial_plan_id public.plan_type := 'free';
  full_name_val TEXT;
BEGIN
  full_name_val := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  -- 1. Create/Update the user record in public.users table
  BEGIN
    INSERT INTO public.users (
      id,
      user_id,
      email,
      name,
      full_name,
      avatar_url,
      token_identifier,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.id::text,
      NEW.email,
      full_name_val,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.id::text,
      NOW(),
      NOW()
    ) ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      full_name = EXCLUDED.full_name,
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user creating public.users record: %', SQLERRM;
  END;

  -- 2. Determine initial plan based on promo code
  IF (NEW.raw_user_meta_data->>'promo' = 'beta') THEN
    initial_plan_id := 'beta_tester';
  END IF;

  -- 3. Create/Update the subscription record with user details
  BEGIN
    INSERT INTO public.subscriptions (user_id, plan_id, status, user_name, user_email)
    VALUES (NEW.id, initial_plan_id, 'active', full_name_val, NEW.email)
    ON CONFLICT (user_id) DO UPDATE SET
      plan_id = EXCLUDED.plan_id,
      user_name = EXCLUDED.user_name,
      user_email = EXCLUDED.user_email,
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user creating public.subscriptions record: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. CRITICAL: Add UPDATE policies so server actions can work as the user
-- For users table
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- For subscriptions table (to allow cancellation/downgrade)
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
CREATE POLICY "Users can update own subscription" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. Fix up existing records
UPDATE public.subscriptions s
SET 
  user_name = u.name,
  user_email = u.email
FROM public.users u
WHERE s.user_id = u.id
  AND (s.user_name IS NULL OR s.user_email IS NULL);
