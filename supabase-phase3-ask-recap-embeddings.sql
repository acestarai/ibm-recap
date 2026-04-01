-- Phase 3 foundation: Ask Recap chunk embeddings for vector retrieval

CREATE TABLE IF NOT EXISTS public.ask_recap_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('transcript', 'summary')),
  meeting_title TEXT,
  document_label TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  page_number INTEGER,
  chunk_text TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  embedding DOUBLE PRECISION[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ask_recap_chunks_user_id ON public.ask_recap_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_ask_recap_chunks_file_id ON public.ask_recap_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_ask_recap_chunks_meeting_id ON public.ask_recap_chunks(meeting_id);

ALTER TABLE public.ask_recap_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own Ask Recap chunks" ON public.ask_recap_chunks;
CREATE POLICY "Users can view own Ask Recap chunks"
  ON public.ask_recap_chunks
  FOR SELECT
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own Ask Recap chunks" ON public.ask_recap_chunks;
CREATE POLICY "Users can insert own Ask Recap chunks"
  ON public.ask_recap_chunks
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own Ask Recap chunks" ON public.ask_recap_chunks;
CREATE POLICY "Users can update own Ask Recap chunks"
  ON public.ask_recap_chunks
  FOR UPDATE
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete own Ask Recap chunks" ON public.ask_recap_chunks;
CREATE POLICY "Users can delete own Ask Recap chunks"
  ON public.ask_recap_chunks
  FOR DELETE
  USING (auth.uid()::text = user_id::text);

GRANT ALL ON public.ask_recap_chunks TO authenticated;
GRANT ALL ON public.ask_recap_chunks TO service_role;
