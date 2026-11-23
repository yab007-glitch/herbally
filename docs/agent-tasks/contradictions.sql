COPY (
with base as (
  select h.*,
    coalesce(array_to_string(h.contraindications,' | '),'') as contra_txt,
    coalesce(array_to_string(h.side_effects,' | '),'') as side_txt,
    coalesce(h.dosage_adult,'') as dose_txt,
    coalesce(h.description,'') as desc_txt,
    coalesce(h.translations->'fr'->>'name','') as fr_name,
    coalesce(h.translations->'fr'->>'description','') as fr_desc,
    coalesce(jsonb_array_length(coalesce(h.citations,'[]'::jsonb)),0) as cite_count
  from herbs h where h.is_published
)
select slug, name, view_count, evidence_level, cite_count,
  (pregnancy_safe is true and contra_txt ~* 'pregnan|grossesse') as r_preg_contra,
  (nursing_safe is true and contra_txt ~* 'nurs|allait|breastfeed') as r_nurse_contra,
  (pregnancy_safe is true and (side_txt ~* 'abort|miscarr' or contra_txt ~* 'abort|miscarr')) as r_preg_abort,
  (dose_txt ~* 'oral|tea|tincture|extract|capsule|powder|decoction' and contra_txt ~* 'not for internal|internal use') as r_oral_but_internal_contra,
  (dosage_child is not null and btrim(dosage_child)<>'' and contra_txt ~* 'children|pediatric|paediatric') as r_child_dose_vs_contra,
  (evidence_level='A' and cite_count<3) as r_evid_a_thin,
  (evidence_level='A' and cite_count=0) as r_evid_a_none,
  (cite_count=0) as r_no_citations,
  (side_txt ~* 'generally safe|well tolerated|no side effects' ) as r_vague_safety,
  ((desc_txt ~* 'toxic' or side_txt ~* 'toxic') and btrim(contra_txt)='') as r_toxic_no_contra,
  (coalesce(array_length(contraindications,1),0) <> coalesce((select count(distinct x) from unnest(contraindications) x),0)) as r_dup_contra,
  (desc_txt ~* 'records no specific indication|no data available|none documented') as r_placeholder,
  (fr_name = name) as r_fr_name_eq_en,
  (fr_desc ~* '\b(the|and|with|from|this|that)\b') as r_english_in_fr_desc,
  (image_url is null) as r_no_image,
  (image_url is not null and (coalesce(provenance->'image'->>'licence','')='' or coalesce(provenance->'image'->>'credit','')='')) as r_image_no_licence,
  (dosage_adult is not null and btrim(dosage_adult)<>'' and dosage_adult !~ '[0-9]') as r_dose_nonnumeric,
  (dosage_adult is null or btrim(dosage_adult)='') as r_no_dose,
  (contraindications='{}') as r_no_contra,
  (side_effects='{}') as r_no_side,
  (coalesce(provenance->>'verification_method','(none)') in ('unverified','(none)')) as r_prov_unverified,
  exists (select 1 from unnest(contraindications) c where c ~* '^none|no known') as r_no_known_claim
from base
order by view_count desc, slug
) TO STDOUT WITH CSV HEADER
