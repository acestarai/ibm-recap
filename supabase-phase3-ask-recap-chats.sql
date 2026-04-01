-- Phase 3 persistent Ask Recap chats

CREATE TABLE IF NOT EXISTS public.ask_recap_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Ask Recap chat',
  scope TEXT NOT NULL DEFAULT 'all',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ask_recap_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.ask_recap_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ask_recap_chats_user_id ON public.ask_recap_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_ask_recap_chats_updated_at ON public.ask_recap_chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ask_recap_messages_chat_id ON public.ask_recap_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_ask_recap_messages_user_id ON public.ask_recap_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ask_recap_messages_sort_order ON public.ask_recap_messages(chat_id, sort_order);

ALTER TABLE public.ask_recap_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ask_recap_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own Ask Recap chats" ON public.ask_recap_chats;
CREATE POLICY "Users can view own Ask Recap chats"
  ON public.ask_recap_chats
  FOR SELECT
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own Ask Recap chats" ON public.ask_recap_chats;
CREATE POLICY "Users can insert own Ask Recap chats"
  ON public.ask_recap_chats
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own Ask Recap chats" ON public.ask_recap_chats;
CREATE POLICY "Users can update own Ask Recap chats"
  ON public.ask_recap_chats
  FOR UPDATE
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete own Ask Recap chats" ON public.ask_recap_chats;
CREATE POLICY "Users can delete own Ask Recap chats"
  ON public.ask_recap_chats
  FOR DELETE
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can view own Ask Recap messages" ON public.ask_recap_messages;
CREATE POLICY "Users can view own Ask Recap messages"
  ON public.ask_recap_messages
  FOR SELECT
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own Ask Recap messages" ON public.ask_recap_messages;
CREATE POLICY "Users can insert own Ask Recap messages"
  ON public.ask_recap_messages
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own Ask Recap messages" ON public.ask_recap_messages;
CREATE POLICY "Users can update own Ask Recap messages"
  ON public.ask_recap_messages
  FOR UPDATE
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete own Ask Recap messages" ON public.ask_recap_messages;
CREATE POLICY "Users can delete own Ask Recap messages"
  ON public.ask_recap_messages
  FOR DELETE
  USING (auth.uid()::text = user_id::text);

GRANT ALL ON public.ask_recap_chats TO authenticated;
GRANT ALL ON public.ask_recap_chats TO service_role;
GRANT ALL ON public.ask_recap_messages TO authenticated;
GRANT ALL ON public.ask_recap_messages TO service_role;
