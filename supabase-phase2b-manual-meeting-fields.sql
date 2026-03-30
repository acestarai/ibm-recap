ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS meeting_start_at timestamptz,
ADD COLUMN IF NOT EXISTS organizer_name text,
ADD COLUMN IF NOT EXISTS attendee_summary text,
ADD COLUMN IF NOT EXISTS external_meeting_url text,
ADD COLUMN IF NOT EXISTS notes text;
