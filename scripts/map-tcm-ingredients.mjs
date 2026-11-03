/**
 * Map TCM-theory product licences to their medicinal ingredients.
 *
 * Input: /tmp/tcm-ids.json (licence ids whose purpose invokes traditional Chinese
 * medicine theory, extracted from the 142 MB productlicence dump).
 * Output: artifacts/tcm-herb-index.json — ingredient names with the number of TCM
 * products that contain them.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "artifacts", "tcm-herb-index.json");
const UA = { "User-Agent": "HerbAlly TCM curation (herbally.app)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ids = JSON.parse(readFileSync("/tmp/tcm-ids.json", "utf8"));
console.log(`[tcm-map] ${ids.length} TCM product licences to map`);

const rowsOf = (p) =>
  Array.isArray(p) ? p : Array.isArray(p?.data) ? p.data : [];
const herbs = {};

for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  try {
    const res = await fetch(
      `https://health-products.canada.ca/api/natural-licences/medicinalingredient/?lang=en&type=json&id=${id}`,
      { headers: UA }
    );
    const ings = rowsOf(await res.json());
    for (const ing of ings) {
      const name = ing.ingredient_name;
      if (!name) continue;
      const key = name.toLowerCase().trim();
      herbs[key] ||= { name, products: 0, sample_ids: [] };
      herbs[key].products++;
      if (herbs[key].sample_ids.length < 5) herbs[key].sample_ids.push(id);
    }
  } catch {}
  if ((i + 1) % 100 === 0) {
    writeFileSync(
      OUT,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          mapped: i + 1,
          total: ids.length,
          herbs,
        },
        null,
        1
      )
    );
    console.log(
      `[tcm-map] ${i + 1}/${ids.length} | herbs ${Object.keys(herbs).length}`
    );
  }
  await sleep(55);
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      mapped: ids.length,
      total: ids.length,
      herbs,
    },
    null,
    1
  )
);
const top = Object.values(herbs).sort((a, b) => b.products - a.products);
console.log(
  `[tcm-map] done: ${Object.keys(herbs).length} distinct ingredients across ${ids.length} TCM products`
);
for (const h of top.slice(0, 25))
  console.log(`  ${String(h.products).padStart(3)} × ${h.name}`);
