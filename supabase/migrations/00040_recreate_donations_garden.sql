-- 00040_recreate_donations_garden.sql
-- DATA-3 (audit 2026-06-19): the donations and garden_herbs tables are
-- referenced by app code (api/webhooks/stripe, api/garden, donate page) but
-- are ABSENT from production (migrations 00026/00027 are recorded as applied
-- yet the tables are missing — the migration history is out of sync with the
-- live schema). Decision: RECREATE them in prod with owner-scoped RLS rather
-- than the permissive USING(true) WITH CHECK(true) policies from 00026/00027,
-- which let anon/authenticated SELECT every row (donations leak customer_email/
-- customer_name; garden_herbs leaked other users' saved herbs).
--
-- Access model:
--   * donations are written ONLY by the Stripe webhook, which uses the service
--     role (createAdminClient) — service role bypasses RLS, so no write policy is
--     needed. RLS is ENABLED with a single admin-SELECT policy so anon/
--     authenticated get nothing and only admins can read.
--   * garden_herbs: authenticated users read/write their own rows via the
--     server client (RLS-enforced, auth.uid() = user_id). Guests go through
--     the service role (createAdminClient) in api/garden, which bypasses RLS,
--     so no guest policy is required. The old "Service role full access"
--     USING(true) policy is intentionally NOT recreated.
--
-- webhook_events is handled by 00039 (pending) and is not duplicated here.
-- All statements are idempotent so this is safe to re-run.

-- ============================================================================
-- donations
-- ============================================================================
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
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_donations_stripe_session
  ON public.donations(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_donations_status
  ON public.donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_created_at
  ON public.donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_customer_email
  ON public.donations(customer_email)
  WHERE customer_email IS NOT NULL;

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Drop the leaky legacy policy if a prior partial apply left it behind.
DROP POLICY IF EXISTS "Service role can manage donations" ON public.donations;
DROP POLICY IF EXISTS "Admins can view donations" ON public.donations;
CREATE POLICY "Admins can view donations"
  ON public.donations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.update_donation_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_donations_updated_at ON public.donations;
CREATE TRIGGER trg_donations_updated_at
  BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.update_donation_updated_at();

-- ============================================================================
-- garden_herbs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.garden_herbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id TEXT,
  herb_slug TEXT NOT NULL,
  herb_name TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  image_url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each (user OR guest) can only save a herb once
  CONSTRAINT garden_herbs_unique_user_herb
    UNIQUE NULLS NOT DISTINCT (user_id, herb_slug),

  CONSTRAINT garden_herbs_unique_guest_herb
    UNIQUE NULLS NOT DISTINCT (guest_id, herb_slug),

  -- Must have either user_id or guest_id
  CONSTRAINT garden_herbs_must_have_owner
    CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_garden_herbs_user_id
  ON public.garden_herbs(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_garden_herbs_guest_id
  ON public.garden_herbs(guest_id)
  WHERE guest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_garden_herbs_created_at
  ON public.garden_herbs(created_at DESC);

ALTER TABLE public.garden_herbs ENABLE ROW LEVEL SECURITY;

-- Drop the leaky legacy policy if a prior partial apply left it behind.
DROP POLICY IF EXISTS "Service role full access" ON public.garden_herbs;
DROP POLICY IF EXISTS "Users can manage own garden" ON public.garden_herbs;
-- Owner-scoped: authenticated users manage only their own rows. Guests go
-- through the service role (api/garden), which bypasses RLS.
CREATE POLICY "Users can manage own garden"
  ON public.garden_herbs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_garden_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_garden_herbs_updated_at ON public.garden_herbs;
CREATE TRIGGER trg_garden_herbs_updated_at
  BEFORE UPDATE ON public.garden_herbs
  FOR EACH ROW EXECUTE FUNCTION public.update_garden_updated_at();