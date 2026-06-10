-- Create web_vitals table for Core Web Vitals monitoring
-- This table stores real user metrics collected from the browser

CREATE TABLE IF NOT EXISTS public.web_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  value REAL NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('good', 'needs-improvement', 'poor')),
  pathname TEXT NOT NULL,
  device_type TEXT DEFAULT 'unknown',
  device_memory INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_web_vitals_metric_name ON public.web_vitals(metric_name);
CREATE INDEX IF NOT EXISTS idx_web_vitals_pathname ON public.web_vitals(pathname);
CREATE INDEX IF NOT EXISTS idx_web_vitals_recorded_at ON public.web_vitals(recorded_at DESC);

-- Allow anonymous inserts (the endpoint validates data before insertion)
ALTER TABLE public.web_vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts on web_vitals"
  ON public.web_vitals FOR INSERT
  TO anon
  WITH CHECK (true);

-- No read policy needed — data is consumed via Supabase Dashboard SQL queries
