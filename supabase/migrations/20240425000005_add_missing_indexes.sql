-- Indexes the access patterns in the codebase actually need.
-- Each one is justified by a specific query in the code (commented inline).
-- All guarded against missing tables/columns so older databases that lack
-- a feature migration won't fail this whole migration — they just skip
-- the index for the missing piece.

-- subscriptions.plan_id
-- Used by webhook lifetime founding-member count and can_add_collaborator() RPC.
DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id
      ON public.subscriptions(plan_id);
  ELSE
    RAISE NOTICE 'Skipping idx_subscriptions_plan_id — subscriptions table missing';
  END IF;
END $$;

-- subscriptions.free_primary_canvas_id
-- Used by canvas-permissions.ts resolveCanvasAccess (runs on every save).
-- Partial index — only non-null values matter.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'free_primary_canvas_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_subscriptions_free_primary
      ON public.subscriptions(free_primary_canvas_id)
      WHERE free_primary_canvas_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'Skipping idx_subscriptions_free_primary — column does not exist (free-primary-canvas migration not applied)';
  END IF;
END $$;

-- canvas_invitations(expires_at) WHERE status = 'pending'
-- Speeds up the RLS policy that filters (status='pending' AND expires_at > NOW()).
DO $$
BEGIN
  IF to_regclass('public.canvas_invitations') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_canvas_invitations_pending_expires
      ON public.canvas_invitations(expires_at)
      WHERE status = 'pending';
  ELSE
    RAISE NOTICE 'Skipping idx_canvas_invitations_pending_expires — table missing';
  END IF;
END $$;

-- notifications(user_id, created_at DESC) WHERE is_read = false
-- Hot query: "fetch my unread notifications, newest first."
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
      ON public.notifications(user_id, created_at DESC)
      WHERE is_read = false;
  ELSE
    RAISE NOTICE 'Skipping idx_notifications_user_unread — table missing';
  END IF;
END $$;

-- email_log(email_kind, sent_at DESC)
-- Cron email-scheduler scans by email_kind first; existing (user_id, email_kind)
-- index doesn't help that pattern.
DO $$
BEGIN
  IF to_regclass('public.email_log') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_email_log_kind_sent
      ON public.email_log(email_kind, sent_at DESC);
  ELSE
    RAISE NOTICE 'Skipping idx_email_log_kind_sent — table missing';
  END IF;
END $$;
