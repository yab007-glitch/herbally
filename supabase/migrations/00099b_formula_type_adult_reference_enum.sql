-- 00099b_formula_type_adult_reference_enum.sql
-- Add 'adult_reference' to public.formula_type in its own committed statement
-- BEFORE 00100 references the new enum value inside a BEGIN; ... COMMIT; block.
-- Keeps 00100 compatible with both psql and single-transaction migration runners.

ALTER TYPE public.formula_type ADD VALUE IF NOT EXISTS 'adult_reference';
