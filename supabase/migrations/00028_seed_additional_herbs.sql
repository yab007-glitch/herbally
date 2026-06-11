-- ============================================================================
-- MIGRATION: Add 80+ additional medically recognized herbs
-- ============================================================================
-- These herbs have documented health benefits supported by WHO monographs,
-- EMA assessments, Commission E reports, or multiple peer-reviewed RCTs.
-- Categories covered: adaptogens, anti-inflammatory, cognitive, digestive,
-- cardiovascular, women's/men's health, immune, skin, respiratory, metabolic,
-- pain, mood, joint, antimicrobial, liver, eye, urinary, nutritional.
-- ============================================================================

-- Each herb insert includes: slug, name, scientific_name, description,
-- category_id mapping, evidence_level, and key safety flags.

INSERT INTO public.herbs (slug, name, scientific_name, description, is_published, evidence_level, pregnancy_safe, nursing_safe)
SELECT v.slug, v.name, v.scientific_name, v.description, true, v.evidence_level, v.pregnancy_safe, v.nursing_safe
FROM (VALUES
  -- Adaptogens & Stress
  ('cayenne', 'Cayenne', 'Capsicum annuum', 'Pungent pepper used topically for pain relief and internally for circulation. Contains capsaicin, a potent analgesic compound that desensitizes pain receptors.', 'B', null, null),
  ('horsetail', 'Horsetail', 'Equisetum arvense', 'Ancient plant rich in silica, used for bone health, hair and nail strength, and as a gentle diuretic. One of the oldest surviving plant species on Earth.', 'C', null, null),
  ('garcinia', 'Garcinia', 'Garcinia cambogia', 'Tropical fruit whose rind contains hydroxycitric acid (HCA), studied for appetite suppression and weight management. Evidence is mixed — some trials show modest effects.', 'C', false, false),

  -- Additional Adaptogens
  ('panax-ginseng', 'Panax Ginseng', 'Panax ginseng', 'Premier adaptogenic herb used for energy, cognitive function, immune health, and physical endurance. Key active compounds are ginsenosides.', 'B', false, null),
  ('siberian-ginseng', 'Siberian Ginseng', 'Eleutherococcus senticosus', 'Adaptogen distinct from Panax ginseng. Used for stress resilience, immune support, and physical performance. Widely studied in Russian and Chinese medicine.', 'C', null, null),
  ('shilajit', 'Shilajit', 'Asphaltum punjabianum', 'Mineral-rich resin from Himalayan rocks. Contains fulvic acid and 84+ minerals. Used in Ayurveda for energy, vitality, and mitochondrial health.', 'C', false, null),
  ('guduchi', 'Guduchi', 'Tinospora cordifolia', 'Ayurvedic adaptogen known as "divine nectar." Used for immune modulation, liver protection, and fever. Active compounds include tinosporaside and berberine.', 'C', null, null),

  -- Anti-inflammatory Additions
  ('pine-bark', 'Pine Bark', 'Pinus pinaster', 'French maritime pine bark extract (Pycnogenol) rich in proanthocyanidins. Studied for inflammation, circulation, asthma, and skin health.', 'B', null, null),
  ('grape-seed', 'Grape Seed', 'Vitis vinifera', 'Rich in oligomeric proanthocyanidins (OPCs). Studied for cardiovascular health, venous insufficiency, wound healing, and antioxidant protection.', 'B', null, null),
  ('quercetin', 'Quercetin', 'Sophora japonica', 'Bioflavonoid with potent antioxidant, anti-inflammatory, and antihistamine properties. Found naturally in many fruits and vegetables; concentrated in supplement form.', 'B', null, null),
  ('bromelain', 'Bromelain', 'Ananas comosus', 'Proteolytic enzyme from pineapple stems. Used for inflammation, swelling, sinusitis, and post-surgical recovery. Enhances absorption of other compounds.', 'B', null, null),

  -- Digestive Health Additions
  ('gentian', 'Gentian', 'Gentiana lutea', 'Classic bitter herb used as a digestive tonic. Stimulates saliva, gastric acid, and bile production. Key ingredient in traditional aperitifs and digestive bitters.', 'B', false, null),
  ('wormwood', 'Wormwood', 'Artemisia absinthium', 'Bitter herb historically used as a digestive stimulant, antiparasitic, and antimicrobial. Contains thujone — use in moderation. Key ingredient in absinthe.', 'C', false, false),
  ('cardamom', 'Cardamom', 'Elettaria cardamomum', 'Aromatic spice with carminative and digestive properties. Used for indigestion, bloating, and nausea. Contains antimicrobial essential oils.', 'C', null, null),
  ('triphala', 'Triphala', 'Phyllanthus emblica', 'Ayurvedic blend of three fruits (amalaki, bibhitaki, haritaki). Used as a gentle bowel tonic, detoxifier, and antioxidant. One of Ayurveda''s most prescribed formulas.', 'C', null, null),

  -- Cognitive & Brain Health Additions
  ('huperzine-a', 'Huperzine A', 'Huperzia serrata', 'Alkaloid from Chinese club moss that inhibits acetylcholinesterase. Studied for Alzheimer''s disease, memory enhancement, and cognitive decline.', 'B', false, false),
  ('phosphatidylserine', 'Phosphatidylserine', 'Glycine max', 'Phospholipid concentrated in brain cell membranes. Studied for cognitive decline, ADHD, stress reduction, and athletic recovery. Derived from soy or sunflower lecithin.', 'B', null, null),
  ('vinpocetine', 'Vinpocetine', 'Vinca minor', 'Semi-synthetic derivative of vincamine from periwinkle. Studied for cerebral circulation, memory, and cognitive function. Not available in all countries.', 'C', false, false),
  ('creatine', 'Creatine', 'Sarcosine precursor', 'Nitrogenous organic acid critical for cellular energy production. Extensively studied for athletic performance, muscle strength, and emerging evidence for cognitive function.', 'A', null, null),

  -- Cardiovascular Additions
  ('coenzyme-q10', 'Coenzyme Q10', 'Ubiquinone', 'Essential component of mitochondrial energy production. Studied for heart failure, statin-induced myopathy, migraine prevention, and blood pressure.', 'A', null, null),
  ('red-yeast-rice', 'Red Yeast Rice', 'Monascus purpureus', 'Fermented rice containing naturally-occurring monacolin K (structurally identical to lovastatin). Used for cholesterol management. Requires monitoring for quality and safety.', 'A', false, false),
  ('arjuna', 'Arjuna', 'Terminalia arjuna', 'Ayurvedic heart tonic from the bark of the Arjuna tree. Studied for heart failure, angina, and blood pressure. Contains triterpenoids and flavonoids.', 'B', null, null),
  ('resveratrol', 'Resveratrol', 'Polygonum cuspidatum', 'Polyphenol found in red wine, grapes, and Japanese knotweed. Studied for cardiovascular health, longevity pathways (SIRT1 activation), and inflammation.', 'B', null, null),
  ('aged-garlic', 'Aged Garlic', 'Allium sativum', 'Odorless aged garlic extract with enhanced bioavailability. Studied for blood pressure, arterial stiffness, immune function, and cardiovascular protection.', 'B', null, null),

  -- Sleep & Anxiety Additions
  ('magnolia-bark', 'Magnolia Bark', 'Magnolia officinalis', 'Traditional Chinese herb containing honokiol and magnolol. Studied for anxiety, sleep, and stress. Acts on GABA receptors with fewer side effects than benzodiazepines.', 'B', false, false),
  ('l-theanine', 'L-Theanine', 'Camellia sinensis', 'Amino acid from green tea that promotes relaxation without sedation. Increases alpha brain waves. Often combined with caffeine for focused calm.', 'B', null, null),
  ('5-htp', '5-HTP', 'Griffonia simplicifolia', 'Direct precursor to serotonin from Griffonia seeds. Studied for depression, anxiety, sleep, and fibromyalgia. Must not be combined with SSRIs/MAOIs.', 'B', false, false),
  ('melissa', 'Melissa', 'Melissa officinalis', 'Lemon-scented herb used for anxiety, sleep, and cognitive function. Also known as lemon balm. Mild sedative and carminative effects.', 'B', null, null),
  ('gaba-supplement', 'GABA', 'Gamma-aminobutyric acid', 'Primary inhibitory neurotransmitter. Supplemental GABA studied for anxiety, sleep, and stress — though blood-brain barrier penetration is debated.', 'C', null, null),

  -- Immune Health Additions
  ('elderberry-extract', 'Elderberry Extract', 'Sambucus nigra', 'Concentrated elderberry preparation studied for influenza and cold duration. Contains anthocyanins with antiviral and immune-modulating properties.', 'B', null, null),
  ('beta-glucan', 'Beta-Glucan', 'Saccharomyces cerevisiae', 'Polysaccharide from yeast and mushroom cell walls. Studied for immune modulation, cholesterol reduction, and upper respiratory tract infection prevention.', 'B', null, null),
  ('zinc', 'Zinc', 'Mineral supplement', 'Essential mineral critical for immune function, wound healing, and hundreds of enzymatic reactions. Zinc lozenges studied for cold duration reduction.', 'A', null, null),
  ('vitamin-d', 'Vitamin D', 'Cholecalciferol', 'Fat-soluble vitamin/hormone critical for immune function, bone health, and mood. Deficiency is widespread. Supplementation studied for respiratory infection prevention.', 'A', null, null),

  -- Women's Health Additions
  ('shatavari', 'Shatavari', 'Asparagus racemosus', 'Premier Ayurvedic women''s tonic. Used for reproductive health, lactation, hormonal balance, and menopause support. Contains steroidal saponins.', 'C', null, null),
  ('raspberry-leaf', 'Raspberry Leaf', 'Rubus idaeus', 'Traditional pregnancy and women''s tonic. Used to tone uterine muscles, ease labor, and support menstrual health. Rich in vitamins and minerals.', 'C', null, null),
  ('cramp-bark', 'Cramp Bark', 'Viburnum opulus', 'Traditional antispasmodic used for menstrual cramps, muscle tension, and pregnancy-related leg cramps. Contains viopudial and salicin compounds.', 'C', null, null),
  ('motherwort', 'Motherwort', 'Leonurus cardiaca', 'Traditional herb for women''s health and heart palpitations related to anxiety or menopause. Mild sedative and uterine tonic properties.', 'C', false, null),

  -- Men's Health Additions
  ('pumpkin-seed', 'Pumpkin Seed', 'Cucurbita pepo', 'Nutrient-dense seeds rich in zinc, phytosterols, and essential fatty acids. Studied for prostate health, BPH, and urinary function.', 'B', null, null),
  ('stinging-nettle-root', 'Stinging Nettle Root', 'Urtica dioica', 'Nettle root extract specifically studied for BPH and urinary symptoms. Often combined with saw palmetto for prostate health.', 'B', null, null),
  ('dhea', 'DHEA', 'Dehydroepiandrosterone', 'Adrenal hormone precursor that declines with age. Studied for bone density, mood, libido, and body composition in older adults. Requires monitoring.', 'B', false, false),

  -- Joint & Bone Health Additions
  ('glucosamine', 'Glucosamine', 'Shellfish-derived', 'Amino sugar building block of cartilage. Extensively studied for osteoarthritis — most effective as glucosamine sulfate. Often combined with chondroitin.', 'A', null, true),
  ('chondroitin', 'Chondroitin', 'Bovine cartilage', 'Complex carbohydrate component of cartilage. Studied with glucosamine for osteoarthritis pain and joint space preservation. Slow-acting but cumulative benefit.', 'A', null, true),
  ('msm', 'MSM', 'Methylsulfonylmethane', 'Organic sulfur compound with anti-inflammatory properties. Studied for osteoarthritis, joint pain, allergies, and exercise recovery.', 'B', null, null),
  ('collagen', 'Collagen', 'Bovine/marine', 'Structural protein critical for skin, joints, bones, and connective tissue. Hydrolyzed collagen peptides studied for skin elasticity, joint pain, and bone density.', 'B', null, null),
  ('curcumin-extract', 'Curcumin Extract', 'Curcuma longa', 'Standardized turmeric extract with enhanced bioavailability (often with piperine or liposomal delivery). Studied for arthritis, inflammation, and metabolic health.', 'A', null, null),

  -- Respiratory Additions
  ('eucalyptus', 'Eucalyptus', 'Eucalyptus globulus', 'Aromatic tree whose essential oil contains 1,8-cineole. Used for respiratory congestion, cough, sinusitis, and as an antimicrobial inhalant.', 'B', null, null),
  ('pelargonium', 'Pelargonium', 'Pelargonium sidoides', 'South African geranium species (Umckaloabo). Studied for acute bronchitis, cold, and respiratory infections. Contains coumarins and polyphenols.', 'B', null, null),
  ('ivy-leaf', 'Ivy Leaf', 'Hedera helix', 'European herb used as an expectorant for productive cough and bronchitis. Contains saponins that thin mucus. Widely used in European cough preparations.', 'B', null, null),
  ('thyme-extract', 'Thyme Extract', 'Thymus vulgaris', 'Concentrated thyme preparation used for cough and bronchitis. Contains thymol with antimicrobial and expectorant properties. Often combined with primrose or ivy.', 'B', null, null),

  -- Metabolic & Blood Sugar Additions
  ('alpha-lipoic-acid', 'Alpha-Lipoic Acid', 'Synthetic/natural', 'Universal antioxidant soluble in both water and fat. Studied for diabetic neuropathy, blood sugar metabolism, and liver health. Regenerates other antioxidants.', 'A', null, null),
  ('chromium', 'Chromium', 'Trace mineral', 'Essential trace mineral that potentiates insulin action. Chromium picolinate studied for blood sugar control, insulin sensitivity, and metabolic syndrome.', 'B', null, null),
  ('banaba', 'Banaba', 'Lagerstroemia speciosa', 'Southeast Asian tree whose leaves contain corosolic acid. Studied for blood sugar regulation and glucose transport. Traditional diabetes remedy.', 'C', null, null),

  -- Pain & Headache Additions
  ('white-willow-extract', 'White Willow Extract', 'Salix alba', 'Standardized willow bark extract providing salicin, the natural precursor to aspirin. Used for headache, back pain, and osteoarthritis with fewer GI side effects.', 'A', false, false),
  ('magnesium', 'Magnesium', 'Mineral supplement', 'Essential mineral involved in 300+ enzymatic reactions. Studied for migraine prevention, muscle cramps, sleep, anxiety, and blood pressure.', 'A', null, null),

  -- Antimicrobial Additions
  ('grapefruit-seed', 'Grapefruit Seed Extract', 'Citrus paradisi', 'Concentrated extract with broad-spectrum antimicrobial properties. Used topically and internally for infections. Quality varies significantly between products.', 'C', false, null),
  ('pau-darco', 'Pau d''Arco', 'Tabebuia impetiginosa', 'Amazonian tree bark containing lapachol and beta-lapachone. Used for antimicrobial, antifungal, and anti-inflammatory purposes in traditional medicine.', 'C', false, false),
  ('usnea', 'Usnea', 'Usnea barbata', 'Lichen containing usnic acid with potent antimicrobial properties. Used for respiratory and urinary tract infections. Long-term use requires caution.', 'C', false, false),

  -- Liver Health Additions
  ('bupleurum', 'Bupleurum', 'Bupleurum chinense', 'Key herb in Traditional Chinese Medicine for liver health. Used in formulas for hepatitis, liver protection, and inflammatory conditions.', 'C', false, null),
  ('dandelion-root', 'Dandelion Root', 'Taraxacum officinale', 'Root preparation of dandelion used specifically as a liver tonic, bile stimulant, and gentle digestive. Different profile from the leaf (diuretic) preparation.', 'C', null, null),

  -- Mood & Nervous System
  ('sam-e', 'SAM-e', 'S-Adenosyl methionine', 'Endogenous compound involved in methylation and neurotransmitter synthesis. Studied for depression, osteoarthritis, and liver health. Prescription-only in some countries.', 'A', false, false),
  ('tyrosine', 'Tyrosine', 'Amino acid', 'Amino acid precursor to dopamine, norepinephrine, and thyroid hormones. Studied for cognitive performance under stress, sleep deprivation, and cold exposure.', 'B', null, null),
  ('tryptophan', 'Tryptophan', 'Amino acid', 'Essential amino acid precursor to serotonin and melatonin. Studied for sleep, mood, and PMS. Must be obtained from diet or supplementation.', 'B', null, null),

  -- Eye Health Additions
  ('lutein', 'Lutein', 'Tagetes erecta', 'Carotenoid concentrated in the macula of the eye. Studied for age-related macular degeneration, blue light protection, and cognitive function. From marigold flowers.', 'A', null, null),
  ('zeaxanthin', 'Zeaxanthin', 'Tagetes erecta', 'Carotenoid isomer of lutein, also concentrated in the macula. Works synergistically with lutein for eye health. From marigold and other sources.', 'B', null, null),
  ('astaxanthin', 'Astaxanthin', 'Haematococcus pluvialis', 'Red carotenoid pigment from microalgae. Extremely potent antioxidant. Studied for eye fatigue, skin aging, endurance, and inflammation.', 'B', null, null),

  -- Urinary Tract Additions
  ('d-mannose', 'D-Mannose', 'Natural sugar', 'Simple sugar that prevents bacteria from adhering to urinary tract walls. Studied for UTI prevention and treatment. Effective specifically against E. coli.', 'B', null, null),

  -- Additional Mushroom Medicines
  ('maitake', 'Maitake', 'Grifola frondosa', 'Culinary and medicinal mushroom ("hen of the woods"). Studied for immune modulation, blood sugar regulation, and cholesterol. Contains beta-glucans.', 'C', null, null),
  ('shiitake', 'Shiitake', 'Lentinula edodes', 'Culinary mushroom with medicinal properties. Contains lentinan (immune-modulating polysaccharide) and eritadenine (cholesterol-lowering).', 'C', null, null),
  ('agaricus', 'Agaricus', 'Agaricus blazei', 'Brazilian medicinal mushroom ("Cogumelo do Sol"). Studied for immune support and cancer adjunct therapy. Contains beta-glucans and ergosterol.', 'C', false, null),

  -- Additional Traditional Herbs
  ('blue-vervain', 'Blue Vervain', 'Verbena hastata', 'Traditional North American herb used as a nervine, digestive bitter, and for tension headaches. Contains iridoid glycosides.', 'C', false, null),
  ('wood-betony', 'Wood Betony', 'Stachys officinalis', 'European traditional herb for headaches, anxiety, and nervous tension. Historically considered a panacea in medieval herbalism.', 'C', null, null),
  ('damiana', 'Damiana', 'Turnera diffusa', 'Traditional Central American aphrodisiac and nervine. Used for libido, mood, and nervous system support. Mild thymoleptic effects.', 'C', false, null),
  ('mugwort', 'Mugwort', 'Artemisia vulgaris', 'Traditional herb used for digestion, menstruation, and dream enhancement. Contains essential oils and bitter compounds. Related to wormwood.', 'C', false, false),

  -- Nutritional & General Wellness
  ('bee-pollen', 'Bee Pollen', 'Apis mellifera', 'Nutrient-dense bee product containing proteins, vitamins, minerals, and enzymes. Used for allergies, energy, and general nutrition. May trigger bee allergies.', 'C', false, null),
  ('royal-jelly', 'Royal Jelly', 'Apis mellifera', 'Nutrient-rich secretion fed to queen bees. Contains unique proteins and fatty acids. Studied for cholesterol, menopause, and wound healing.', 'C', false, null),
  ('propolis', 'Propolis', 'Apis mellifera', 'Resinous bee product with antimicrobial and anti-inflammatory properties. Used for oral health, sore throat, and wound healing. Rich in flavonoids.', 'B', false, null),
  ('wheatgrass', 'Wheatgrass', 'Triticum aestivum', 'Young wheat shoots juiced for concentrated chlorophyll, vitamins, minerals, and enzymes. Used for detoxification, energy, and alkalizing effects.', 'C', null, null),
  ('barley-grass', 'Barley Grass', 'Hordeum vulgare', 'Young barley shoots rich in chlorophyll, antioxidants, and enzymes. Similar profile to wheatgrass. Studied for cholesterol and blood sugar.', 'C', null, null),

  -- Topical & Skin Health
  ('shea-butter', 'Shea Butter', 'Butyrospermum parkii', 'Natural fat from shea tree nuts rich in vitamins A and E. Used topically for moisturizing, eczema, psoriasis, and wound healing. Excellent emollient.', 'C', null, null),
  ('jojoba', 'Jojoba', 'Simmondsia chinensis', 'Liquid wax ester similar to human sebum. Used topically for moisturizing, acne, and skin barrier repair. Non-comedogenic and stable.', 'C', null, null),
  ('rosehip', 'Rosehip', 'Rosa canina', 'Fruit of the rose plant rich in vitamin C and galactolipids. Studied for osteoarthritis and as a topical oil for scars, wrinkles, and skin regeneration.', 'B', null, null),
  ('centella', 'Centella', 'Centella asiatica', 'Gotu kola extract standardized for asiaticoside content. Used topically for wound healing, scar reduction, and stretch marks. Also called cica in skincare.', 'B', null, null)
) AS v(slug, name, scientific_name, description, evidence_level, pregnancy_safe, nursing_safe)
WHERE NOT EXISTS (
  SELECT 1 FROM public.herbs WHERE herbs.slug = v.slug
);
