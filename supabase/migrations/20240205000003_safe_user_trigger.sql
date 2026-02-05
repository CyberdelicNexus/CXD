-- Ultra-safe handle_new_user function that won't block signup even if profile creation fails
-- This prevents the "Database error saving new user" error in Supabase Auth

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  initial_plan_id public.plan_type := 'free';
BEGIN
  -- 1. Create the user record in public.users table
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
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
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
    -- Log error or just continue to not block auth
    RAISE WARNING 'Error in handle_new_user creating public.users record: %', SQLERRM;
  END;

  -- 2. Determine initial plan based on promo code
  IF (NEW.raw_user_meta_data->>'promo' = 'beta') THEN
    initial_plan_id := 'beta_tester';
  END IF;

  -- 3. Create the subscription record
  BEGIN
    INSERT INTO public.subscriptions (user_id, plan_id, status)
    VALUES (NEW.id, initial_plan_id, 'active')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log error or just continue to not block auth
    RAISE WARNING 'Error in handle_new_user creating public.subscriptions record: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
