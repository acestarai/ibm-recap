ALTER TABLE public.meetings
DROP CONSTRAINT IF EXISTS meetings_source_type_check;

ALTER TABLE public.meetings
ADD CONSTRAINT meetings_source_type_check
CHECK (source_type IN ('upload', 'teams', 'manual'));

ALTER TABLE public.files
DROP CONSTRAINT IF EXISTS files_source_type_check;

ALTER TABLE public.files
ADD CONSTRAINT files_source_type_check
CHECK (source_type IN ('upload', 'teams', 'manual'));
