-- Migration 00091: Follow-up cleanup for Batch 25c (`modern_uses`, FR `traditional_uses`,
-- and `herb_pubmed_monographs` bibliography padding / PMID typo) after live check.

BEGIN;

-- =====================================================================
-- 1. Oryza sativa: replace "Clinically studied for inhibiting cancer"
--    in modern_uses + fix truncated PMID typo in PubMed sheet
-- =====================================================================

UPDATE public.herbs
SET
  modern_uses = ARRAY[
    'Historically used for dysentery',
    'Preclinical in vitro and animal bioactivity investigated (no human clinical efficacy established)'
  ],
  translations = jsonb_set(
    coalesce(translations, '{}'::jsonb),
    '{fr,modern_uses}',
    '[
      "Historiquement utilisé pour la dysenterie",
      "Bioactivité préclinique étudiée in vitro et chez l''animal (aucune efficacité clinique humaine établie)"
    ]'::jsonb,
    true
  ),
  updated_at = now()
WHERE slug = 'oryza-sativa';

UPDATE public.herb_pubmed_monographs
SET
  content = replace(content::text, 'PMID:3634040 la', 'PMID:36340401')::jsonb,
  updated_at = now()
WHERE slug = 'oryza-sativa'
  AND content::text LIKE '%PMID:3634040 la%';

-- =====================================================================
-- 2. Saccharum officinarum: strip agronomy / steel corrosion / cement /
--    waterlogging / veterinary / non-therapeutic padding from PubMed sheet
-- =====================================================================

UPDATE public.herb_pubmed_monographs
SET
  citations = (
    SELECT coalesce(jsonb_agg(c), '[]'::jsonb)
    FROM jsonb_array_elements(citations) AS c
    WHERE c->>'pmid' = ANY (ARRAY[
      '27751878', '26009693', '32515612', '26411113', '17123161',
      '33500371', '32755099', '32095431', '1921344'
    ])
  ),
  pmids = ARRAY[
    '27751878', '26009693', '32515612', '26411113', '17123161',
    '33500371', '32755099', '32095431', '1921344'
  ],
  article_count = 9,
  content = (
    content
    || jsonb_build_object(
      'citedPmids', '["27751878", "26009693", "32515612", "26411113", "17123161", "33500371", "32755099", "32095431", "1921344"]'::jsonb,
      'summary', 'Saccharum officinarum (sugarcane) is a tropical perennial grass cultivated for sucrose-rich stems [PMID:26009693]. Preclinical and narrative reviews have investigated isolated polyphenols and purified cane-wax fatty acids (policosanol / D-003) [PMID:27751878, PMID:33500371, PMID:32515612], though clinical trial evidence for cane juice itself remains absent.',
      'background', 'Saccharum officinarum is cultivated in tropical and subtropical regions and contains sucrose along with phenolic acids and flavones [PMID:26009693, PMID:17123161].',
      'activeCompounds', 'Identified phytoconstituents include phenolic acids (caffeic and sinapic acids), flavones (apigenin, luteolin, and tricin derivatives), and long-chain aliphatic primary acids isolated from cane wax [PMID:17123161, PMID:27751878].',
      'mechanismOfAction', 'Flavonoid fractions of cane juice showed opioid-receptor-sensitive antinociceptive activity in preclinical mouse models [PMID:32515612], while D-003 cane-wax acids were studied for lipid metabolism modulation in studies requiring independent replication [PMID:27751878].',
      'fr', (
        coalesce(content->'fr', '{}'::jsonb)
        || jsonb_build_object(
          'citedPmids', '["27751878", "26009693", "32515612", "26411113", "17123161", "33500371", "32755099", "32095431", "1921344"]'::jsonb,
          'summary', 'Saccharum officinarum (canne à sucre) est une graminée vivace tropicale cultivée pour ses tiges riches en saccharose [PMID:26009693]. Des études précliniques et revues portent sur des polyphénols isolés et les acides de cire de canne (policosanol / D-003) [PMID:27751878, PMID:33500371, PMID:32515612], sans essai clinique établi pour le jus de canne frais.',
          'background', 'Saccharum officinarum est cultivée en régions tropicales et subtropicales et renferme du saccharose ainsi que des acides phénoliques et flavones [PMID:26009693, PMID:17123161].',
          'activeCompounds', 'Les phyto-constituants identifiés comprennent des acides phénoliques (acides caféique et sinapique), des flavones (dérivés d''apigénine, lutéoline et tricine) et des acides primaires aliphatiques à longue chaîne présents dans la cire [PMID:17123161, PMID:27751878].',
          'mechanismOfAction', 'Certaines fractions flavonoïdes du jus ont montré une activité antinociceptive sensible à la naloxone chez la souris [PMID:32515612], tandis que les acides de cire D-003 ont été étudiés pour le profil lipidique avec nécessité de confirmation indépendante [PMID:27751878].'
        )
      )
    )
  ),
  updated_at = now()
WHERE slug = 'saccharum-officinarum';

-- =====================================================================
-- 3. Wild strawberry: remove dangling aquaporin / FvRIF note in modern_uses
--    and sync FR traditional_uses with EMA/HMPC/432278/2015 indications
-- =====================================================================

UPDATE public.herbs
SET
  modern_uses = ARRAY(
    SELECT u
    FROM unnest(modern_uses) AS u
    WHERE u NOT ILIKE '%aquaporin%'
      AND u NOT ILIKE '%37506031%'
      AND u NOT ILIKE '%36063744%'
  ),
  translations = jsonb_set(
    coalesce(translations, '{}'::jsonb),
    '{fr,traditional_uses}',
    '[
      "Augmenter le volume des urines pour favoriser le drainage des voies urinaires en adjuvant des troubles urinaires mineurs (EMA/HMPC/432278/2015)",
      "Traitement symptomatique de la diarrhée légère (EMA/HMPC/432278/2015)"
    ]'::jsonb,
    true
  ),
  updated_at = now()
WHERE slug = 'wild-strawberry';

INSERT INTO public.herb_bundle_dirty (slug)
VALUES ('oryza-sativa'), ('saccharum-officinarum'), ('wild-strawberry')
ON CONFLICT DO NOTHING;

COMMIT;
