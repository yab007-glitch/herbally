-- Create donations table for tracking Stripe donations
-- Replaces the in-memory donationLog used in the webhook handler.

CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  amount_display TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  customer_email TEXT,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'expired', 'refunded')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_donations_stripe_session
  ON public.donations(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_donations_status
  ON public.donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_created_at
  ON public.donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_customer_email
  ON public.donations(customer_email)
  WHERE customer_email IS NOT NULL;

-- RLS: only service role can insert/update; admins can read
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage donations"
  ON public.donations FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view donations"
  ON public.donations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_donation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_donations_updated_at ON public.donations;
CREATE TRIGGER trg_donations_updated_at
  BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.update_donation_updated_at();
