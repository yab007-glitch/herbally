# HerbAlly Safety, Dosage, and Citation Review Lists (2026-11-23)

Generated from production Postgres (`herbs`, `herb_pubmed_monographs`, `herb_regulatory_evidence`, `herb_monograph_sources`).
Per owner policy, no side effects, contraindications, citations, or numeric doses were fabricated.

---

## Task 3 — Non-Numeric (404) & Missing (217) Adult Doses Summary

| Category                                                                                                                                      |   Count | Action                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------: | ------------------------------------------------------------------------------------------ |
| Toxic / contraindicated / medical-supervision-only warnings                                                                                   |     168 | Left intact                                                                                |
| Topical / aromatherapy / external-only instructions                                                                                           |      71 | Left intact (legitimate per brief)                                                         |
| Culinary / food or food+topical preparations                                                                                                  |      70 | Left intact                                                                                |
| Pharmaceutical / homeopathic / ceremonial contexts                                                                                            |      27 | Left intact                                                                                |
| Mixed topical + traditional oral preparations                                                                                                 |      23 | Left intact                                                                                |
| Already states no established medicinal/standard dose                                                                                         |      13 | Left EN intact; fixed broken FR on `lactoris-fernandeziana` & `dioscoreophyllum-cumminsii` |
| Vague placeholders (e.g. `as directed`, `Consult practitioner`, `Traditional use only`, unquantified Kampo)                                   |      12 | Replaced with `No standard adult dose is established in the reviewed sources.` (EN + FR)   |
| Other verified non-numeric contextual statements (e.g. `No standardized safe modern oral dose...`, specific non-numeric preparation guidance) |      20 | Left intact                                                                                |
| **Total non-numeric adult doses**                                                                                                             | **404** | **12 EN+FR updated (+2 FR-only fixes)**                                                    |

- **Missing adult doses (`217` published herbs):** `0` have regulatory doses in `herb_regulatory_evidence`, `0` have doses in `herb_monograph_sources`, `214` have a `herb_pubmed_monographs` row (1 has `dosage_forms`). Left `dosage_adult` NULL rather than inventing numbers.

---

## Task 4 — Published Herbs with No Structured `side_effects` (263)

- **Total:** 263
- **Already have non-placeholder safety text elsewhere on page** (real PubMed `safetyAndAdverseEffects`, Health Canada `risks`, or `herb_monograph_sources.safety`): **5**
- **No structured `side_effects` and no non-placeholder safety text in PubMed/regulatory/monograph tables:** **258**

### 4A. No `side_effects` — Safety Text Already Displayed Elsewhere (5)

| Views | Slug                                                     | Name                                                   | Evidence | PubMed Safety | Reg Risks | Monograph Safety |
| ----: | -------------------------------------------------------- | ------------------------------------------------------ | -------- | :-----------: | :-------: | :--------------: |
|     0 | `eriocaulon-buergerianum`                                | Buerger’s Pipewort                                     | C        |      No       |    Yes    |        No        |
|     0 | `salvia-chinensis`                                       | Salvia chinensis                                       | trad     |      Yes      |    No     |        No        |
|     0 | `erodium-stephanianum`                                   | Stephan’s Stork’s-bill                                 | C        |      No       |    Yes    |        No        |
|     0 | `microcos-paniculata`                                    | Microcos                                               | C        |      No       |    Yes    |        No        |
|     0 | `sophora-japonica-quercetin-phosphatidylcholine-complex` | Sophora japonica Quercetin-Phosphatidylcholine complex | C        |      No       |    No     |       Yes        |

### 4B. No `side_effects` — Needs Human Safety Sourcing (258)

| Views | Slug                                           | Name                                           | Scientific Name                                  | Evidence |
| ----: | ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ | -------- |
|     0 | `ceratostigma-willmottianum`                   | Ceratostigma willmottianum                     | _Ceratostigma willmottianum_                     | C        |
|     0 | `stellaria-dichotoma-var-lanceolata`           | Stellaria dichotoma var. lanceolata            | _Stellaria dichotoma var. lanceolata_            | C        |
|     0 | `acer-campestre`                               | Acer campestre                                 | _Acer campestre_                                 | C        |
|     0 | `dioscorea-futschauensis`                      | Dioscorea futschauensis                        | _Dioscorea futschauensis_                        | C        |
|     0 | `citrullus-lanatus-var-lanatus`                | Citrullus lanatus var lanatus                  | _Citrullus lanatus var lanatus_                  | C        |
|     0 | `quercus-pedunculata`                          | Quercus pedunculata                            | _Quercus pedunculata_                            | C        |
|     0 | `crataegus-cuneata`                            | Crataegus cuneata                              | _Crataegus cuneata_                              | C        |
|     0 | `elettaria-cardamomum-var-cardamomum`          | Elettaria cardamomum var. cardamomum           | _Elettaria cardamomum var. cardamomum_           | C        |
|     0 | `biota-orientalis`                             | Biota orientalis                               | _Biota orientalis_                               | C        |
|     0 | `foeniculum-vulgare-subsp-vulgare-var-dulce`   | Foeniculum vulgare subsp. vulgare var. dulce   | _Foeniculum vulgare subsp. vulgare var. dulce_   | C        |
|     0 | `cineraria-maritima`                           | Cineraria maritima                             | _Cineraria maritima_                             | C        |
|     0 | `paris-polyphylla-var-chinensis`               | Paris polyphylla var. chinensis                | _Paris polyphylla var. chinensis_                | C        |
|     0 | `gentianella-amarella`                         | Gentianella amarella                           | _Gentianella amarella_                           | C        |
|     0 | `eugenia-jambos`                               | Eugenia jambos                                 | _Eugenia jambos_                                 | C        |
|     0 | `sauromatum-giganteum`                         | Sauromatum giganteum                           | _Sauromatum giganteum_                           | trad     |
|     0 | `blainvillea-acmella`                          | Blainvillea acmella                            | _Blainvillea acmella_                            | C        |
|     0 | `vigna-angularis`                              | Vigna angularis                                | _Vigna angularis_                                | trad     |
|     0 | `bromus-ramosus`                               | Bromus ramosus                                 | _Bromus ramosus_                                 | C        |
|     0 | `alyxia-sinensis`                              | Alyxia sinensis                                | _Alyxia sinensis_                                | C        |
|     0 | `callerya-speciosa`                            | Callerya speciosa                              | _Callerya speciosa_                              | C        |
|     0 | `callicarpa-macrophylla`                       | Callicarpa macrophylla                         | _Callicarpa macrophylla_                         | C        |
|     0 | `helonias-dioica`                              | Helonias dioica                                | _Helonias dioica_                                | C        |
|     0 | `tuber-melanosporum`                           | Tuber melanosporum                             | _Tuber melanosporum_                             | C        |
|     0 | `gentiana-manshurica`                          | Gentiana manshurica                            | _Gentiana manshurica_                            | trad     |
|     0 | `ligusticum-sinense-var-sinense`               | Ligusticum sinense var. sinense                | _Ligusticum sinense var. sinense_                | C        |
|     0 | `lonicera-nigra`                               | Lonicera nigra                                 | _Lonicera nigra_                                 | C        |
|     0 | `anemone-altaica`                              | Anemone altaica                                | _Anemone altaica_                                | C        |
|     0 | `citrus-grandis`                               | Citrus grandis                                 | _Citrus grandis_                                 | C        |
|     0 | `scaphium-lychnophorum`                        | Scaphium lychnophorum                          | _Scaphium lychnophorum_                          | C        |
|     0 | `sparganium-eurycarpum`                        | Sparganium eurycarpum                          | _Sparganium eurycarpum_                          | trad     |
|     0 | `agropyron-repens`                             | Agropyron repens                               | _Agropyron repens_                               | C        |
|     0 | `impatiens-glandulifera`                       | Impatiens glandulifera                         | _Impatiens glandulifera_                         | C        |
|     0 | `amomum-longiligulare`                         | Amomum longiligulare                           | _Amomum longiligulare_                           | C        |
|     0 | `dendrobium-chrysanthum`                       | Dendrobium chrysanthum                         | _Dendrobium chrysanthum_                         | C        |
|     0 | `euglena-gracilis`                             | Euglena gracilis                               | _Euglena gracilis_                               | C        |
|     0 | `flemingia-prostrata`                          | Flemingia prostrata                            | _Flemingia prostrata_                            | trad     |
|     0 | `brassica-oleracea-var-gemmifera`              | Brassica oleracea var. gemmifera               | _Brassica oleracea var. gemmifera_               | C        |
|     0 | `capsicum-annuum-var-annuum`                   | Capsicum annuum var. annuum                    | _Capsicum annuum var. annuum_                    | C        |
|     0 | `franciscea-uniflora`                          | Franciscea uniflora                            | _Franciscea uniflora_                            | C        |
|     0 | `penicillium-chrysogenum-e-volumine-cellulae`  | Penicillium chrysogenum e volumine cellulae    | _Penicillium chrysogenum e volumine cellulae_    | C        |
|     0 | `helianthemum-nummularium`                     | Helianthemum nummularium                       | _Helianthemum nummularium_                       | C        |
|     0 | `triticum-aestivum-subsp-spelta`               | Triticum aestivum subsp. spelta                | _Triticum aestivum subsp. spelta_                | C        |
|     0 | `bacopa-monnieria`                             | Bacopa monnieria                               | _Bacopa monnieria_                               | C        |
|     0 | `wurfbainia-vera`                              | Wurfbainia vera                                | _Wurfbainia vera_                                | trad     |
|     0 | `cedrus-libani`                                | Cedrus libani                                  | _Cedrus libani_                                  | C        |
|     0 | `jasminum-officinale`                          | Jasminum officinale                            | _Jasminum officinale_                            | C        |
|     0 | `ligusticum-jeholense`                         | Ligusticum jeholense                           | _Ligusticum jeholense_                           | C        |
|     0 | `bambusa-tuldoides`                            | Bambusa tuldoides                              | _Bambusa tuldoides_                              | C        |
|     0 | `lithothamnium-calcareum`                      | Lithothamnium calcareum                        | _Lithothamnium calcareum_                        | C        |
|     0 | `magnolia-officinalis-var-biloba`              | Magnolia officinalis var. biloba               | _Magnolia officinalis var. biloba_               | C        |
|     0 | `mucor-racemosus-e-volumine-cellulae`          | Mucor racemosus e volumine cellulae            | _Mucor racemosus e volumine cellulae_            | C        |
|     0 | `cynanchum-atratum`                            | Cynanchum atratum                              | _Cynanchum atratum_                              | C        |
|     0 | `omphalia-lapidescens`                         | Omphalia lapidescens                           | _Omphalia lapidescens_                           | C        |
|     0 | `atractylodes-chinensis`                       | Atractylodes chinensis                         | _Atractylodes chinensis_                         | C        |
|     0 | `paris-chinensis`                              | Paris chinensis                                | _Paris chinensis_                                | trad     |
|     0 | `alpinia-hainanensis`                          | Alpinia hainanensis                            | _Alpinia hainanensis_                            | trad     |
|     0 | `physochlaina-infundibularis`                  | Physochlaina infundibularis                    | _Physochlaina infundibularis_                    | C        |
|     0 | `rubus-arcticus`                               | Rubus arcticus                                 | _Rubus arcticus_                                 | C        |
|     0 | `camellia-sinensis-purple-tea-cultivar`        | Camellia sinensis (purple tea cultivar)        | _Camellia sinensis (purple tea cultivar)_        | C        |
|     0 | `prunus-japonica`                              | Prunus japonica                                | _Prunus japonica_                                | C        |
|     0 | `sambucus-chinensis`                           | Sambucus chinensis                             | _Sambucus chinensis_                             | C        |
|     0 | `sargentodoxa-cuneata`                         | Sargentodoxa cuneata                           | _Sargentodoxa cuneata_                           | trad     |
|     0 | `bergera-koenigii`                             | Bergera koenigii                               | _Bergera koenigii_                               | C        |
|     0 | `selaginella-pulvinata`                        | Selaginella pulvinata                          | _Selaginella pulvinata_                          | C        |
|     0 | `solanum-lasiocarpum`                          | Solanum lasiocarpum                            | _Solanum lasiocarpum_                            | C        |
|     0 | `brassaiopsis-glomerulata`                     | Brassaiopsis glomerulata                       | _Brassaiopsis glomerulata_                       | C        |
|     0 | `stereospermum-chelonoides`                    | Stereospermum chelonoides                      | _Stereospermum chelonoides_                      | C        |
|     0 | `styrax-tonkinensis`                           | Styrax tonkinensis                             | _Styrax tonkinensis_                             | C        |
|     0 | `brassica-oleracea-var-acephala`               | Brassica oleracea var. acephala                | _Brassica oleracea var. acephala_                | C        |
|     0 | `ananas-comosus-var-comosus`                   | Ananas comosus var. comosus                    | _Ananas comosus var. comosus_                    | C        |
|     0 | `tetrapanax-papyrifer`                         | Tetrapanax papyrifer                           | _Tetrapanax papyrifer_                           | C        |
|     0 | `teramnus-labialis`                            | Teramnus labialis                              | _Teramnus labialis_                              | C        |
|     0 | `teucrium-scorodonia`                          | Teucrium scorodonia                            | _Teucrium scorodonia_                            | C        |
|     0 | `pinus-montana`                                | Pinus montana                                  | _Pinus montana_                                  | C        |
|     0 | `typha-orientalis`                             | Typha orientalis                               | _Typha orientalis_                               | trad     |
|     0 | `usnea-filipendula`                            | Usnea filipendula                              | _Usnea filipendula_                              | C        |
|     0 | `veronica-virginica`                           | Veronica virginica                             | _Veronica virginica_                             | C        |
|     0 | `wurfbainia-longiligularis`                    | Wurfbainia longiligularis                      | _Wurfbainia longiligularis_                      | trad     |
|     0 | `vincetoxicum-pycnostelma`                     | Vincetoxicum pycnostelma                       | _Vincetoxicum pycnostelma_                       | C        |
|     0 | `vitis-vinifera-grape-seed-extract`            | Vitis vinifera (grape) seed extract            | _Vitis vinifera (grape) seed extract_            | C        |
|     0 | `wyethia-helenioides`                          | Wyethia helenioides                            | _Wyethia helenioides_                            | C        |
|     0 | `foeniculum-vulgare-subsp-vulgare-var-vulgare` | Foeniculum vulgare subsp. vulgare var. vulgare | _Foeniculum vulgare subsp. vulgare var. vulgare_ | C        |
|     0 | `cephalandra-indica`                           | Cephalandra indica                             | _Cephalandra indica_                             | C        |
|     0 | `fragaria-virginiana`                          | Fragaria virginiana                            | _Fragaria virginiana_                            | C        |
|     0 | `lycopodium-japonicum`                         | Lycopodium japonicum                           | _Lycopodium japonicum_                           | trad     |
|     0 | `agraphis-nutans`                              | Agraphis nutans                                | _Agraphis nutans_                                | C        |
|     0 | `brassica-oleracea-var-viridis`                | Brassica oleracea var. viridis                 | _Brassica oleracea var. viridis_                 | C        |
|     0 | `clematis-erecta`                              | Clematis erecta                                | _Clematis erecta_                                | C        |
|     0 | `cynanchum-glaucescens`                        | Cynanchum glaucescens                          | _Cynanchum glaucescens_                          | C        |
|     0 | `dolichos-pruriens`                            | Dolichos pruriens                              | _Dolichos pruriens_                              | C        |
|     0 | `hepatica-triloba`                             | Hepatica triloba                               | _Hepatica triloba_                               | C        |
|     0 | `hottonia-palustris`                           | Hottonia palustris                             | _Hottonia palustris_                             | C        |
|     0 | `phyllostachys-nigra-var-henonis`              | Phyllostachys nigra var. henonis               | _Phyllostachys nigra var. henonis_               | C        |
|     0 | `lactuca-quercina`                             | Lactuca quercina                               | _Lactuca quercina_                               | C        |
|     0 | `linum-usitatissimum-l-subsp-sativa`           | Linum usitatissimum L. subsp. sativa           | _Linum usitatissimum L. subsp. sativa_           | C        |
|     0 | `onosmodium-virginianum`                       | Onosmodium virginianum                         | _Onosmodium virginianum_                         | C        |
|     0 | `pinus-tabuliformis`                           | Pinus tabuliformis                             | _Pinus tabuliformis_                             | C        |
|     0 | `paeonia-obovata`                              | Paeonia obovata                                | _Paeonia obovata_                                | C        |
|     0 | `penthorum-sedoides`                           | Penthorum sedoides                             | _Penthorum sedoides_                             | C        |
|     0 | `phoenix-dactylifera`                          | Phoenix dactylifera                            | _Phoenix dactylifera_                            | C        |
|     0 | `raphanus-sativus-var-sativus`                 | Raphanus sativus var. sativus                  | _Raphanus sativus var. sativus_                  | C        |
|     0 | `rhus-aromatica`                               | Rhus aromatica                                 | _Rhus aromatica_                                 | C        |
|     0 | `salix-vitellina`                              | Salix vitellina                                | _Salix vitellina_                                | C        |
|     0 | `saccharomyces-boulardii-lyo`                  | Saccharomyces boulardii lyo                    | _Saccharomyces boulardii lyo_                    | C        |
|     0 | `sigesbeckia-glabrescens`                      | Sigesbeckia glabrescens                        | _Sigesbeckia glabrescens_                        | trad     |
|     0 | `rubus-loganobaccus`                           | Rubus loganobaccus                             | _Rubus loganobaccus_                             | C        |
|     0 | `spartium-scoparium`                           | Spartium scoparium                             | _Spartium scoparium_                             | C        |
|     0 | `spiranthes-autumnalis`                        | Spiranthes autumnalis                          | _Spiranthes autumnalis_                          | C        |
|     0 | `sticta-pulmonaria`                            | Sticta pulmonaria                              | _Sticta pulmonaria_                              | C        |
|     0 | `vaccaria-hispanica-subsp-hispanica`           | Vaccaria hispanica subsp. hispanica            | _Vaccaria hispanica subsp. hispanica_            | C        |
|     0 | `vitis-vinifera-var-tinctoria`                 | Vitis vinifera var. tinctoria                  | _Vitis vinifera var. tinctoria_                  | C        |
|     0 | `rubus-occidentalis`                           | Rubus occidentalis                             | _Rubus occidentalis_                             | C        |
|     0 | `conyza-canadensis`                            | Conyza canadensis                              | _Conyza canadensis_                              | C        |
|     0 | `stemona-japonica`                             | Stemona japonica                               | _Stemona japonica_                               | trad     |
|     0 | `amygdalus-persica`                            | Amygdalus persica                              | _Amygdalus persica_                              | C        |
|     0 | `erodium-cicutarium`                           | Erodium cicutarium                             | _Erodium cicutarium_                             | C        |
|     0 | `sambucus-nigra-subsp-canadensis`              | Sambucus nigra subsp. canadensis               | _Sambucus nigra subsp. canadensis_               | C        |
|     0 | `fragaria-chiloensis`                          | Fragaria chiloensis                            | _Fragaria chiloensis_                            | C        |
|     0 | `daucus-carota-subsp-carota`                   | Daucus carota subsp. carota                    | _Daucus carota subsp. carota_                    | C        |
|     0 | `pareira-brava`                                | Pareira brava                                  | _Pareira brava_                                  | C        |
|     0 | `gnaphalium-uliginosum`                        | Gnaphalium uliginosum                          | _Gnaphalium uliginosum_                          | C        |
|     0 | `hibiscus-mutabilis`                           | Hibiscus mutabilis                             | _Hibiscus mutabilis_                             | C        |
|     0 | `hieracium-pilosella`                          | Hieracium pilosella                            | _Hieracium pilosella_                            | C        |
|     0 | `ilex-asprella`                                | Ilex asprella                                  | _Ilex asprella_                                  | C        |
|     0 | `inula-cappa`                                  | Inula cappa                                    | _Inula cappa_                                    | C        |
|     0 | `kadsura-longipedunculata`                     | Kadsura longipedunculata                       | _Kadsura longipedunculata_                       | C        |
|     0 | `kunzea-ericoides-honey`                       | Kunzea ericoides honey                         | _Kunzea ericoides honey_                         | C        |
|     0 | `lepidium-apetalum`                            | Lepidium apetalum                              | _Lepidium apetalum_                              | C        |
|     0 | `lonicera-macranthoides`                       | Lonicera macranthoides                         | _Lonicera macranthoides_                         | C        |
|     0 | `majorana-hortensis`                           | Majorana hortensis                             | _Majorana hortensis_                             | C        |
|     0 | `nasturtium-aquaticum`                         | Nasturtium aquaticum                           | _Nasturtium aquaticum_                           | C        |
|     0 | `helianthus-tuberosus`                         | Helianthus tuberosus                           | _Helianthus tuberosus_                           | C        |
|     0 | `opuntia-vulgaris`                             | Opuntia vulgaris                               | _Opuntia vulgaris_                               | C        |
|     0 | `melicope-pteleifolia`                         | Melicope pteleifolia                           | _Melicope pteleifolia_                           | C        |
|     0 | `patrinia-villosa`                             | Patrinia villosa                               | _Patrinia villosa_                               | C        |
|     0 | `phragmites-communis`                          | Phragmites communis                            | _Phragmites communis_                            | C        |
|     0 | `pinus-contorta`                               | Pinus contorta                                 | _Pinus contorta_                                 | C        |
|     0 | `pinus-mugo`                                   | Pinus mugo                                     | _Pinus mugo_                                     | C        |
|     0 | `piper-wallichii`                              | Piper wallichii                                | _Piper wallichii_                                | C        |
|     0 | `pleione-bulbocodioides`                       | Pleione bulbocodioides                         | _Pleione bulbocodioides_                         | C        |
|     0 | `pothos-chinensis`                             | Pothos chinensis                               | _Pothos chinensis_                               | C        |
|     0 | `dendrobium-fimbriatum`                        | Dendrobium fimbriatum                          | _Dendrobium fimbriatum_                          | C        |
|     0 | `pulsatilla-nigricans`                         | Pulsatilla nigricans                           | _Pulsatilla nigricans_                           | C        |
|     0 | `pyrus-pyrifolia`                              | Pyrus pyrifolia                                | _Pyrus pyrifolia_                                | C        |
|     0 | `sarcandra-glabra`                             | Sarcandra glabra                               | _Sarcandra glabra_                               | trad     |
|     0 | `spirodela-polyrhiza`                          | Spirodela polyrhiza                            | _Spirodela polyrhiza_                            | trad     |
|     0 | `larix-laricina`                               | Larix laricina                                 | _Larix laricina_                                 | C        |
|     0 | `vitex-rotundifolia`                           | Vitex rotundifolia                             | _Vitex rotundifolia_                             | trad     |
|     0 | `oxydendrum-arboreum`                          | Oxydendrum arboreum                            | _Oxydendrum arboreum_                            | C        |
|     0 | `okoubaka-aubrevillei`                         | Okoubaka aubrevillei                           | _Okoubaka aubrevillei_                           | C        |
|     0 | `ulmus-fulva`                                  | Ulmus fulva                                    | _Ulmus fulva_                                    | C        |
|     0 | `nardostachys-chinensis`                       | Nardostachys chinensis                         | _Nardostachys chinensis_                         | C        |
|     0 | `castanea-vesca`                               | Castanea vesca                                 | _Castanea vesca_                                 | C        |
|     0 | `ampelopsis-quinquefolia`                      | Ampelopsis quinquefolia                        | _Ampelopsis quinquefolia_                        | C        |
|     0 | `abies-nigra`                                  | Abies nigra                                    | _Abies nigra_                                    | C        |
|     0 | `rhaponticum-uniflorum`                        | Rhaponticum uniflorum                          | _Rhaponticum uniflorum_                          | trad     |
|     0 | `agaricus-muscarius`                           | Agaricus muscarius                             | _Agaricus muscarius_                             | C        |
|     0 | `betula-lenta`                                 | Betula lenta                                   | _Betula lenta_                                   | C        |
|     0 | `candida-parapsilosis`                         | Candida parapsilosis                           | _Candida parapsilosis_                           | C        |
|     0 | `chelone-glabra`                               | Chelone glabra                                 | _Chelone glabra_                                 | C        |
|     0 | `lasiosphaera-fenzlii`                         | Lasiosphaera fenzlii                           | _Lasiosphaera fenzlii_                           | C        |
|     0 | `saxifraga-granulata`                          | Saxifraga granulata                            | _Saxifraga granulata_                            | C        |
|     0 | `sinapis-nigra`                                | Sinapis nigra                                  | _Sinapis nigra_                                  | C        |
|     0 | `sticta-pulmonacea`                            | Sticta pulmonacea                              | _Sticta pulmonacea_                              | C        |
|     0 | `ulmus-procera`                                | Ulmus procera                                  | _Ulmus procera_                                  | C        |
|     0 | `phyllostachys-nigra-var-nigra`                | Phyllostachys nigra var nigra                  | _Phyllostachys nigra var nigra_                  | C        |
|     0 | `uncaria-hirsuta`                              | Uncaria hirsuta                                | _Uncaria hirsuta_                                | trad     |
|     0 | `lycopus-lucidus-var-hirtus`                   | Lycopus lucidus var. hirtus                    | _Lycopus lucidus var. hirtus_                    | C        |
|     0 | `potentilla-discolor`                          | Potentilla discolor                            | _Potentilla discolor_                            | C        |
|     0 | `smilax-aristolochiifolia`                     | Smilax aristolochiifolia                       | _Smilax aristolochiifolia_                       | C        |
|     0 | `corydalis-turtschaninovii`                    | Corydalis turtschaninovii                      | _Corydalis turtschaninovii_                      | trad     |
|     0 | `sigesbeckia-orientalis`                       | Sigesbeckia orientalis                         | _Sigesbeckia orientalis_                         | C        |
|     0 | `flemingia-philippinensis`                     | Flemingia philippinensis                       | _Flemingia philippinensis_                       | C        |
|     0 | `anemone-chinensis`                            | Anemone chinensis                              | _Anemone chinensis_                              | C        |
|     0 | `fallopia-japonica`                            | Fallopia japonica                              | _Fallopia japonica_                              | C        |
|     0 | `rhamnus-californica`                          | Rhamnus californica                            | _Rhamnus californica_                            | C        |
|     0 | `prunus-humilis`                               | Prunus humilis                                 | _Prunus humilis_                                 | trad     |
|     0 | `homalomena-occulta`                           | Homalomena occulta                             | _Homalomena occulta_                             | trad     |
|     0 | `syzygium-jambolanum`                          | Syzygium jambolanum                            | _Syzygium jambolanum_                            | C        |
|     0 | `cornus-sanguinea`                             | Cornus sanguinea                               | _Cornus sanguinea_                               | C        |
|     0 | `turnera-diffusa-var-aphrodisiaca`             | Turnera diffusa var. aphrodisiaca              | _Turnera diffusa var. aphrodisiaca_              | C        |
|     0 | `dendrobium-loddigesii`                        | Dendrobium loddigesii                          | _Dendrobium loddigesii_                          | C        |
|     0 | `pyrola-calliantha`                            | Pyrola calliantha                              | _Pyrola calliantha_                              | trad     |
|     0 | `raphanus-sativus-var-niger`                   | Raphanus sativus var. niger                    | _Raphanus sativus var. niger_                    | C        |
|     0 | `lilium-tigrinum`                              | Lilium tigrinum                                | _Lilium tigrinum_                                | C        |
|     0 | `prunus-davidiana`                             | Prunus davidiana                               | _Prunus davidiana_                               | trad     |
|     0 | `trillium-pendulum`                            | Trillium pendulum                              | _Trillium pendulum_                              | C        |
|     0 | `sedum-sarmentosum`                            | Sedum sarmentosum                              | _Sedum sarmentosum_                              | C        |
|     0 | `iris-domestica`                               | Iris domestica                                 | _Iris domestica_                                 | trad     |
|     0 | `canarium-album`                               | Canarium album                                 | _Canarium album_                                 | trad     |
|     0 | `fritillaria-delavayi`                         | Fritillaria delavayi                           | _Fritillaria delavayi_                           | C        |
|     0 | `tylophora-indica`                             | Tylophora indica                               | _Tylophora indica_                               | C        |
|     0 | `polyporus-officinalis`                        | Polyporus officinalis                          | _Polyporus officinalis_                          | C        |
|     0 | `vincetoxicum-atratum`                         | Vincetoxicum atratum                           | _Vincetoxicum atratum_                           | trad     |
|     0 | `lilium-brownii-var-viridulum`                 | Lilium brownii var. viridulum                  | _Lilium brownii var. viridulum_                  | C        |
|     0 | `prunus-armeniaca-var-ansu`                    | Prunus armeniaca var. ansu                     | _Prunus armeniaca var. ansu_                     | C        |
|     0 | `scaphium-affine`                              | Scaphium affine                                | _Scaphium affine_                                | trad     |
|     0 | `boehmeria-nivea`                              | Boehmeria nivea                                | _Boehmeria nivea_                                | C        |
|     0 | `ledebouriella-divaricata`                     | Ledebouriella divaricata                       | _Ledebouriella divaricata_                       | C        |
|     0 | `cistanche-salsa`                              | Cistanche salsa                                | _Cistanche salsa_                                | trad     |
|     0 | `senna-tora`                                   | Senna tora                                     | _Senna tora_                                     | C        |
|     0 | `vincetoxicum-glaucescens`                     | Vincetoxicum glaucescens                       | _Vincetoxicum glaucescens_                       | trad     |
|     0 | `hypericum-japonicum`                          | Hypericum japonicum                            | _Hypericum japonicum_                            | C        |
|     0 | `artemisia-anomala`                            | Artemisia anomala                              | _Artemisia anomala_                              | trad     |
|     0 | `prunus-salicina`                              | Prunus salicina                                | _Prunus salicina_                                | C        |
|     0 | `rubus-ursinus`                                | Rubus ursinus                                  | _Rubus ursinus_                                  | C        |
|     0 | `boswellia-frereana`                           | Boswellia frereana                             | _Boswellia frereana_                             | C        |
|     0 | `schoenocaulon-officinale`                     | Schoenocaulon officinale                       | _Schoenocaulon officinale_                       | C        |
|     0 | `senecio-aureus`                               | Senecio aureus                                 | _Senecio aureus_                                 | C        |
|     0 | `iris-tenax`                                   | Iris tenax                                     | _Iris tenax_                                     | C        |
|     0 | `cephalanthus-occidentalis`                    | Cephalanthus occidentalis                      | _Cephalanthus occidentalis_                      | C        |
|     0 | `aletris-farinosa`                             | Aletris farinosa                               | _Aletris farinosa_                               | C        |
|     0 | `ranunculus-ternatus`                          | Ranunculus ternatus                            | _Ranunculus ternatus_                            | trad     |
|     0 | `rhododendron-aureum`                          | Rhododendron aureum                            | _Rhododendron aureum_                            | C        |
|     0 | `crateva-magna`                                | Crateva magna                                  | _Crateva magna_                                  | C        |
|     0 | `sambucus-nigra-subsp-nigra`                   | Sambucus nigra subsp. nigra                    | _Sambucus nigra subsp. nigra_                    | C        |
|     0 | `orchis-mascula`                               | Orchis mascula                                 | _Orchis mascula_                                 | C        |
|     0 | `saccharum-officinale`                         | Saccharum officinale                           | _Saccharum officinale_                           | C        |
|     0 | `aesculus-carnea`                              | Aesculus carnea                                | _Aesculus carnea_                                | C        |
|     0 | `eupatorium-purpureum`                         | Eupatorium purpureum                           | _Eupatorium purpureum_                           | C        |
|     0 | `clerodendron-trichotomum`                     | Clerodendron trichotomum                       | _Clerodendron trichotomum_                       | C        |
|     0 | `chrysanthellum-americanum`                    | Chrysanthellum americanum                      | _Chrysanthellum americanum_                      | C        |
|     0 | `nardostachys-grandiflora-dc`                  | Nardostachys grandiflora DC.                   | _Nardostachys grandiflora DC._                   | C        |
|     0 | `rheum-pumilum`                                | Rheum pumilum                                  | _Rheum pumilum_                                  | C        |
|     0 | `glechoma-longituba`                           | Glechoma longituba                             | _Glechoma longituba_                             | C        |
|     0 | `bambusa-textilis`                             | Bambusa textilis                               | _Bambusa textilis_                               | C        |
|     0 | `auxenochlorella-pyrenoidosa`                  | Auxenochlorella pyrenoidosa                    | _Auxenochlorella pyrenoidosa_                    | C        |
|     0 | `citrus-sinensis`                              | Citrus sinensis                                | _Citrus sinensis_                                | C        |
|     0 | `alchemilla-xanthochlora`                      | Alchemilla xanthochlora                        | _Alchemilla xanthochlora_                        | C        |
|     0 | `auxenochlorella-protothecoides`               | Auxenochlorella protothecoides                 | _Auxenochlorella protothecoides_                 | C        |
|     0 | `aspergillus-niger-e-volumine-cellulae`        | Aspergillus niger e volumine cellulae          | _Aspergillus niger e volumine cellulae_          | C        |
|     0 | `chamaesyce-hirta`                             | Chamaesyce hirta                               | _Chamaesyce hirta_                               | C        |
|     0 | `paeonia-anomala-subsp-veitchii`               | Paeonia anomala subsp. veitchii                | _Paeonia anomala subsp. veitchii_                | C        |
|     0 | `taraxacum-sinicum`                            | Taraxacum sinicum                              | _Taraxacum sinicum_                              | C        |
|     0 | `anemone-hepatica`                             | Anemone hepatica                               | _Anemone hepatica_                               | C        |
|     0 | `ludwigia-prostrata`                           | Ludwigia prostrata                             | _Ludwigia prostrata_                             | C        |
|     0 | `apocynum-androsaemifolium`                    | Apocynum androsaemifolium                      | _Apocynum androsaemifolium_                      | C        |
|     0 | `actaea-heracleifolia`                         | Actaea heracleifolia                           | _Actaea heracleifolia_                           | C        |
|     0 | `cypripedium-pubescens`                        | Cypripedium pubescens                          | _Cypripedium pubescens_                          | C        |
|     0 | `leptandra-virginica`                          | Leptandra virginica                            | _Leptandra virginica_                            | C        |
|     0 | `barosma-betulina`                             | Barosma betulina                               | _Barosma betulina_                               | C        |
|     0 | `lachnanthes-tinctoria`                        | Lachnanthes tinctoria                          | _Lachnanthes tinctoria_                          | C        |
|     0 | `viburnum-lantana`                             | Viburnum lantana                               | _Viburnum lantana_                               | C        |
|     0 | `cucumis-melo-subsp-melo-var-cantalupo`        | Cucumis melo subsp. melo var. cantalupo        | _Cucumis melo subsp. melo var. cantalupo_        | C        |
|     0 | `heptapleurum-arboricola`                      | Heptapleurum arboricola                        | _Heptapleurum arboricola_                        | trad     |
|     0 | `scurrula-parasitica`                          | Scurrula parasitica                            | _Scurrula parasitica_                            | C        |
|     0 | `viola-philippica-var-philippica`              | Viola philippica var. philippica               | _Viola philippica var. philippica_               | C        |
|     0 | `clematis-montana`                             | Clematis montana                               | _Clematis montana_                               | trad     |
|     0 | `cupressus-lawsoniana`                         | Cupressus lawsoniana                           | _Cupressus lawsoniana_                           | C        |
|     0 | `plantago-arenaria`                            | Plantago arenaria                              | _Plantago arenaria_                              | C        |
|     0 | `phyllostachys-nigra`                          | Phyllostachys nigra                            | _Phyllostachys nigra_                            | C        |
|     0 | `semiaquilegia-adoxoides`                      | Semiaquilegia adoxoides                        | _Semiaquilegia adoxoides_                        | C        |
|     0 | `vaccinium-pallidum`                           | Vaccinium pallidum                             | _Vaccinium pallidum_                             | C        |
|     0 | `vaccinium-myrsinites`                         | Vaccinium myrsinites                           | _Vaccinium myrsinites_                           | C        |
|     0 | `ribes-rubrum`                                 | Ribes rubrum                                   | _Ribes rubrum_                                   | C        |
|     0 | `xerophyllum-asphodeloides`                    | Xerophyllum asphodeloides                      | _Xerophyllum asphodeloides_                      | C        |
|     0 | `haematoxylon-campechianum`                    | Haematoxylon campechianum                      | _Haematoxylon campechianum_                      | C        |
|     0 | `rubus-strigosus`                              | Rubus strigosus                                | _Rubus strigosus_                                | C        |

---

## Task 4 — Published Herbs with No Structured `contraindications` (86)

- **Total:** 86
- **Already have non-placeholder safety/pregnancy text in PubMed sheet:** **21**
- **No structured `contraindications` and no non-placeholder safety text in PubMed/regulatory/monograph tables:** **65**

### 4C. No `contraindications` — Safety Text Already Displayed in PubMed Sheet (21)

| Views | Slug                         | Name                       | Scientific Name              | Evidence |
| ----: | ---------------------------- | -------------------------- | ---------------------------- | -------- |
|     0 | `galphimia-glauca`           | Galphimia glauca           | _Galphimia glauca_           | C        |
|     0 | `potentilla-tormentilla`     | Potentilla tormentilla     | _Potentilla tormentilla_     | C        |
|     0 | `chamomilla-vulgaris`        | Chamomilla vulgaris        | _Chamomilla vulgaris_        | C        |
|     0 | `erigeron-canadensis`        | Erigeron canadensis        | _Erigeron canadensis_        | C        |
|     0 | `euonymus-europaeus`         | Euonymus europaeus         | _Euonymus europaeus_         | C        |
|     0 | `juniperus-virginiana`       | Juniperus virginiana       | _Juniperus virginiana_       | C        |
|     0 | `lathyrus-sativus`           | Lathyrus sativus           | _Lathyrus sativus_           | C        |
|     0 | `lemna-minor`                | Lemna minor                | _Lemna minor_                | C        |
|     0 | `ocimum-canum`               | Ocimum canum               | _Ocimum canum_               | C        |
|     0 | `sabal-serrulata`            | Sabal serrulata            | _Sabal serrulata_            | C        |
|     0 | `syringa-vulgaris`           | Syringa vulgaris           | _Syringa vulgaris_           | C        |
|     0 | `argyreia-speciosa`          | Argyreia speciosa          | _Argyreia speciosa_          | C        |
|     0 | `tamus-communis`             | Tamus communis             | _Tamus communis_             | C        |
|     0 | `hydrocotyle-asiatica`       | Hydrocotyle asiatica       | _Hydrocotyle asiatica_       | C        |
|     0 | `betula-verrucosa`           | Betula verrucosa           | _Betula verrucosa_           | C        |
|     0 | `sorbus-domestica`           | Sorbus domestica           | _Sorbus domestica_           | C        |
|     0 | `jasminum-grandiflorum`      | Jasminum grandiflorum      | _Jasminum grandiflorum_      | C        |
|     0 | `fraxinus-americana`         | Fraxinus americana         | _Fraxinus americana_         | C        |
|     0 | `clerodendrum-phlomidis`     | Clerodendrum phlomidis     | _Clerodendrum phlomidis_     | C        |
|     0 | `vigna-trilobata`            | Vigna trilobata            | _Vigna trilobata_            | C        |
|     0 | `toxicodendron-diversilobum` | Toxicodendron diversilobum | _Toxicodendron diversilobum_ | C        |

### 4D. No `contraindications` — Needs Human Safety Sourcing (65)

| Views | Slug                                          | Name                                        | Scientific Name                               | Evidence |
| ----: | --------------------------------------------- | ------------------------------------------- | --------------------------------------------- | -------- |
|     0 | `ceratostigma-willmottianum`                  | Ceratostigma willmottianum                  | _Ceratostigma willmottianum_                  | C        |
|     0 | `acer-campestre`                              | Acer campestre                              | _Acer campestre_                              | C        |
|     0 | `quercus-pedunculata`                         | Quercus pedunculata                         | _Quercus pedunculata_                         | C        |
|     0 | `cineraria-maritima`                          | Cineraria maritima                          | _Cineraria maritima_                          | C        |
|     0 | `gentianella-amarella`                        | Gentianella amarella                        | _Gentianella amarella_                        | C        |
|     0 | `eugenia-jambos`                              | Eugenia jambos                              | _Eugenia jambos_                              | C        |
|     0 | `bromus-ramosus`                              | Bromus ramosus                              | _Bromus ramosus_                              | C        |
|     0 | `franciscea-uniflora`                         | Franciscea uniflora                         | _Franciscea uniflora_                         | C        |
|     0 | `penicillium-chrysogenum-e-volumine-cellulae` | Penicillium chrysogenum e volumine cellulae | _Penicillium chrysogenum e volumine cellulae_ | C        |
|     0 | `mucor-racemosus-e-volumine-cellulae`         | Mucor racemosus e volumine cellulae         | _Mucor racemosus e volumine cellulae_         | C        |
|     0 | `stereospermum-chelonoides`                   | Stereospermum chelonoides                   | _Stereospermum chelonoides_                   | C        |
|     0 | `teucrium-scorodonia`                         | Teucrium scorodonia                         | _Teucrium scorodonia_                         | C        |
|     0 | `pinus-montana`                               | Pinus montana                               | _Pinus montana_                               | C        |
|     0 | `vitis-vinifera-grape-seed-extract`           | Vitis vinifera (grape) seed extract         | _Vitis vinifera (grape) seed extract_         | C        |
|     0 | `wyethia-helenioides`                         | Wyethia helenioides                         | _Wyethia helenioides_                         | C        |
|     0 | `cephalandra-indica`                          | Cephalandra indica                          | _Cephalandra indica_                          | C        |
|     0 | `agraphis-nutans`                             | Agraphis nutans                             | _Agraphis nutans_                             | C        |
|     0 | `clematis-erecta`                             | Clematis erecta                             | _Clematis erecta_                             | C        |
|     0 | `dolichos-pruriens`                           | Dolichos pruriens                           | _Dolichos pruriens_                           | C        |
|     0 | `hottonia-palustris`                          | Hottonia palustris                          | _Hottonia palustris_                          | C        |
|     0 | `onosmodium-virginianum`                      | Onosmodium virginianum                      | _Onosmodium virginianum_                      | C        |
|     0 | `penthorum-sedoides`                          | Penthorum sedoides                          | _Penthorum sedoides_                          | C        |
|     0 | `rhus-aromatica`                              | Rhus aromatica                              | _Rhus aromatica_                              | C        |
|     0 | `spartium-scoparium`                          | Spartium scoparium                          | _Spartium scoparium_                          | C        |
|     0 | `spiranthes-autumnalis`                       | Spiranthes autumnalis                       | _Spiranthes autumnalis_                       | C        |
|     0 | `sticta-pulmonaria`                           | Sticta pulmonaria                           | _Sticta pulmonaria_                           | C        |
|     0 | `amygdalus-persica`                           | Amygdalus persica                           | _Amygdalus persica_                           | C        |
|     0 | `erodium-cicutarium`                          | Erodium cicutarium                          | _Erodium cicutarium_                          | C        |
|     0 | `gnaphalium-uliginosum`                       | Gnaphalium uliginosum                       | _Gnaphalium uliginosum_                       | C        |
|     0 | `majorana-hortensis`                          | Majorana hortensis                          | _Majorana hortensis_                          | C        |
|     0 | `nasturtium-aquaticum`                        | Nasturtium aquaticum                        | _Nasturtium aquaticum_                        | C        |
|     0 | `opuntia-vulgaris`                            | Opuntia vulgaris                            | _Opuntia vulgaris_                            | C        |
|     0 | `pinus-mugo`                                  | Pinus mugo                                  | _Pinus mugo_                                  | C        |
|     0 | `larix-laricina`                              | Larix laricina                              | _Larix laricina_                              | C        |
|     0 | `oxydendrum-arboreum`                         | Oxydendrum arboreum                         | _Oxydendrum arboreum_                         | C        |
|     0 | `okoubaka-aubrevillei`                        | Okoubaka aubrevillei                        | _Okoubaka aubrevillei_                        | C        |
|     0 | `ampelopsis-quinquefolia`                     | Ampelopsis quinquefolia                     | _Ampelopsis quinquefolia_                     | C        |
|     0 | `abies-nigra`                                 | Abies nigra                                 | _Abies nigra_                                 | C        |
|     0 | `agaricus-muscarius`                          | Agaricus muscarius                          | _Agaricus muscarius_                          | C        |
|     0 | `candida-parapsilosis`                        | Candida parapsilosis                        | _Candida parapsilosis_                        | C        |
|     0 | `chelone-glabra`                              | Chelone glabra                              | _Chelone glabra_                              | C        |
|     0 | `saxifraga-granulata`                         | Saxifraga granulata                         | _Saxifraga granulata_                         | C        |
|     0 | `sinapis-nigra`                               | Sinapis nigra                               | _Sinapis nigra_                               | C        |
|     0 | `sticta-pulmonacea`                           | Sticta pulmonacea                           | _Sticta pulmonacea_                           | C        |
|     0 | `ulmus-procera`                               | Ulmus procera                               | _Ulmus procera_                               | C        |
|     0 | `rhamnus-californica`                         | Rhamnus californica                         | _Rhamnus californica_                         | C        |
|     0 | `raphanus-sativus-var-niger`                  | Raphanus sativus var. niger                 | _Raphanus sativus var. niger_                 | C        |
|     0 | `lilium-tigrinum`                             | Lilium tigrinum                             | _Lilium tigrinum_                             | C        |
|     0 | `trillium-pendulum`                           | Trillium pendulum                           | _Trillium pendulum_                           | C        |
|     0 | `polyporus-officinalis`                       | Polyporus officinalis                       | _Polyporus officinalis_                       | C        |
|     0 | `iris-tenax`                                  | Iris tenax                                  | _Iris tenax_                                  | C        |
|     0 | `saccharum-officinale`                        | Saccharum officinale                        | _Saccharum officinale_                        | C        |
|     0 | `aesculus-carnea`                             | Aesculus carnea                             | _Aesculus carnea_                             | C        |
|     0 | `chrysanthellum-americanum`                   | Chrysanthellum americanum                   | _Chrysanthellum americanum_                   | C        |
|     0 | `rheum-pumilum`                               | Rheum pumilum                               | _Rheum pumilum_                               | C        |
|     0 | `aspergillus-niger-e-volumine-cellulae`       | Aspergillus niger e volumine cellulae       | _Aspergillus niger e volumine cellulae_       | C        |
|     0 | `anemone-hepatica`                            | Anemone hepatica                            | _Anemone hepatica_                            | C        |
|     0 | `apocynum-androsaemifolium`                   | Apocynum androsaemifolium                   | _Apocynum androsaemifolium_                   | C        |
|     0 | `cypripedium-pubescens`                       | Cypripedium pubescens                       | _Cypripedium pubescens_                       | C        |
|     0 | `lachnanthes-tinctoria`                       | Lachnanthes tinctoria                       | _Lachnanthes tinctoria_                       | C        |
|     0 | `scurrula-parasitica`                         | Scurrula parasitica                         | _Scurrula parasitica_                         | C        |
|     0 | `cupressus-lawsoniana`                        | Cupressus lawsoniana                        | _Cupressus lawsoniana_                        | C        |
|     0 | `vaccinium-pallidum`                          | Vaccinium pallidum                          | _Vaccinium pallidum_                          | C        |
|     0 | `xerophyllum-asphodeloides`                   | Xerophyllum asphodeloides                   | _Xerophyllum asphodeloides_                   | C        |
|     0 | `haematoxylon-campechianum`                   | Haematoxylon campechianum                   | _Haematoxylon campechianum_                   | C        |

---

## Task 5 — Published Herbs with No Citations (30)

Left untouched per policy; listed by descending `view_count` for human citation sourcing:

|   # | Views | Slug                      | Name                    | Scientific Name                 | Evidence | Provenance | PubMed Articles | Reg Evidence | Monograph Sources |
| --: | ----: | ------------------------- | ----------------------- | ------------------------------- | -------- | ---------- | --------------: | :----------: | ----------------: |
|   1 |   122 | `escallonia-resinosa`     | Escallonia Resinosa     | _Escallonia resinosa_           | trad     | unverified |               0 |      No      |                 0 |
|   2 |    97 | `haworthia-attenuata`     | Haworthia attenuata     | _Haworthiopsis attenuata_       | trad     | unverified |               0 |      No      |                 0 |
|   3 |    90 | `berkheya-purpurea`       | Berkheya purpurea       | _Berkheya purpurea_             | trad     | unverified |               0 |      No      |                 0 |
|   4 |    79 | `blephilia-ciliata`       | Blephilia ciliata       | _Blephilia ciliata_             | trad     | unverified |               0 |      No      |                 0 |
|   5 |    77 | `prodigiosa-mex`          | Prodigiosa Mexican      | _Brickellia grandiflora_        | trad     | unverified |               0 |      No      |                 0 |
|   6 |    77 | `gui-pi-tang-patent`      | Gui Pi Tang Patent      | _Restore the Spleen Decoction_  | trad     | unverified |               0 |      No      |                 0 |
|   7 |    69 | `astelia-nervosa`         | Astelia Nervosa         | _Astelia nervosa_               | trad     | unverified |               0 |      No      |                 0 |
|   8 |    62 | `black-cumin-anatolian`   | Black Cumin Anatolian   | _Nigella sativa var. anatolica_ | trad     | unverified |               0 |      No      |                 0 |
|   9 |    60 | `nectandra-rodioei`       | Nectandra rodioei       | _Nectandra rodioei_             | trad     | unverified |               0 |      No      |                 0 |
|  10 |    58 | `allium-moly`             | Allium moly             | _Allium moly_                   | trad     | unverified |               0 |      No      |                 0 |
|  11 |    55 | `leucadendron-argenteum`  | Leucadendron argenteum  | _Leucadendron argenteum_        | trad     | unverified |               0 |      No      |                 0 |
|  12 |    51 | `cunila-origanoides`      | Cunila origanoides      | _Cunila origanoides_            | trad     | unverified |               0 |      No      |                 0 |
|  13 |    46 | `plagianthus-regius`      | Plagianthus Regius      | _Plagianthus regius_            | trad     | unverified |               0 |      No      |                 0 |
|  14 |    46 | `meconopsis-regia`        | Meconopsis Regia        | _Meconopsis regia_              | trad     | unverified |               0 |      No      |                 0 |
|  15 |    46 | `calumba-jateorhiza`      | Calumba Jateorhiza      | _Jateorhiza calumba_            | trad     | unverified |               0 |      No      |                 0 |
|  16 |    44 | `hebe-stricta`            | Hebe Stricta            | _Veronica stricta_              | trad     | unverified |               0 |      No      |                 0 |
|  17 |    44 | `zigadenus-elegans`       | Zigadenus elegans       | _Anticlea elegans_              | trad     | unverified |               0 |      No      |                 0 |
|  18 |    44 | `life-root`               | Life Root               | _Packera aurea_                 | trad     | unverified |               0 |      No      |                 0 |
|  19 |    43 | `trichostema-lanceolatum` | Trichostema lanceolatum | _Trichostema lanceolatum_       | trad     | unverified |               0 |      No      |                 0 |
|  20 |    43 | `stachydeoma-graveolens`  | Stachydeoma graveolens  | _Stachydeoma graveolens_        | trad     | unverified |               0 |      No      |                 0 |
|  21 |    43 | `kumkumadi-indian`        | Kumkumadi Indian        | _Saffron-based oil formula_     | trad     | unverified |               0 |      No      |                 0 |
|  22 |    41 | `nothoscordum-bivalve`    | Nothoscordum bivalve    | _Nothoscordum bivalve_          | trad     | unverified |               0 |      No      |                 0 |
|  23 |    41 | `pimpinella-major`        | Pimpinella Major        | _Pimpinella major_              | trad     | unverified |               0 |      No      |                 0 |
|  24 |    40 | `puschkinia-scilloides`   | Puschkinia scilloides   | _Puschkinia scilloides_         | trad     | unverified |               0 |      No      |                 0 |
|  25 |    40 | `salazaria-mexicana`      | Salazaria mexicana      | _Scutellaria mexicana_          | trad     | unverified |               0 |      No      |                 0 |
|  26 |    38 | `veltheimia-bracteata`    | Veltheimia bracteata    | _Veltheimia bracteata_          | trad     | unverified |               0 |      No      |                 0 |
|  27 |    38 | `yokukansan-kampo`        | Kampo Yokukansan        | _Multi-herb Kampo formula_      | trad     | unverified |               0 |      No      |                 0 |
|  28 |    37 | `trichostema-dichotomum`  | Trichostema dichotomum  | _Trichostema dichotomum_        | trad     | unverified |               0 |      No      |                 0 |
|  29 |    35 | `mahonia-nervosa`         | Mahonia nervosa         | _Mahonia nervosa_               | trad     | unverified |               0 |      No      |                 0 |
|  30 |    33 | `olearia-traversii`       | Olearia Traversii       | _Olearia traversii_             | trad     | unverified |               0 |      No      |                 0 |
