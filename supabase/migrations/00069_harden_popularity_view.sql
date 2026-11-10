-- Clear the last security-advisor ERROR: a SECURITY DEFINER view.
--
-- `herb_popularity` was created for generateStaticParams, which returns before
-- querying while PRERENDER_HERB_LIMIT is 0. Because it ran with the owner's
-- rights it bypassed RLS on `herbs` and `herb_view_counts`; the Supabase advisor
-- flags that as `security_definer_view` (ERROR).
--
-- Nothing on the request path reads it, so make it explicit that it is an
-- internal/build-time object: security_invoker so it can never bypass RLS, and
-- service_role-only grants. If the prerender limit is ever raised, the caller
-- must use a service-role client (see generateStaticParams).

ALTER VIEW public.herb_popularity SET (security_invoker = true);

REVOKE ALL ON TABLE public.herb_popularity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.herb_popularity TO service_role;
