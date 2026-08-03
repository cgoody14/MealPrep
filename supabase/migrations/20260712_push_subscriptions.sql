-- ============================================================
-- Web Push subscriptions for household notifications
-- Run this once in the Supabase SQL Editor.
--
-- Each row is one browser/device push endpoint for a user. The
-- notify-household edge function reads other members' rows (via the
-- service role) to send pushes; users only manage their own rows.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users manage only their own subscriptions.
DROP POLICY IF EXISTS "push_select_own" ON public.push_subscriptions;
CREATE POLICY "push_select_own" ON public.push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_insert_own" ON public.push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_delete_own" ON public.push_subscriptions
  FOR DELETE USING (user_id = auth.uid());
