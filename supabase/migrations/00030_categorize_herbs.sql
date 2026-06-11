-- ============================================================================
-- MIGRATION 00030: Categorize herbs as Common vs Not Common
-- ============================================================================
-- Adds a "Not Common" category for obscure/rare/hard-to-find herbs.
-- Common herbs (well-known, widely available, medically recognized) stay in
-- their existing therapeutic categories.
--
-- "Common" herbs are those from:
--   - Seed file (00015): 100 herbs
--   - Migration 00028: 85 additional herbs
--   - Migration 00029: 62 missing seed herbs
-- Total: ~247 common herbs
--
-- All other herbs (~2,454) are moved to "Not Common".
-- ============================================================================

-- Step 1: Add the "Not Common" category
INSERT INTO public.herb_categories (name, slug, description, icon, sort_order)
VALUES (
  'Not Common',
  'not-common',
  'Herbs that are rare, hard to find, unavailable, or have limited documentation. Still accessible and searchable.',
  'archive',
  21
) ON CONFLICT (slug) DO NOTHING;

-- Step 2: Define the list of common herb slugs
-- These are herbs from the seed file + migration 00028 + migration 00029
-- that are well-known, widely available, and medically recognized.

-- Step 3: Move all herbs NOT in the common list to "Not Common"
-- We use a NOT IN clause with the known common slugs.

UPDATE public.herbs
SET category_id = (
  SELECT id FROM public.herb_categories WHERE slug = 'not-common'
)
WHERE is_published = true
  AND slug NOT IN (
    -- Seed file herbs (00015)
    'turmeric', 'ginger', 'echinacea', 'st-johns-wort', 'ginkgo-biloba',
    'garlic', 'ashwagandha', 'valerian', 'chamomile', 'peppermint',
    'lavender', 'aloe-vera', 'ginseng', 'green-tea', 'milk-thistle',
    'black-cohosh', 'elderberry', 'saw-palmetto', 'licorice-root', 'feverfew',
    'hawthorn', 'passionflower', 'rhodiola', 'holy-basil', 'dong-quai',
    'cats-claw', 'evening-primrose', 'nettle', 'dandelion', 'red-clover',
    'cranberry', 'oregano', 'rosemary', 'thyme', 'sage', 'cinnamon',
    'fenugreek', 'moringa', 'neem', 'spirulina', 'chlorella', 'maca',
    'tribulus', 'astragalus', 'reishi', 'lions-mane', 'cordyceps', 'chaga',
    'turkey-tail', 'saffron', 'kava', 'lemon-balm', 'berberine', 'goldenseal',
    'slippery-elm', 'marshmallow-root', 'mullein', 'black-seed', 'boswellia',
    'devils-claw', 'willow-bark', 'butterbur', 'hops', 'skullcap', 'yarrow',
    'eleuthero', 'american-ginseng', 'schisandra', 'gotu-kola', 'bacopa',
    'elderflower', 'calendula', 'arnica', 'tea-tree', 'witch-hazel',
    'horse-chestnut', 'bilberry', 'gymnema', 'vitex', 'comfrey',
    'java-turmeric', 'meadowsweet', 'plantain', 'olive-leaf', 'milk-vetch',
    'white-willow', 'uva-ursi', 'pygeum', 'andrographis', 'coleus',
    'clove', 'fennel', 'artichoke', 'psyllium', 'black-walnut',
    'tongkat-ali', 'wormwood', 'sambucol', 'curcumin', 'nettle-root',

    -- Migration 00028 herbs
    'cayenne', 'horsetail', 'garcinia', 'panax-ginseng', 'siberian-ginseng',
    'shilajit', 'guduchi', 'pine-bark', 'grape-seed', 'quercetin',
    'bromelain', 'gentian', 'wormwood', 'cardamom', 'triphala',
    'huperzine-a', 'phosphatidylserine', 'vinpocetine', 'creatine',
    'coenzyme-q10', 'red-yeast-rice', 'arjuna', 'resveratrol', 'aged-garlic',
    'magnolia-bark', 'l-theanine', '5-htp', 'melissa', 'gaba-supplement',
    'elderberry-extract', 'beta-glucan', 'zinc', 'vitamin-d',
    'shatavari', 'raspberry-leaf', 'cramp-bark', 'motherwort',
    'pumpkin-seed', 'stinging-nettle-root', 'dhea',
    'glucosamine', 'chondroitin', 'msm', 'collagen', 'curcumin-extract',
    'eucalyptus', 'pelargonium', 'ivy-leaf', 'thyme-extract',
    'alpha-lipoic-acid', 'chromium', 'banaba',
    'white-willow-extract', 'magnesium',
    'grapefruit-seed', 'pau-darco', 'usnea',
    'bupleurum', 'dandelion-root',
    'sam-e', 'tyrosine', 'tryptophan',
    'lutein', 'zeaxanthin', 'astaxanthin',
    'd-mannose',
    'maitake', 'shiitake', 'agaricus',
    'blue-vervain', 'wood-betony', 'damiana', 'mugwort',
    'bee-pollen', 'royal-jelly', 'propolis', 'wheatgrass', 'barley-grass',
    'shea-butter', 'jojoba', 'rosehip', 'centella'
  );
