-- Fix 16 broken/unsupported herb image URLs discovered during self-hosted image
-- audit (404 /0/0d/ Echinacea hash, HTTP 413 >50 MB Wikimedia originals,
-- unrendered TIFF/SVG URLs -> PNG/JPEG thumbs, and .ogv video files -> JPEG).
-- Idempotent and safe to run on existing databases; refreshes precomputed
-- herb_page_bundles for the updated slugs.

BEGIN;

UPDATE public.herbs AS h
SET image_url = v.new_url
FROM (
  VALUES
    ('artemisia-judaica', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Botanique._1._Artemisia_monosperma%3B_2._Artemisia_inculta%3B_3._Artemisia_judaica_%28NYPL_b14212718-1268675%29.tiff/lossy-page1-1280px-Botanique._1._Artemisia_monosperma%3B_2._Artemisia_inculta%3B_3._Artemisia_judaica_%28NYPL_b14212718-1268675%29.tiff.jpg'),
    ('asclepias-syriaca', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Asclepias_syriacus.tif/lossy-page1-960px-Asclepias_syriacus.tif.jpg'),
    ('asteraceae-blessed-thistle', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/%28MHNT%29_Centaurea_Benedicta_-_Jardin_Botanique_Henri_GAUSSEN.jpg/1280px-%28MHNT%29_Centaurea_Benedicta_-_Jardin_Botanique_Henri_GAUSSEN.jpg'),
    ('candida-albicans', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/SEM_of_C_albicans.tif/lossy-page1-960px-SEM_of_C_albicans.tif.jpg'),
    ('cornus-circinata', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Cornus_Circinata_%28Round-Leaved_Cornel%29_in_Billings-Kittredge_Herbaria_%28fb46b45a-6cf5-4bc6-84e6-e00996b755eb%29.tif/lossy-page1-1280px-Cornus_Circinata_%28Round-Leaved_Cornel%29_in_Billings-Kittredge_Herbaria_%28fb46b45a-6cf5-4bc6-84e6-e00996b755eb%29.tif.jpg'),
    ('cyclopia-subternata', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Cyclopia_subternata_distribution.svg/1280px-Cyclopia_subternata_distribution.svg.png'),
    ('echinacea', 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Echinacea_purpurea_Grandview_Prairie.jpg'),
    ('honeybush-tea', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Cyclopia_intermedia_distribution.svg/1280px-Cyclopia_intermedia_distribution.svg.png'),
    ('huang-qi-zhi-mu', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Anemarrhena_asphodeloides-NMNH-03958679.jpg/1280px-Anemarrhena_asphodeloides-NMNH-03958679.jpg'),
    ('ji-xue-cao', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Bidens_bipinnata_L._Spanish_needles.tiff/lossy-page1-1280px-Bidens_bipinnata_L._Spanish_needles.tiff.jpg'),
    ('koseret-ethiopian', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Lippia_abyssinica.tif/lossy-page1-1280px-Lippia_abyssinica.tif.jpg'),
    ('lycopodium-japonicum', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Lycojaponicumin_A.svg/1280px-Lycojaponicumin_A.svg.png'),
    ('niacinamide-skin', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Nicotinamid.svg/1280px-Nicotinamid.svg.png'),
    ('rhododendron-chrysanthum-herb', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Rhododendron_aureum_%27Taisetsu%27_Georgi-_Bemerk._Reise_Russ._Reich_1-_214_%281775%29._20210612_231119.jpg/1280px-Rhododendron_aureum_%27Taisetsu%27_Georgi-_Bemerk._Reise_Russ._Reich_1-_214_%281775%29._20210612_231119.jpg'),
    ('saccharomyces-boulardii', 'https://upload.wikimedia.org/wikipedia/commons/d/d9/S_cerevisiae_under_DIC_microscopy.jpg'),
    ('saccharomyces-boulardii-lyo', 'https://upload.wikimedia.org/wikipedia/commons/d/d9/S_cerevisiae_under_DIC_microscopy.jpg')
) AS v(slug, new_url)
WHERE h.slug = v.slug
  AND h.image_url IS DISTINCT FROM v.new_url;

SELECT public.refresh_herb_page_bundles(500);

COMMIT;
