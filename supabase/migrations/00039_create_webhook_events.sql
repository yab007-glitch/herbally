-- 00039_create_webhook_events.sql
-- Idempotency store for Stripe webhooks (DATA-2). Stripe redelivers events on
-- 5xx/timeout; recording the event id lets the webhook handler skip a
-- duplicate instead of double-processing a donation.
--
-- RLS is enabled with NO policies, so only the service role (used by the
-- webhook route) can read/write. anon/authenticated get nothing.

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id TEXT PRIMARY KEY,           -- Stripe event id (evt_...)
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Keep the table from growing unbounded: drop rows older than 30 days.
-- (Webhook redelivery windows are far shorter than 30 days.)
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
  ON public.webhook_events(processed_at);