ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS archived_at timestamptz;
