CREATE TABLE IF NOT EXISTS public.microsoft_connections (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  microsoft_user_id text,
  tenant_id text,
  email text,
  display_name text,
  scopes text[] NOT NULL DEFAULT '{}',
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS microsoft_connections_email_idx
ON public.microsoft_connections(email);
