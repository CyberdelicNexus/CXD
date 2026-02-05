-- Combined handle_new_user function to manage both User Profile and Subscription assignment
-- This ensures that when a user signs up, they get both a profile and the correct plan.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  initial_plan plan_type := 'free';
BEGIN
  -- 1. Create the user record in public.users table
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.id::text, -- matches actions.ts
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- 2. Determine initial plan based on promo code
  -- This metadata is set during the signUp process in actions.ts
  IF (NEW.raw_user_meta_data->>'promo' = 'beta') THEN
    initial_plan := 'beta_tester';
  END IF;

  -- 3. Create the subscription record
  INSERT INTO public.subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, initial_plan, 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
