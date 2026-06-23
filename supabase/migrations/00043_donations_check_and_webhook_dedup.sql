-- 00043_donations_check_and_webhook_dedup.sql
-- H-1 + C-2 (audit 2026-06-22).
--
-- H-1: donations.status CHECK (00040) only allowed
--   ('pending','completed','failed','expired','refunded'), but the Stripe
--   webhook writes 'partially_refunded' (partial refunds) and 'disputed'
--   (chargebacks). Those updates always failed with a CHECK violation →
--   throw → 500 → Stripe retry → blocked by the dedup poison pill (C-2) →
--   status permanently stuck at 'completed'. Extend the CHECK.
--
-- C-2: the webhook recorded the event id in webhook_events BEFORE processing
--   and treated any existing row as "already handled". If processing threw on
--   the first delivery, the retry saw the dedup row and skipped — permanently
--   losing the donation. Add a `status` column ('processing'/'done'/'failed')
--   so a failed first attempt can be reprocessed on retry. Legacy rows
--   default to 'done' (preserves current skip behavior for already-handled
--   events). The matching code fix is in src/app/api/webhooks/stripe/route.ts.
--
-- Idempotent.

-- ── H-1: extend donations.status CHECK ──────────────────────────────────────
ALTER TABLE public.donations DROP CONSTRAINT IF EXISTS donations_status_check;
ALTER TABLE public.donations
  ADD CONSTRAINT donations_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'expired', 'refunded', 'partially_refunded', 'disputed'));

-- ── C-2: webhook_events.status for safe retry ───────────────────────────────
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'done'
  CHECK (status IN ('processing', 'done', 'failed'));

CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON public.webhook_events(status);