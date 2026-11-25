-- Separate confirmation-mail send timestamp from CASL consent timestamp so
-- cooldown enforcement does not overwrite consented_at or get extended by
-- suppressed/failed send attempts.

BEGIN;

ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS last_confirmation_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.newsletter_subscribers.last_confirmation_sent_at IS
  'Timestamp of the last successfully sent double-opt-in confirmation email (separate from CASL consented_at).';

COMMIT;
