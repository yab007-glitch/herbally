-- 00053: implement the 30-day webhook_events retention that 00039 promised in
-- a comment but never wired up. (Audit L13.) Schedules a daily pg_cron job to
-- delete processed rows older than 30 days, so the table doesn't grow
-- unbounded with every Stripe event. Guarded: only schedules if pg_cron is
-- installed (Supabase enables it via the dashboard / CREATE EXTENSION pg_cron).
-- Idempotent: unschedules any prior same-named job first.

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('cleanup_webhook_events');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    PERFORM cron.schedule(
      'cleanup_webhook_events',
      '0 3 * * *',  -- daily at 03:00 UTC
      $sql$DELETE FROM public.webhook_events WHERE processed_at < now() - interval '30 days';$sql$
    );
    RAISE NOTICE 'Scheduled webhook_events cleanup job (daily 03:00 UTC, 30-day retention)';
  ELSE
    RAISE NOTICE 'pg_cron not installed; webhook_events cleanup not scheduled. Enable pg_cron to enable automatic retention.';
  END IF;
END $do$;