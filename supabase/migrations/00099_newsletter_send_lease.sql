-- Atomic per-address resend lease for double-opt-in confirmation emails.
-- Acquired before SMTP send, released on send failure, cleared when
-- last_confirmation_sent_at is stamped, and safely self-expiring after a
-- worker crash or post-send stamp failure.

BEGIN;

ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS confirmation_send_lease_until TIMESTAMPTZ;

COMMENT ON COLUMN public.newsletter_subscribers.confirmation_send_lease_until IS
  'Short-lived atomic send lease preventing duplicate confirmation emails on concurrent submits, crashes, or post-send stamp failures.';

COMMIT;
