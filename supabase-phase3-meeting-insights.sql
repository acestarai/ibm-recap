-- Phase 3 structured meeting insights for Ask Recap

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

CREATE TABLE IF NOT EXISTS public.meeting_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  meeting_title TEXT,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('action_item', 'open_question', 'risk_blocker', 'decision', 'discussion_point')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_insights_user_id ON public.meeting_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_insights_meeting_id ON public.meeting_insights(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_insights_type ON public.meeting_insights(insight_type);

ALTER TABLE public.meeting_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own meeting insights" ON public.meeting_insights;
CREATE POLICY "Users can view own meeting insights"
  ON public.meeting_insights
  FOR SELECT
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own meeting insights" ON public.meeting_insights;
CREATE POLICY "Users can insert own meeting insights"
  ON public.meeting_insights
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own meeting insights" ON public.meeting_insights;
CREATE POLICY "Users can update own meeting insights"
  ON public.meeting_insights
  FOR UPDATE
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete own meeting insights" ON public.meeting_insights;
CREATE POLICY "Users can delete own meeting insights"
  ON public.meeting_insights
  FOR DELETE
  USING (auth.uid()::text = user_id::text);

GRANT ALL ON public.meeting_insights TO authenticated;
GRANT ALL ON public.meeting_insights TO service_role;
