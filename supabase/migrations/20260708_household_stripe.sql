-- Adds Stripe subscription tracking columns to households.
-- Run once in the Supabase SQL Editor.

ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_households_stripe_customer
  ON public.households(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_households_stripe_subscription
  ON public.households(stripe_subscription_id);
