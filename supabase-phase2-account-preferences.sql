ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS default_transcript_type text NOT NULL DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS default_speaker_diarization boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS default_summary_type text NOT NULL DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS preferred_export_format text NOT NULL DEFAULT 'pdf';

ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_default_transcript_type_check;

ALTER TABLE public.users
ADD CONSTRAINT users_default_transcript_type_check
CHECK (default_transcript_type IN ('standard', 'custom'));

ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_default_summary_type_check;

ALTER TABLE public.users
ADD CONSTRAINT users_default_summary_type_check
CHECK (default_summary_type IN ('standard', 'structured'));

ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_preferred_export_format_check;

ALTER TABLE public.users
ADD CONSTRAINT users_preferred_export_format_check
CHECK (preferred_export_format IN ('pdf', 'markdown', 'text'));
