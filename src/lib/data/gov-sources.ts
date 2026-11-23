/**
 * Government & authoritative-source registry for herb content.
 *
 * Dawn Wong (reviewer) flagged that the herb data is not accurate and that we
 * should ground it in government sources. This registry is the canonical
 * mapping of herb slugs to real, verifiable government monograph pages so the
 * site can surface the credible source of truth on every herb page and the
 * review/correction workflow can fetch the authoritative text.
 *
 * Sources prioritised (all government / intergovernmental):
 *   - NCCIH (NIH) "Herbs at a Glance" monographs — direct per-herb pages
 *   - MedlinePlus (NIH/NLM) — search fallback
 *   - NIH Office of Dietary Supplements (ODS) fact sheets — index
 *   - EMA HMPC (EU medicines agency) herbal monographs — index
 *   - WHO monographs — index
 *
 * The NCCIH direct URLs were discovered from the official "Herbs at a Glance"
 * index (https://www.nccih.nih.gov/health/herbsataglance.htm) and each mapped
 * to the matching HerbAlly database slug (by common name, then scientific name
 * for synonym herbs, e.g. ginkgo-biloba -> NCCIH "ginkgo"). Only pages that
 * exist in the NCCIH index are mapped — no fabricated URLs.
 *
 * IMPORTANT: surfacing a government source link does NOT mean the stored herb
 * row matches that source — the row may still be AI-generated. The page makes
 * that distinction explicit (see the "no government monograph matched"
 * notice). Actual data correction happens through the reviewer-in-the-loop
 * fetch script (scripts/fetch-gov-sources.ts), never by blind overwrite.
 */

export type GovSourceKind = "monograph" | "search" | "index";

export interface MonographSourceRef {
  source: string;
  url: string | null;
}

export interface GovSource {
  /** Stable id, e.g. "nccih". */
  id: string;
  label: string;
  url: string;
  kind: GovSourceKind;
  /** "monograph" = a direct authoritative page for THIS herb; others are general. */
  authoritative: boolean;
}

interface SourceDef {
  id: string;
  label: string;
  indexUrl: string;
}

export const GOV_SOURCES: Record<string, SourceDef> = {
  nccih: {
    id: "nccih",
    label: "NCCIH (NIH)",
    indexUrl: "https://www.nccih.nih.gov/health/herbsataglance",
  },
  medlineplus: {
    id: "medlineplus",
    label: "MedlinePlus (NIH)",
    indexUrl: "https://medlineplus.gov/druginfo/herb_All.html",
  },
  ods: {
    id: "ods",
    label: "NIH ODS Fact Sheets",
    indexUrl: "https://ods.od.nih.gov/factsheets/list-all/",
  },
  ema: {
    id: "ema",
    label: "EMA HMPC Monographs",
    indexUrl:
      "https://www.ema.europa.eu/en/human-regulatory-overview/herbal-medicinal-products",
  },
  who: {
    id: "who",
    label: "WHO Monographs",
    indexUrl: "https://www.who.int/publications/i/item/9241545178",
  },
};

/**
 * Direct NCCIH "Herbs at a Glance" URLs, discovered from the official NCCIH
 * index and mapped to HerbAlly database slugs. Keyed by slug.
 */
const NCCIH_DIRECT: Record<string, string> = {
  "acai-berry-antioxidant": "https://www.nccih.nih.gov/health/acai",
  "aloe-vera": "https://www.nccih.nih.gov/health/aloe-vera",
  "aloe-vera-leaf": "https://www.nccih.nih.gov/health/aloe-vera",
  ashwagandha: "https://www.nccih.nih.gov/health/ashwagandha",
  "asian-ginseng": "https://www.nccih.nih.gov/health/asian-ginseng",
  astragalus: "https://www.nccih.nih.gov/health/astragalus",
  bilberry: "https://www.nccih.nih.gov/health/bilberry",
  "bitter-orange": "https://www.nccih.nih.gov/health/bitter-orange",
  "black-cohosh": "https://www.nccih.nih.gov/health/black-cohosh",
  boswellia: "https://www.nccih.nih.gov/health/boswellia",
  butterbur: "https://www.nccih.nih.gov/health/butterbur",
  "cats-claw": "https://www.nccih.nih.gov/health/cats-claw",
  chamomile: "https://www.nccih.nih.gov/health/chamomile",
  "matricaria-recutita": "https://www.nccih.nih.gov/health/chamomile",
  cinnamon: "https://www.nccih.nih.gov/health/cinnamon",
  "cook-island-noni-leaf": "https://www.nccih.nih.gov/health/noni",
  "noni-tahitian": "https://www.nccih.nih.gov/health/noni",
  "corynanthe-yohimbe": "https://www.nccih.nih.gov/health/yohimbe",
  cranberry: "https://www.nccih.nih.gov/health/cranberry",
  curcumin: "https://www.nccih.nih.gov/health/turmeric",
  dandelion: "https://www.nccih.nih.gov/health/dandelion",
  echinacea: "https://www.nccih.nih.gov/health/echinacea",
  "echinacea-angustifolia": "https://www.nccih.nih.gov/health/echinacea",
  "echinacea-pallida": "https://www.nccih.nih.gov/health/echinacea",
  elderberry: "https://www.nccih.nih.gov/health/elderberry",
  "ephedra-sinica": "https://www.nccih.nih.gov/health/ephedra",
  "european-mistletoe": "https://www.nccih.nih.gov/health/european-mistletoe",
  "evening-primrose": "https://www.nccih.nih.gov/health/evening-primrose-oil",
  fenugreek: "https://www.nccih.nih.gov/health/fenugreek",
  feverfew: "https://www.nccih.nih.gov/health/feverfew",
  "flaxseed-oil-herb":
    "https://www.nccih.nih.gov/health/flaxseed-and-flaxseed-oil",
  garcinia: "https://www.nccih.nih.gov/health/garcinia-cambogia",
  "garcinia-gummi-gutta": "https://www.nccih.nih.gov/health/garcinia-cambogia",
  garlic: "https://www.nccih.nih.gov/health/garlic",
  ginger: "https://www.nccih.nih.gov/health/ginger",
  ginkgo: "https://www.nccih.nih.gov/health/ginkgo",
  "ginkgo-biloba": "https://www.nccih.nih.gov/health/ginkgo",
  ginseng: "https://www.nccih.nih.gov/health/asian-ginseng",
  goldenseal: "https://www.nccih.nih.gov/health/goldenseal",
  "grape-seed": "https://www.nccih.nih.gov/health/grape-seed-extract",
  "green-tea": "https://www.nccih.nih.gov/health/green-tea",
  hawthorn: "https://www.nccih.nih.gov/health/hawthorn",
  "holy-basil": "https://www.nccih.nih.gov/health/holy-basil",
  hoodia: "https://www.nccih.nih.gov/health/hoodia",
  "horse-chestnut": "https://www.nccih.nih.gov/health/horse-chestnut",
  kava: "https://www.nccih.nih.gov/health/kava",
  kratom: "https://www.nccih.nih.gov/health/kratom",
  lavender: "https://www.nccih.nih.gov/health/lavender",
  "licorice-root": "https://www.nccih.nih.gov/health/licorice-root",
  "milk-thistle": "https://www.nccih.nih.gov/health/milk-thistle",
  "mugwort-european": "https://www.nccih.nih.gov/health/mugwort",
  "mulberry-leaf": "https://www.nccih.nih.gov/health/white-mulberry-leaf",
  passionflower: "https://www.nccih.nih.gov/health/passionflower",
  peppermint: "https://www.nccih.nih.gov/health/peppermint-oil",
  "pomegranate-peel": "https://www.nccih.nih.gov/health/pomegranate",
  "red-clover": "https://www.nccih.nih.gov/health/red-clover",
  "red-yeast-rice": "https://www.nccih.nih.gov/health/red-yeast-rice",
  rhodiola: "https://www.nccih.nih.gov/health/rhodiola",
  sage: "https://www.nccih.nih.gov/health/sage",
  "saw-palmetto": "https://www.nccih.nih.gov/health/saw-palmetto",
  "st-johns-wort": "https://www.nccih.nih.gov/health/st-johns-wort",
  "tea-tree": "https://www.nccih.nih.gov/health/tea-tree-oil",
  "tripterygium-wilfordii": "https://www.nccih.nih.gov/health/thunder-god-vine",
  turmeric: "https://www.nccih.nih.gov/health/turmeric",
  valerian: "https://www.nccih.nih.gov/health/valerian",
  vitex: "https://www.nccih.nih.gov/health/chasteberry",
};

/**
 * Direct EMA HMPC final monograph PDFs mapped by HerbAlly slug so pages with
 * an active EU herbal monograph do not display "no government monograph matched".
 */
const EMA_DIRECT: Record<string, string> = {
  "agrimonia-eupatoria-herb":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-agrimonia-eupatoria-l-herba-first-version_en.pdf",
  "aloe-vera":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-aloe-barbadensis-mill-and-aloe-various-species-mainly-aloe-ferox-mill-and-its-hybrids-folii-succus-siccatus_en.pdf",
  "aloe-vera-leaf":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-aloe-barbadensis-mill-and-aloe-various-species-mainly-aloe-ferox-mill-and-its-hybrids-folii-succus-siccatus_en.pdf",
  "anise-green":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-pimpinella-anisum-l-fructus_en.pdf",
  arnica:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-arnica-montana-l-flos_en.pdf",
  artichoke:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-cynara-cardunculus-l-syn-cynara-scolymus-l-folium_en.pdf",
  "asteraceae-blessed-thistle":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-cnicus-benedictus-l-herba_en.pdf",
  "betula-pendula-bark":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-betula-pendula-roth-betula-pubescens-ehrh-folium_en.pdf",
  "betula-pubescens":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-betula-pendula-roth-betula-pubescens-ehrh-folium_en.pdf",
  bilberry:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-vaccinium-myrtillus-l-fructus-recens_en.pdf",
  "bittersweet-nightshade":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/draft-community-herbal-monograph-solanum-dulcamara-l-stipites_en.pdf",
  "boldo-leaf":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-peumus-boldus-molina-folium_en.pdf",
  "butchers-broom":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-ruscus-aculeatus-l-rhizoma-revision-1_en.pdf",
  calendula:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-calendula-officinalis-l-flos-revision-1_en.pdf",
  "carum-carvi-herb":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-carum-carvi-l-fructus_en.pdf",
  "cassia-acutifolia":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-senna-alexandrina-mill-cassia-senna-l-cassia-angustifolia-vahl-folium-revision-1_en.pdf",
  "chamomile-roman":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-chamaemelum-nobile-l-all-flos_en.pdf",
  chamomile:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-matricaria-recutita-l-flos-first-version_en.pdf",
  chicory:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-cichorium-intybus-l-radix_en.pdf",
  cinnamon:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/community-herbal-monograph-cinnamomum-verum-js-presl-cortex_en.pdf",
  clove:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-syzygium-aromaticum-l-merill-et-l-m-perry-floris-aetheroleum_en.pdf",
  comfrey:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-symphytum-officinale-l-radix_en.pdf",
  "commiphora-molmol":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-commiphora-molmol-engler-gummi-resina_en.pdf",
  cowslip:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-thymus-vulgaris-l-and-thymus-zygis-l-herba-and-primula-veris-l-and-primula-elatior-l-hill-radix_en.pdf",
  cranberry:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-vaccinium-macrocarpon-aiton-fructus_en.pdf",
  curcumin:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-curcuma-longa-l-rhizoma-revision-1_en.pdf",
  dandelion:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-taraxacum-officinale-weber-ex-wigg-folium_en.pdf",
  "devils-claw":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-harpagophytum-procumbens-dc-andor-harpagophytum-zeyheri-decne-radix_en.pdf",
  "echinacea-angustifolia":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-echinacea-angustifolia-dc-radix_en.pdf",
  echinacea:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-onechinacea-purpurea-l-moench-radix-revision-1_en.pdf",
  elderflower:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-sambucus-nigra-l-flos-revision-1_en.pdf",
  eleuthero:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-eleutherococcus-senticosus-rupr-et-maxim-maxim-radix_en.pdf",
  "epilobium-angustifolium":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-epilobium-angustifolium-l-andor-epilobium-parviflorum-schreb-herba_en.pdf",
  eucalyptus:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-eucalyptus-globulus-labill-folium_en.pdf",
  "evening-primrose":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-oenothera-biennis-l-oenothera-lamarckiana-l-oleum-revision-1_en.pdf",
  fennel:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-foeniculum-vulgare-miller-subsp-vulgare-var-dulce-mill-batt-trab-fructus-revision-1_en.pdf",
  fenugreek:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/european-union-herbal-monograph-trigonella-foenum-graecum-l-semen-revision-1_en.pdf",
  feverfew:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-tanacetum-parthenium-l-schulz-bip-herba-revision-1_en.pdf",
  "frangula-purshiana":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-rhamnus-purshiana-dc-cortex-revision-1_en.pdf",
  "fraxinus-excelsior-herb":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-fraxinus-excelsior-l-or-fraxinus-angustifolia-vahl-folium_en.pdf",
  "fumitory-herb":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-fumaria-officinalis-l-herba-revision-1_en.pdf",
  garlic:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-allium-sativum-l-bulbus_en.pdf",
  ginger:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-zingiber-officinale-roscoe-rhizoma-revision-1_en.pdf",
  ginkgo:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-ginkgo-biloba-l-folium_en.pdf",
  "ginkgo-biloba":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-ginkgo-biloba-l-folium_en.pdf",
  ginseng:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-panax-ginseng-camey-radix-revision-1_en.pdf",
  "goldenrod-solidago":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-solidago-virgaurea-l-herba_en.pdf",
  "gotu-kola":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/european-union-herbal-monograph-centella-asiatica-l-urb-herba-revision-1_en.pdf",
  "grindelia-herb":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-grindelia-robusta-nutt-grindelia-squarrosa-pursh-dunal-grindelia-humilis-hook-et-arn-grindelia-camporum-greene-herba_en.pdf",
  "guarana-seed":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-paullinia-cupana-kunth-ex-hbk-var-sorbilis-mart-ducke-semen_en.pdf",
  hawthorn:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-crataegus-spp-folium-cum-flore_en.pdf",
  "hedera-helix":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-hedera-helix-l-folium-revision-2_en.pdf",
  "hieracium-pilosella":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-pilosella-officinarum-vall-syn-hieracium-pilosella-l-herba-cum-radice-revision-1_en.pdf",
  hops: "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-humulus-lupulus-l-flos-revision-1_en.pdf",
  "iceland-moss":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-cetraria-islandica-l-acharius-sl-thallus-first-version_en.pdf",
  "juglans-regia-herb":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-juglans-regia-l-folium_en.pdf",
  "juniper-communis":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-juniperus-communis-l-aetheroleum_en.pdf",
  "kola-nut":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-cola-nitida-vent-schott-et-endl-and-its-varieties-and-cola-acuminata-p-beauv-schott-et-endl-semen_en.pdf",
  lavender:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-lavandula-angustifolia-miller-aetheroleum_en.pdf",
  "lemon-verbena":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-aloysia-citrodora-palau-syn-aloysia-triphylla-lher-kuntze-verbena-triphylla-lher-lippia-citriodora-kunth-folium_en.pdf",
  "licorice-root":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-glycyrrhiza-glabra-l-glycyrrhiza-inflata-bat-glycyrrhiza-uralensis-fisch-radix-revision-1_en.pdf",
  mallow:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-malva-sylvestris-l-flos-first-version_en.pdf",
  marjoram:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-origanum-majorana-l-herba_en.pdf",
  "matricaria-recutita":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-matricaria-recutita-l-flos-first-version_en.pdf",
  melilot:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-melilotus-officinalis-l-lam-herba_en.pdf",
  "menyanthes-trifoliata":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-menyanthes-trifoliata-l-folium_en.pdf",
  "milk-thistle":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-silybum-marianum-l-gaertn-fructus_en.pdf",
  "misai-kucing":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/european-union-herbal-monograph-orthosiphon-aristatus-blume-miq-var-aristatus-folium-revision-1_en.pdf",
  "motherwort-european":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-leonurus-cardiaca-l-herba_en.pdf",
  mullein:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-verbascum-thapsus-l-v-densiflorum-bertol-v-thapsiforme-schrad-and-v-phlomoides-l-flos_en.pdf",
  myrrh:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-commiphora-molmol-engler-gummi-resina_en.pdf",
  nettle:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-urtica-dioica-l-urtica-urens-l-herba-revision-1_en.pdf",
  "nettle-leaf":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-urtica-dioica-l-urtica-urens-l-herba-revision-1_en.pdf",
  "nettle-root":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-urtica-dioica-l-urtica-urens-l-radix-revision-1_en.pdf",
  "oat-straw":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-avena-sativa-l-herba_en.pdf",
  "olive-leaf":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-olea-europaea-l-folium-first-version_en.pdf",
  "phaseolus-vulgaris":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-phaseolus-vulgaris-l-fructus-sine-semine_en.pdf",
  "plantago-lanceolata":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-plantaginis-lanceolatae-folium-revision-1_en.pdf",
  plantain:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-plantaginis-lanceolatae-folium-revision-1_en.pdf",
  psyllium:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-plantago-ovata-forssk-seminis-tegumentum_en.pdf",
  "pumpkin-seed":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-cucurbita-pepo-l-semen_en.pdf",
  restharrow:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-ononis-spinosa-l-radix_en.pdf",
  "rhamnus-frangula":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/european-union-herbal-monograph-rhamnus-frangula-l-cortex-revision-1_en.pdf",
  "rhamnus-purshiana":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-rhamnus-purshiana-dc-cortex-revision-1_en.pdf",
  "rheum-officinale":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-rheum-palmatum-l-and-rheum-officinale-baillon-radix-revision-1_en.pdf",
  rhodiola:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-rhodiola-rosea-l-rhizoma-et-radix-revision-1_en.pdf",
  "ribes-nigrum":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-ribes-nigrum-l-folium_en.pdf",
  "rose-petal":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-rosa-gallica-l-rosa-centifolia-l-rosa-damascena-mill-flos_en.pdf",
  rosemary:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-rosmarinus-officinalis-l-folium-revision-1_en.pdf",
  rupturewort:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-herniaria-glabra-l-h-hirsuta-l-h-incana-lam-herba_en.pdf",
  "senna-leaf":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-senna-alexandrina-mill-cassia-senna-l-cassia-angustifolia-vahl-folium-revision-1_en.pdf",
  "siberian-ginseng":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-eleutherococcus-senticosus-rupr-et-maxim-maxim-radix_en.pdf",
  sideritis:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-sideritis-scardica-griseb-sideritis-clandestina-bory-chaub-hayek-sideritis-raeseri-boiss-heldr-sideritis-syriaca-l-herba_en.pdf",
  "st-johns-wort":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-hypericum-perforatum-l-herba-revision-1_en.pdf",
  thyme:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-thymus-vulgaris-l-and-thymus-zygis-l-herba_en.pdf",
  "tilia-cordata-herb":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-tilia-cordata-miller-tilia-platyphyllos-scop-tilia-x-vulgaris-heyne-or-their-mixtures-flos-first-version_en.pdf",
  turmeric:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-curcuma-longa-l-rhizoma-revision-1_en.pdf",
  valerian:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-valeriana-officinalis-l-radix_en.pdf",
  "viola-tricolor-herb":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-viola-tricolor-l_en.pdf",
  vitex:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-vitex-agnus-castus-l-fructus-revision-1_en.pdf",
  "white-horehound-root":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-marrubium-vulgare-l-herba-first-version_en.pdf",
  "white-willow":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-salix-various-species-including-s-purpurea-l-s-daphnoides-vill-s-fragilis-l-cortex_en.pdf",
  "wild-strawberry":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-fragaria-vesca-l-fragaria-moschata-weston-fragaria-viridis-weston-and-fragaria-x-ananassa-weston-duchesne-ex-rozier-folium_en.pdf",
  "witch-hazel":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-hamamelis-virginiana-l-folium_en.pdf",
  wormwood:
    "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-artemisia-absinthium-l-herba_en.pdf",
  "yellow-gentian-root":
    "https://www.ema.europa.eu/en/documents/herbal-monograph/european-herbal-monograph-gentiana-lutea-l-radix-revision-1_en.pdf",
};

/**
 * Direct Health Canada NHP Ingredient Monograph URLs mapped by slug.
 */
const HC_DIRECT: Record<string, string> = {
  "agaricus-blazei":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_mushrooms_en.pdf",
  "american-ginseng":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=ginseng.american2&lang=eng",
  amorphophallus:
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=glucomannan&lang=eng",
  "angelica-root":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_angelica_english.pdf",
  "blueberry-leaf":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=blueberry.bleuet2&lang=eng",
  burdock:
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=burdock.bardane.oral2&lang=eng",
  "burdock-seed":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=burdock.bardane.oral2&lang=eng",
  chaga:
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_mushrooms_en.pdf",
  chlorella:
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=chlorella.vulgaris2&lang=eng",
  cordyceps:
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_mushrooms_en.pdf",
  "dong-quai":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_dong-quai--angelica-sinensis_english.pdf",
  glucomannan:
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=glucomannan&lang=eng",
  goldenseal:
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_goldenseal--oral_english.pdf",
  "grape-seed":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_grape-seed-extract_english.pdf",
  "griffonia-simplicifolia":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=5htp&lang=eng",
  "holy-basil":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_holy-basil--ocimum-tenuliflorum--leaf_english.pdf",
  "lemon-balm":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=lemon.balm&lang=eng",
  "lions-mane":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_mushrooms_en.pdf",
  maca: "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=maca.lepidium.meyenii2&lang=eng",
  maitake:
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_mushrooms_en.pdf",
  "marshmallow-root":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=marshmallow.leaf.guimauve.feuille2&lang=eng",
  "medicago-sativa":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=alfalfa2&lang=eng",
  passionflower:
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=passionflower.passiflore&lang=eng",
  pygeum: "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=pygeum&lang=eng",
  reishi:
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_mushrooms_en.pdf",
  sage: "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_Sage_Oral_EN.pdf",
  serrapeptase:
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=serrapeptase2&lang=eng",
  shiitake:
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_mushrooms_en.pdf",
  "tongkat-ali":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=tongkat.ali&lang=eng",
  "turkey-tail":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_mushrooms_en.pdf",
  "uva-ursi":
    "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=arctostaphylos.uva.ursi2&lang=eng",
};

function isHttpUrl(url: string | null | undefined): url is string {
  return Boolean(url && /^https?:\/\//i.test(url.trim()));
}

function getDirectMonographMeta(
  source: string,
  fr: boolean
): { id: string; label: string } | null {
  switch (source) {
    case "European Medicines Agency (HMPC)":
    case "EMA":
    case "EMA HMPC":
      return {
        id: "ema",
        label: fr
          ? "EMA HMPC — Monographie européenne"
          : "EMA HMPC — EU Herbal Monograph",
      };
    case "Health Canada":
    case "Health Canada NHP":
      return {
        id: "health-canada",
        label: fr
          ? "Santé Canada — Monographie PSN"
          : "Health Canada — NHP Monograph",
      };
    case "LiverTox":
      return { id: "livertox", label: "LiverTox (NIH/NIDDK)" };
    case "NCCIH":
      return { id: "nccih", label: "NCCIH (NIH) — Herbs at a Glance" };
    case "WHO":
    case "WHO Monographs":
      return {
        id: "who",
        label: fr
          ? "OMS — Monographie sur les plantes médicinales"
          : "WHO — Medicinal Plant Monograph",
      };
    default:
      return null;
  }
}

function extractDirectDbMonographs(
  monographSources: MonographSourceRef[] | undefined,
  fr: boolean
): GovSource[] {
  if (!monographSources || monographSources.length === 0) return [];
  const seen = new Set<string>();
  const direct: GovSource[] = [];
  for (const row of monographSources) {
    if (!isHttpUrl(row.url)) continue;
    const meta = getDirectMonographMeta(row.source, fr);
    if (!meta || seen.has(meta.id)) continue;
    seen.add(meta.id);
    direct.push({
      id: meta.id,
      label: meta.label,
      url: row.url.trim(),
      kind: "monograph",
      authoritative: true,
    });
  }
  return direct;
}

/**
 * Resolve the authoritative government sources for a herb.
 *
 * @param slug herb database slug
 * @param displayName herb common name (used to build always-resolving search links)
 * @param locale UI locale
 * @param monographSources imported monograph source rows attached to this herb
 * @returns ordered list: direct monograph links first, then search/index fallbacks
 */
export function getGovSources(
  slug: string,
  displayName?: string,
  locale: "en" | "fr" = "en",
  monographSources?: MonographSourceRef[]
): GovSource[] {
  const fr = locale === "fr";
  const out: GovSource[] = [];
  const query = encodeURIComponent(displayName ?? slug.replace(/-/g, " "));
  const seenIds = new Set<string>();

  const nccihDirectUrl = NCCIH_DIRECT[slug];
  if (nccihDirectUrl) {
    out.push({
      id: "nccih",
      label: "NCCIH (NIH) — Herbs at a Glance",
      url: nccihDirectUrl,
      kind: "monograph",
      authoritative: true,
    });
    seenIds.add("nccih");
  }

  for (const row of extractDirectDbMonographs(monographSources, fr)) {
    if (seenIds.has(row.id)) continue;
    out.push(row);
    seenIds.add(row.id);
  }

  const emaDirectUrl = EMA_DIRECT[slug];
  if (emaDirectUrl && !seenIds.has("ema")) {
    out.push({
      id: "ema",
      label: fr
        ? "EMA HMPC — Monographie européenne"
        : "EMA HMPC — EU Herbal Monograph",
      url: emaDirectUrl,
      kind: "monograph",
      authoritative: true,
    });
    seenIds.add("ema");
  }

  const hcDirectUrl = HC_DIRECT[slug];
  if (hcDirectUrl && !seenIds.has("health-canada")) {
    out.push({
      id: "health-canada",
      label: fr
        ? "Santé Canada — Monographie PSN"
        : "Health Canada — NHP Monograph",
      url: hcDirectUrl,
      kind: "monograph",
      authoritative: true,
    });
    seenIds.add("health-canada");
  }

  if (!seenIds.has("nccih")) {
    // No direct page verified — offer a search that always resolves.
    out.push({
      id: "nccih",
      label: fr ? "Rechercher dans NCCIH (NIH)" : "Search NCCIH (NIH)",
      url: `https://www.nccih.nih.gov/search?query=${query}`,
      kind: "search",
      authoritative: false,
    });
  }

  out.push({
    id: "medlineplus",
    label: fr
      ? "Rechercher dans MedlinePlus (NIH)"
      : "Search MedlinePlus (NIH)",
    url: `https://vsearch.nlm.nih.gov/vivisimo/cgi-bin/query-meta?v%3Aproject=medlineplus&query=${query}`,
    kind: "search",
    authoritative: false,
  });

  // General authoritative indexes (no per-herb page; always relevant).
  out.push({
    id: "ods",
    label: GOV_SOURCES.ods.label,
    url: GOV_SOURCES.ods.indexUrl,
    kind: "index",
    authoritative: false,
  });
  if (!seenIds.has("ema")) {
    out.push({
      id: "ema",
      label: GOV_SOURCES.ema.label,
      url: GOV_SOURCES.ema.indexUrl,
      kind: "index",
      authoritative: false,
    });
  }
  if (!seenIds.has("who")) {
    out.push({
      id: "who",
      label: GOV_SOURCES.who.label,
      url: GOV_SOURCES.who.indexUrl,
      kind: "index",
      authoritative: false,
    });
  }

  return out;
}

/** True when at least one direct government monograph page is mapped. */
export function hasGovMonograph(
  slug: string,
  monographSources?: MonographSourceRef[]
): boolean {
  return (
    Boolean(NCCIH_DIRECT[slug]) ||
    Boolean(EMA_DIRECT[slug]) ||
    Boolean(HC_DIRECT[slug]) ||
    extractDirectDbMonographs(monographSources, false).length > 0
  );
}
