/**
 * Create herb pages for botanicals the library does not have — with their
 * regulator evidence in the same operation.
 *
 * A name appearing in a product licence is not a herb, and a herb with no
 * content is the thin page this work exists to remove. So an entry is only
 * imported when Health Canada gives it at least one quoted purpose AND one
 * dose. Otherwise the script refuses the row and says why.
 *
 * Licence: Open Government Licence – Canada. Every created page carries
 * source = Health Canada LNHPD and the dataset link.
 *
 * Usage: node scripts/import-new-herbs.mjs [--dry-run]
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MANIFEST = join(ROOT, "data", "new-herbs.json");
const CANDIDATES = join(ROOT, "artifacts", "lnhpd-new-candidates.json");
const API = "https://health-products.canada.ca/api/natural-licences";
const DRY = process.argv.includes("--dry-run");

function env() {
  const out = {};
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const e = env();
const HEAD = { apikey: e.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}` };
const REST = `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

async function getJson(path, attempt = 1) {
  try {
    const res = await fetch(`${API}/${path}${path.includes("?") ? "&" : "?"}lang=en&type=json`, {
      headers: { "User-Agent": "HerbAlly data importer (herbally.app)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const p = await res.json();
    return p.data ?? p ?? [];
  } catch (err) {
    if (attempt >= 3) throw err;
    await new Promise((r) => setTimeout(r, 1200 * attempt));
    return getJson(path, attempt + 1);
  }
}

async function evidenceFor(ids) {
  const purposes = [], doses = [], risks = [], sources = [];
  for (const id of ids.slice(0, 6)) {
    const [p, d, r] = await Promise.all([
      getJson(`productpurpose/?id=${id}`).catch(() => []),
      getJson(`productdose/?id=${id}`).catch(() => []),
      getJson(`productrisk/?id=${id}`).catch(() => []),
    ]);
    for (const x of p) {
      const t = clean(x.purpose || x.purpose_text);
      if (t && !purposes.includes(t)) purposes.push(t);
    }
    for (const x of d) {
      const qty = Number(x.quantity_dose) || 0;
      const unit = clean(x.uom_type_desc_quantity_dose);
      const freq = Number(x.frequency) || 0;
      const fUnit = clean(x.uom_type_desc_frequency);
      const text = [unit ? `${qty} ${unit}` : null, freq ? `${freq}x ${fUnit || "daily"}` : null].filter(Boolean).join(" / ");
      if (text && !doses.some((y) => y.text === text)) {
        doses.push({ text, population: clean(x.population_type_desc) || null, age_minimum: x.age_minimum ?? null });
      }
    }
    for (const x of r) {
      const t = clean(x.risk || x.risk_text || x.description);
      if (t && !risks.includes(t)) risks.push(t);
    }
    sources.push(`${API}/productlicence/?id=${id}&lang=en&type=json`);
  }
  return { purposes, doses, risks, sources };
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const candidates = existsSync(CANDIDATES) ? JSON.parse(readFileSync(CANDIDATES, "utf8")).list : [];
  const byName = new Map(candidates.map((c) => [c.name.toLowerCase(), c]));

  for (const herb of manifest.herbs) {
    const cand = byName.get(herb.lnhpd_name.toLowerCase());
    if (!cand) {
      console.log(`[skip] ${herb.slug}: no LNHPD candidate named "${herb.lnhpd_name}"`);
      continue;
    }
    const ev = await evidenceFor(cand.sample_ids || []);
    if (!ev.purposes.length || !ev.doses.length) {
      console.log(`[skip] ${herb.slug}: evidence too thin (purposes ${ev.purposes.length}, doses ${ev.doses.length})`);
      continue;
    }

    const description = ev.purposes.slice(0, 3).join(" ");
    const row = {
      slug: herb.slug,
      name: herb.name,
      scientific_name: herb.scientific_name,
      description,
      common_names: herb.common_names || [],
      is_published: true,
      evidence_level: "C",
      provenance: {
        // Constrained by herbs_provenance_method_check to manual|ai_summarized|
        // primary_source|unverified. These rows are regulator-sourced, which is
        // "primary_source"; the specific body is recorded alongside it.
        verification_method: "primary_source",
        regulator: "Health Canada LNHPD",
        source: "Health Canada LNHPD",
        source_licence: "canada-ogl",
        imported_at: new Date().toISOString(),
      },
    };

    if (DRY) {
      console.log(`[dry] ${herb.slug} | purposes ${ev.purposes.length} doses ${ev.doses.length} risks ${ev.risks.length}`);
      continue;
    }

    const ins = await fetch(`${REST}/herbs`, {
      method: "POST",
      headers: { ...HEAD, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify([row]),
    });
    if (!ins.ok) {
      console.log(`[fail] ${herb.slug}: ${ins.status} ${(await ins.text()).slice(0, 160)}`);
      continue;
    }

    const evRow = {
      herb_slug: herb.slug,
      source: "Health Canada LNHPD",
      source_licence: "canada-ogl",
      purposes: ev.purposes,
      doses: ev.doses,
      risks: ev.risks,
      products_sampled: Math.min(6, (cand.sample_ids || []).length),
      source_urls: ev.sources,
      retrieved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const insEv = await fetch(`${REST}/herb_regulatory_evidence`, {
      method: "POST",
      headers: { ...HEAD, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([evRow]),
    });
    console.log(`[added] ${herb.slug} | purposes ${ev.purposes.length} doses ${ev.doses.length} risks ${ev.risks.length} | evidence ${insEv.ok ? "ok" : insEv.status}`);
  }
}

main().catch((err) => {
  console.error("[import] fatal:", err.message);
  process.exit(1);
});
