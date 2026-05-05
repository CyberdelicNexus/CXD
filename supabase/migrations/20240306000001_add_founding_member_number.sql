-- Add founding_member_number column to subscriptions table for lifetime members
-- Only the first 250 lifetime members get a founding member number

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS founding_member_number INTEGER;

-- Create unique index to ensure no duplicate founding member numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_founding_member_number
  ON public.subscriptions(founding_member_number)
  WHERE founding_member_number IS NOT NULL;

-- Add check constraint to ensure founding member numbers are 1-250
ALTER TABLE public.subscriptions
ADD CONSTRAINT chk_founding_member_number_range
CHECK (founding_member_number IS NULL OR (founding_member_number >= 1 AND founding_member_number <= 250));

COMMENT ON COLUMN public.subscriptions.founding_member_number IS 'Founding member number (1-250) for lifetime tier members';
