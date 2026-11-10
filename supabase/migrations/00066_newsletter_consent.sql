-- Newsletter consent fields (CASL).
--
-- The table already exists from 00034 with (email, locale, subscribed,
-- confirmed_at). 00045 dropped its permissive INSERT policy because any anon
-- client could poison the list, and left a note: a subscribe feature must use
-- the service role. This migration adds only what that feature needs to be
-- legal, not a second table.
--
-- What CASL requires and where it lives:
--   express consent you can prove  -> consent_text + consented_at, stored verbatim
--   double opt-in                  -> status 'pending' until confirm_token is used
--   a working unsubscribe          -> unsubscribe_token, status 'unsubscribed'
--   not silently re-subscribing    -> an opt-out row is reset deliberately, with
--                                     a fresh consented_at, never flipped back

alter table public.newsletter_subscribers
  add column if not exists status text not null default 'pending',
  add column if not exists consent_text text,
  add column if not exists confirm_token uuid not null default gen_random_uuid(),
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid(),
  add column if not exists consented_at timestamptz not null default now(),
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists last_sent_at timestamptz,
  add column if not exists source_path text;

-- Backfill rows that predate the status column: an address confirmed under the
-- old flow stays confirmed; anything else is pending, not subscribed.
update public.newsletter_subscribers
set status = case
  when confirmed_at is not null then 'confirmed'
  when subscribed is false then 'unsubscribed'
  else 'pending'
end
where status is null or status = 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'newsletter_subscribers_status_check'
  ) then
    alter table public.newsletter_subscribers
      add constraint newsletter_subscribers_status_check
      check (status in ('pending', 'confirmed', 'unsubscribed'));
  end if;
end $$;

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status);

create unique index if not exists newsletter_subscribers_confirm_token_idx
  on public.newsletter_subscribers (confirm_token);

create unique index if not exists newsletter_subscribers_unsubscribe_token_idx
  on public.newsletter_subscribers (unsubscribe_token);

comment on column public.newsletter_subscribers.consent_text is
  'Exact wording the subscriber agreed to, captured at signup (CASL proof of consent).';
comment on column public.newsletter_subscribers.status is
  'pending = double opt-in not yet confirmed; confirmed = may be mailed; unsubscribed = do not mail.';
