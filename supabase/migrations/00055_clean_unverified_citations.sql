-- ============================================================================
-- MIGRATION 00055: Remove unverified / unrelated / broken citation references
-- ============================================================================
-- Background: REFERENCE_AUDIT_2026-06-23.md verified every herb's citations.
-- This migration removes references that do NOT reflect the herb in question:
--   * PubMed citations whose PMID resolves to an unrelated article, or to no
--     article at all, or that have no PMID (search-URL placeholders).
--   * WHO and EMA citations (generic landing pages that are also HTTP 404).
--   * Commission E citations (generic landing page, not herb-specific).
--   * NCCIH generic 'Herbs at a Glance' index links, except for 6 herbs that
--     are replaced with their real per-herb NCCIH page.
-- 
-- REVERSIBLE: a full pre-change snapshot of every herb's citations is stored
-- in supabase/backups/citations_backup_2026-06-23.json. To restore, reload
-- that JSON into the herbs.citations column keyed by slug.
-- ============================================================================

CREATE TEMP TABLE _bad_pubmed (slug text, pmid text) ON COMMIT DROP;

INSERT INTO _bad_pubmed (slug, pmid) VALUES
  ('boswellia', '30670274'),
  ('grape-seed', '15190087'),
  ('slippery-elm', '14669221'),
  ('peppermint', '30967867'),
  ('saffron', '31642944'),
  ('saffron', '27653672'),
  ('chamomile', '27618195'),
  ('mullein', '17033198'),
  ('berberine', '27329123'),
  ('skullcap', '14669221'),
  ('lemon-balm', '25644988'),
  ('ginkgo-biloba', '19969194'),
  ('ginkgo-biloba', '14974044'),
  ('chaga', '28471499'),
  ('black-cohosh', '22980423'),
  ('black-cohosh', '20026878'),
  ('spelt-wheat', '29197469'),
  ('feverfew', '21615429'),
  ('feverfew', '14973952'),
  ('vitex', '28269988'),
  ('gotu-kola', '21132119'),
  ('passionflower', '21082722'),
  ('green-tea', '23780714'),
  ('green-tea', '26378924'),
  ('coleus', '17033198'),
  ('fenugreek', '29767296'),
  ('fenugreek', '27329123'),
  ('dong-quai', '14669221'),
  ('lemon-balm-toronjil', '38176744'),
  ('olive-leaf', '21132119'),
  ('neem', '14669221'),
  ('black-seed', '25333868'),
  ('maitake', '15190087'),
  ('thyme', '17033198'),
  ('licorice-root', '22922643'),
  ('red-clover', '17033198'),
  ('black-walnut', '15190087'),
  ('entada-africana', '37351515'),
  ('hops', '17033198'),
  ('elderflower', '17033198'),
  ('elderberry', '30670274'),
  ('elderberry', '33827544'),
  ('samento-amazonian', '33917843'),
  ('artichoke', '14669221'),
  ('triphala', '17033198'),
  ('astragalus', '22457329'),
  ('butterbur', '15190087'),
  ('hawthorn', '18253998'),
  ('hawthorn', '21143458'),
  ('rhodiola', '22299769'),
  ('ginger', '23919527'),
  ('bacopa', '25386645'),
  ('bacopa', '22782090'),
  ('st-johns-wort', '15100172'),
  ('cats-claw', '15190087'),
  ('milk-thistle', '23195927'),
  ('milk-thistle', '27543776'),
  ('rosemary', '28388942'),
  ('propolis', '26270677'),
  ('cranberry', '22777607'),
  ('aloe-vera', '23094936'),
  ('calendula', '19656484'),
  ('ginseng', '11978122'),
  ('ginseng', '23903078'),
  ('eleuthero', '20036788'),
  ('saw-palmetto', '23133530'),
  ('saw-palmetto', '19046459'),
  ('psyllium', '29902436'),
  ('psyllium', '29533934'),
  ('fennel', '26463297'),
  ('lavender', '31655396'),
  ('evening-primrose', '17033198'),
  ('bilberry', '15190087'),
  ('wheatgrass', '14669221'),
  ('wormwood', '14669221'),
  ('goldenseal', '21132119'),
  ('spirulina', '27544118'),
  ('nettle', '14669221'),
  ('pygeum', '14669221'),
  ('garcinia', '21132119'),
  ('bee-pollen', '15190087'),
  ('guarana-seed', '36014874'),
  ('barley-grass', '15190087'),
  ('shiitake', '17033198'),
  ('solanum-tomentosum-herb', '30484617'),
  ('malpighia-glabra', '38574699'),
  ('wu-jia-pi', '11808169'),
  ('tea-tree', '16418533'),
  ('arnica', '17033198'),
  ('witch-hazel', '15190087'),
  ('eucalyptus', '15190087'),
  ('valerian', '25479017'),
  ('blue-vervain', '17033198'),
  ('dandelion', '21132119'),
  ('oregano', '21132119'),
  ('chlorella', '15190087'),
  ('tribulus', '21132119'),
  ('turkey-tail', '17033198'),
  ('kava', '21145331'),
  ('schisandra', '23747688'),
  ('marshmallow-root', '15190087'),
  ('devils-claw', '17212554'),
  ('devils-claw', '14669221'),
  ('yarrow', '15190087'),
  ('horse-chestnut', '17033198'),
  ('horse-chestnut', '14669221'),
  ('gymnema', '25386645'),
  ('andrographis', '28471499'),
  ('uva-ursi', '17033198'),
  ('clove', '17033198'),
  ('tongkat-ali', '28471499'),
  ('cayenne', '28471499'),
  ('pumpkin-seed', '17033198'),
  ('red-yeast-rice', '25361184'),
  ('red-yeast-rice', '19046459'),
  ('rosa-alba-herb', '25644620'),
  ('rosa-alba-herb', '24500813'),
  ('licorice-dgl', '30000900'),
  ('blue-cohosh-root', '30000839'),
  ('taxus-baccata', '31644104'),
  ('ephedra-equisetina', '31644021'),
  ('bitter-orange-flower', '30000952'),
  ('stachys-betonica', '30000919'),
  ('aloe-arborescens-herb', '30000889'),
  ('bilberry-leaf', '30000885'),
  ('nettle-root', '37011125'),
  ('salvia-nemorosa', '30000875'),
  ('borage-leaf', '30000849'),
  ('corynanthe-yohimbe', '31644013'),
  ('nigella-persian', '30000936'),
  ('ipecac', '28846272'),
  ('evening-primrose', '21168118'),
  ('ephedra-sinica', '31644021'),
  ('euphorbia-tirucalli', '34662040'),
  ('chamomile-roman', '31643492'),
  ('salvia-pratensis', '30000875'),
  ('hawthorn-flowers', '30000891'),
  ('pausinystalia-johimbe', '31644013'),
  ('anatolian-sage', '30000875'),
  ('black-willow', '30000964'),
  ('spanish-sage', '30000875'),
  ('dragons-blood-croton', '31643647'),
  ('stachys-officinalis', '30000919'),
  ('frangula-purshiana', '30000918'),
  ('fo-ti-root', '31644102'),
  ('alkanet', '30000849'),
  ('ixbut', '30000943'),
  ('periwinkle-lesser', '31643321'),
  ('lamiaceae-betony', '30000919'),
  ('lu-lu-tong', '37094052');

CREATE TEMP TABLE _nccih_replace (slug text, url text, title text) ON COMMIT DROP;

INSERT INTO _nccih_replace (slug, url, title) VALUES
  ('hoodia', 'https://www.nccih.nih.gov/health/hoodia', 'Hoodia'),
  ('fenugreek-leaf', 'https://www.nccih.nih.gov/health/fenugreek', 'Fenugreek'),
  ('aloe-vera-chinensis', 'https://www.nccih.nih.gov/health/aloe-vera', 'Aloe Vera'),
  ('pomegranate-peel', 'https://www.nccih.nih.gov/health/pomegranate', 'Pomegranate'),
  ('sambucol', 'https://www.nccih.nih.gov/health/elderberry', 'Elderberry'),
  ('astragalus-mongholicus', 'https://www.nccih.nih.gov/health/astragalus', 'Astragalus');

-- Rebuild each herb's citations array, dropping bad refs and rewriting the 6
-- NCCIH links to their specific page. jsonb_agg returns NULL when every ref is
-- removed; COALESCE keeps the column an empty array instead of NULL.
UPDATE public.herbs h
SET citations = COALESCE((
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'source' = 'NCCIH' AND nr.slug IS NOT NULL
        THEN jsonb_set(jsonb_set(elem, '{url}', to_jsonb(nr.url)), '{title}', to_jsonb(nr.title))
      ELSE elem
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(h.citations) WITH ORDINALITY AS t(elem, ord)
  LEFT JOIN _nccih_replace nr
    ON nr.slug = h.slug AND elem->>'source' = 'NCCIH'
  WHERE NOT (
        (elem->>'source' = 'PubMed'
          AND EXISTS (SELECT 1 FROM _bad_pubmed b WHERE b.slug = h.slug AND b.pmid = (elem->>'pmid')))
     OR (elem->>'source' = 'PubMed'
          AND ((elem->>'pmid') IS NULL OR (elem->>'pmid') !~ '^[0-9]+$'))
     OR (elem->>'source' IN ('WHO','EMA','Commission E'))
     OR (elem->>'source' = 'NCCIH' AND nr.slug IS NULL)
  )
), '[]'::jsonb)
WHERE jsonb_typeof(h.citations) = 'array' AND jsonb_array_length(h.citations) > 0;

