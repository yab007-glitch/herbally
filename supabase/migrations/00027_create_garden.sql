-- Create garden_herbs table for server-persisted user gardens.
-- Supports both authenticated users (via user_id) and anonymous guests
-- (via guest_id), mirroring the chat_sessions pattern.

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_garden_herbs_user_id
  ON public.garden_herbs(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_garden_herbs_guest_id
  ON public.garden_herbs(guest_id)
  WHERE guest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_garden_herbs_created_at
  ON public.garden_herbs(created_at DESC);

-- RLS
ALTER TABLE public.garden_herbs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage their own garden
CREATE POLICY "Users can manage own garden"
  ON public.garden_herbs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role bypass for guest operations (API uses service role key)
CREATE POLICY "Service role full access"
  ON public.garden_herbs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_garden_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_garden_herbs_updated_at ON public.garden_herbs;
CREATE TRIGGER trg_garden_herbs_updated_at
  BEFORE UPDATE ON public.garden_herbs
  FOR EACH ROW EXECUTE FUNCTION public.update_garden_updated_at();
