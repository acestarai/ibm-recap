-- Phase 2A foundation: meeting-centric records and durable processing statuses

CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  original_filename TEXT,
  source_type TEXT NOT NULL DEFAULT 'upload' CHECK (source_type IN ('upload', 'teams')),
  processing_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (
    processing_status IN (
      'uploaded',
      'converting',
      'ready_for_transcription',
      'transcribing',
      'transcript_ready',
      'summarizing',
      'completed',
      'failed'
    )
  ),
  processing_error TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON public.meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON public.meetings(processing_status);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON public.meetings(created_at DESC);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own meetings" ON public.meetings;
CREATE POLICY "Users can view own meetings"
  ON public.meetings
  FOR SELECT
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own meetings" ON public.meetings;
CREATE POLICY "Users can insert own meetings"
  ON public.meetings
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own meetings" ON public.meetings;
CREATE POLICY "Users can update own meetings"
  ON public.meetings
  FOR UPDATE
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete own meetings" ON public.meetings;
CREATE POLICY "Users can delete own meetings"
  ON public.meetings
  FOR DELETE
  USING (auth.uid()::text = user_id::text);

GRANT ALL ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'upload' CHECK (source_type IN ('upload', 'teams')),
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'uploaded' CHECK (
    processing_status IN (
      'uploaded',
      'converting',
      'ready_for_transcription',
      'transcribing',
      'transcript_ready',
      'summarizing',
      'completed',
      'failed'
    )
  ),
  ADD COLUMN IF NOT EXISTS processing_error TEXT;

CREATE INDEX IF NOT EXISTS idx_files_meeting_id ON public.files(meeting_id);
CREATE INDEX IF NOT EXISTS idx_files_processing_status ON public.files(processing_status);

UPDATE public.files
SET
  source_type = COALESCE(source_type, 'upload'),
  processing_status = COALESCE(
    processing_status,
    CASE
      WHEN file_type = 'summary' OR has_summary THEN 'completed'
      WHEN file_type = 'transcript' OR has_transcript THEN 'transcript_ready'
      ELSE 'uploaded'
    END
  );
