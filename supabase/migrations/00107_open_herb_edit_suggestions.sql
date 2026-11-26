-- 00107_open_herb_edit_suggestions.sql
-- Open LinkedIn-validated herb & content edit suggestions to any signed-in
-- LinkedIn user: relax optional clinician/rationale columns to nullable, add
-- community_user and researcher_educator to professional_role, and keep
-- service-role RLS + no_phi_attested = true intact.

BEGIN;

ALTER TABLE public.clinical_edit_requests
  ALTER COLUMN linkedin_profile_url DROP NOT NULL,
  ALTER COLUMN credentials DROP NOT NULL,
  ALTER COLUMN conflict_of_interest DROP NOT NULL,
  ALTER COLUMN clinical_rationale DROP NOT NULL;

DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.clinical_edit_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%professional_role%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.clinical_edit_requests DROP CONSTRAINT %I',
      v_con.conname
    );
  END LOOP;
END
$$;

ALTER TABLE public.clinical_edit_requests
  ADD CONSTRAINT clinical_edit_requests_professional_role_check CHECK (
    professional_role IN (
      'community_user',
      'researcher_educator',
      'pharmacist',
      'physician',
      'nurse_practitioner_rn',
      'naturopathic_doctor',
      'clinical_pharmacologist',
      'medical_lab_technologist',
      'registered_dietitian',
      'clinical_herbalist',
      'other_clinician'
    )
  );

ALTER TABLE public.clinical_edit_requests
  ALTER COLUMN professional_role SET DEFAULT 'community_user';

COMMIT;
