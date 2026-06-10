-- Add view_count to herbs table for popularity tracking and internal analytics
ALTER TABLE public.herbs ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0 NOT NULL;

-- Index for sorting herbs by popularity
CREATE INDEX IF NOT EXISTS idx_herbs_view_count ON public.herbs (view_count DESC);

-- Allow anon users to increment view counts
-- Used by the server-side view tracking on herb detail pages
CREATE OR REPLACE FUNCTION increment_herb_view(herb_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.herbs
  SET view_count = view_count + 1
  WHERE id = herb_id;
$$;
