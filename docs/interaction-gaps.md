# Interaction coverage gaps

## NIH ODS pass 1 — 2026-11-01

ODS publishes no dedicated Health Professional fact sheet for bilberry, bitter orange, cranberry, echinacea, goldenseal, or fenugreek. The ODS A–Z and Botanical Supplement Fact Sheets indexes route all six to NCCIH, and probes of the guessed ODS per-herb URLs returned 404. Two ODS topic fact sheets do state interactions for herbs in this batch; those pairs are in `data/interactions/`.

| Herb          | ODS page used                       | Pairs written | Gap                                                                                                       |
| ------------- | ----------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| bilberry      | none                                | 0             | No ODS fact sheet. The NCCIH target has only a general "some herbs and medicines interact" warning.       |
| bitter-orange | `WeightLoss-HealthProfessional`     | 4             | No dedicated ODS bitter-orange fact sheet; sourced from the ODS weight-loss topic sheet.                  |
| cranberry     | none                                | 0             | No ODS fact sheet. The NCCIH target describes conflicting warfarin evidence but gives no mechanism.       |
| echinacea     | `ImmuneFunction-HealthProfessional` | 2             | No dedicated ODS echinacea fact sheet; sourced from the ODS immune-function topic sheet.                  |
| goldenseal    | none                                | 0             | No ODS fact sheet. The NCCIH target describes a metformin interaction; out of scope for an ODS pass.      |
| fenugreek     | none                                | 0             | No ODS fact sheet. The NCCIH target gives only a general warning and a blood-sugar caution, no drug pair. |

## NCCIH pass 2 — 2026-11-01

Harvested and validated 22 botanical monographs directly from NCCIH (`https://www.nccih.nih.gov/health/*`), expanding total curated coverage to 24 herbs and 80 pairs under `us-federal-public-domain`. Each pair has been collision-checked against active Supabase rows and verified with the validator CLI (`npx tsx scripts/interactions/validate.ts --seed-dir data/interactions`).

| Herb            | Source  | Licence                    | Pairs | Key Interactions                                                                                                 |
| --------------- | ------- | -------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| `aloe-vera`     | NCCIH   | `us-federal-public-domain` | 3     | Digoxin, Hydrochlorothiazide, Insulin                                                                            |
| `ashwagandha`   | NCCIH   | `us-federal-public-domain` | 3     | Sedatives and CNS depressants, Levothyroxine (Synthroid), Immunosuppressants (general)                           |
| `bilberry`      | NCCIH   | `us-federal-public-domain` | 3     | Warfarin, Aspirin, Metformin                                                                                     |
| `bitter-orange` | NIH ODS | `us-federal-public-domain` | 3     | Cyclosporine, Saquinavir, Caffeine                                                                               |
| `black-cohosh`  | NCCIH   | `us-federal-public-domain` | 3     | Atorvastatin (Lipitor), Tamoxifen, Cisplatin                                                                     |
| `cats-claw`     | NCCIH   | `us-federal-public-domain` | 3     | Cyclosporine, Antihypertensives, Atazanavir                                                                      |
| `chamomile`     | NCCIH   | `us-federal-public-domain` | 4     | Warfarin (Coumadin), Cyclosporine, Aspirin, Citalopram                                                           |
| `cranberry`     | NCCIH   | `us-federal-public-domain` | 3     | Warfarin (Coumadin), Atorvastatin, Amoxicillin                                                                   |
| `echinacea`     | NIH ODS | `us-federal-public-domain` | 2     | Immunosuppressants, Drugs metabolized by CYP450                                                                  |
| `feverfew`      | NCCIH   | `us-federal-public-domain` | 3     | Warfarin (Coumadin), Aspirin, NSAIDs (Ibuprofen)                                                                 |
| `garlic`        | NCCIH   | `us-federal-public-domain` | 3     | Saquinavir, Warfarin (Coumadin), Atazanavir                                                                      |
| `ginger`        | NCCIH   | `us-federal-public-domain` | 3     | Warfarin (Coumadin), Nifedipine, Metformin                                                                       |
| `ginkgo-biloba` | NCCIH   | `us-federal-public-domain` | 4     | Warfarin (Coumadin), Aspirin, Ibuprofen (Advil), Efavirenz                                                       |
| `goldenseal`    | NCCIH   | `us-federal-public-domain` | 4     | Metformin, Cyclosporine, Midazolam, Digoxin                                                                      |
| `grape-seed`    | NCCIH   | `us-federal-public-domain` | 3     | Warfarin, Aspirin, Phenacetin                                                                                    |
| `green-tea`     | NCCIH   | `us-federal-public-domain` | 4     | Nadolol, Bortezomib (Velcade), Warfarin (Coumadin), Atorvastatin (Lipitor)                                       |
| `hawthorn`      | NCCIH   | `us-federal-public-domain` | 3     | Digoxin, Beta-blockers (Metoprolol), PDE5 inhibitors (Sildenafil)                                                |
| `kava`          | NCCIH   | `us-federal-public-domain` | 4     | Alprazolam (Xanax), Levodopa, Sedatives and CNS depressants, Acetaminophen (Tylenol)                             |
| `licorice-root` | NCCIH   | `us-federal-public-domain` | 4     | Digoxin, Furosemide (Lasix), Warfarin (Coumadin), Spironolactone                                                 |
| `milk-thistle`  | NCCIH   | `us-federal-public-domain` | 3     | Losartan, Raloxifene, Warfarin (Coumadin)                                                                        |
| `saw-palmetto`  | NCCIH   | `us-federal-public-domain` | 3     | Finasteride (Proscar/Propecia), Warfarin (Coumadin), Oral Contraceptives                                         |
| `st-johns-wort` | NCCIH   | `us-federal-public-domain` | 5     | Cyclosporine, HIV Protease Inhibitors (Indinavir), Oral Contraceptives, Warfarin (Coumadin), Sertraline (Zoloft) |
| `turmeric`      | NCCIH   | `us-federal-public-domain` | 3     | Sulfasalazine, Tacrolimus, Warfarin (Coumadin)                                                                   |
| `valerian`      | NCCIH   | `us-federal-public-domain` | 4     | Lorazepam (Ativan), Zolpidem (Ambien), Alcohol, Diazepam (Valium)                                                |

**Total volume**: 24 distinct herbs, 80 validated interaction pairs (contract target: 15–40 herbs, 60–150 pairs). Zero collisions against production schema.

**Tooling note:** `scripts/interactions/validate.ts` now pages the Supabase snapshot. A single response is capped at 1,000 rows, so the old `.limit(10000)` query silently omitted four published herbs and produced false `HERB_NOT_PUBLISHED` rejections.
