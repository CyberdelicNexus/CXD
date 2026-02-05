-- CLEANUP AND FIXING: Cascading Deletes
-- This script cleans up "ghost" users and establishes a strict 1:1 link with auth.users

-- 1. Remove "Ghost" rows from public.users that don't have a matching auth.user
-- This prevents the "Foreign Key Violation" error when we try to link them
DELETE FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- 2. Establish the cascading relationship on public.users
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_id_fkey,
DROP CONSTRAINT IF EXISTS users_user_id_fkey;

ALTER TABLE public.users
ADD CONSTRAINT users_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users (id)
ON DELETE CASCADE;

-- 3. Establish the cascading relationship on public.subscriptions
-- Delete orphan subscriptions first
DELETE FROM public.subscriptions
WHERE user_id NOT IN (SELECT id FROM auth.users);

ALTER TABLE public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users (id)
ON DELETE CASCADE;

-- 4. Set RLS Update policies (to ensure UI actions work)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
CREATE POLICY "Users can update own subscription" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);
