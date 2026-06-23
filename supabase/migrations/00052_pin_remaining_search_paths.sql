-- 00052: pin search_path on the remaining SECURITY INVOKER functions that the
-- earlier hardening migrations missed. (Audit DB-4, DB-5, and the open
-- search_path follow-up.) All are INVOKER (so search_path hijack only
-- escalates to the invoker's privileges, not the owner's), but pinning is the
-- established project pattern (see 00038/00040/00046/00047) and removes the
-- residual operator/function-resolution hijack surface. Idempotent.

ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_monograph_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_herb_faqs_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.search_herbs_by_symptom(text) SET search_path = public, pg_temp;