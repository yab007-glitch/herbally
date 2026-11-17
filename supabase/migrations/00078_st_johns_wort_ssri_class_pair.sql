-- 00078_st_johns_wort_ssri_class_pair.sql
-- The homepage's first "common check" is St. John's Wort + antidepressants, but
-- the herb stored only the four individual SSRIs (sertraline, fluoxetine,
-- paroxetine, citalopram), so the checker answered "no structured record
-- found" for the class it advertises. The rest of the corpus already carries
-- the class row "Antidepressants (SSRIs)" (Rhodiola); add the same row here,
-- sourced to NCCIH like the existing sertraline pairs.

INSERT INTO public.drug_interactions (
  herb_id,
  drug_name,
  severity,
  description,
  mechanism,
  evidence_level,
  source,
  source_url,
  translations
)
SELECT
  h.id,
  $SQLTXT$Antidepressants (SSRIs)$SQLTXT$,
  $SQLTXT$contraindicated$SQLTXT$::interaction_severity,
  $SQLTXT$St. John's Wort combined with SSRI antidepressants can cause serotonin syndrome, a potentially life-threatening reaction with agitation, confusion, rapid heart rate, high blood pressure, and hyperthermia. The combination should be avoided.$SQLTXT$,
  $SQLTXT$Both agents raise synaptic serotonin: St. John's Wort inhibits serotonin reuptake while SSRIs block it, and St. John's Wort also induces CYP3A4 and P-glycoprotein. The additive serotonergic effect can reach toxic levels.$SQLTXT$,
  $SQLTXT$well-documented$SQLTXT$,
  $SQLTXT$NCCIH$SQLTXT$,
  $SQLTXT$https://www.nccih.nih.gov/health/st-johns-wort$SQLTXT$,
  $SQLTXT${"fr": {"description": "L'association du millepertuis avec les antidépresseurs ISRS peut provoquer un syndrome sérotoninergique potentiellement mortel (agitation, confusion, tachycardie, hypertension, hyperthermie). Cette association doit être évitée.", "mechanism": "Les deux substances augmentent la sérotonine synaptique : le millepertuis inhibe la recapture de la sérotonine et induit le CYP3A4 et la P-glycoprotéine, tandis que les ISRS bloquent la recapture. L'effet sérotoninergique additif peut atteindre des niveaux toxiques."}}$SQLTXT$::jsonb
FROM public.herbs h
WHERE h.slug = $SQLTXT$st-johns-wort$SQLTXT$
AND NOT EXISTS (
  SELECT 1 FROM public.drug_interactions d
  WHERE d.herb_id = h.id
    AND lower(d.drug_name) = lower($SQLTXT$Antidepressants (SSRIs)$SQLTXT$)
);
