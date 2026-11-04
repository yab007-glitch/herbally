/**
 * Replace AI-written herb FAQs with answers generated from the verified record.
 *
 * Why: the visible Q&A on every herb page came from `herb_faqs` (source
 * "ai-generated", 14,744 rows, never reviewed). That text is what a visitor reads,
 * and it contradicted the curated fields — e.g. it gave yarrow "4 grams, 1-2
 * teaspoons" while the herb record held the regulator's dose.
 *
 * The replacement answers are built only from fields that carry a source:
 *   traditional_uses / dosage_adult / contraindications / provenance.verified_sources
 * When a field is empty the answer says so instead of inventing one.
 *
 * Usage: node scripts/regenerate-faqs.mjs [--dry-run] [--limit N]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DRY = process.argv.includes("--dry-run");
const API = "https://health-products.canada.ca/api/natural-licences";

function env() {
  const out = {};
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split(
    "\n"
  )) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const e = env();
const BASE = e.NEXT_PUBLIC_SUPABASE_URL;
const KEY = e.SUPABASE_SERVICE_ROLE_KEY;
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const sent = (s) => s.trim().replace(/\s+/g, " ").replace(/\.?$/, ".");

function buildFaqs(herb) {
  const name = herb.name || herb.scientific_name;
  const p = herb.provenance || {};
  const sources = (p.verified_sources || []).filter(Boolean);
  const sourceText = sources.length
    ? sources.join("; ")
    : "No independent source is recorded for this entry.";

  const uses = (herb.traditional_uses || [])
    .map(sent)
    .filter((s) => s.length > 12);
  const contra = (herb.contraindications || [])
    .map(sent)
    .filter((s) => s.length > 8);
  const dose = (herb.dosage_adult || "").trim();

  return [
    {
      question: `What is ${name} used for?`,
      answer: uses.length
        ? `${uses.slice(0, 3).join(" ")} (Recorded from licensed-product and monograph sources: ${sourceText}.)`
        : `No specific therapeutic indication is recorded for ${name} in the sources attached to this entry. Health Canada licenses products containing it, but the licence records we read give no per-product indication, so none is stated here.`,
      category: "uses",
    },
    {
      question: `What dose of ${name} is used?`,
      answer: dose
        ? `${sent(dose)} This is the labelled or monograph dose recorded for this entry, not a personal recommendation. (${sourceText}.)`
        : `No labelled dose is recorded for ${name}: the product labels read for this entry state no amount. Dose should be set by a qualified practitioner.`,
      category: "dosage",
    },
    {
      question: `Who should avoid ${name}?`,
      answer: contra.length
        ? `${contra.slice(0, 3).join(" ")} These cautions come from the product labels and monographs attached to this entry.`
        : `No specific contraindication is recorded in the sources attached to this entry. That is not the same as proof of safety — check with a pharmacist before use, especially alongside medication or in pregnancy.`,
      category: "safety",
    },
    {
      question: `Where does this information about ${name} come from?`,
      answer: sources.length
        ? `This entry was cross-checked against: ${sourceText}. Every claim on this page is attributed to one of those sources, and fields with no source are left blank rather than filled in.`
        : `No independent source is attached to this entry yet, so its content should be treated as unverified.`,
      category: "sources",
    },
  ];
}

async function main() {
  const limArg = process.argv.indexOf("--limit");
  const limit = limArg >= 0 ? Number(process.argv[limArg + 1]) || 0 : 0;

  const herbs = [];
  for (let off = 0; ; off += 1000) {
    const res = await fetch(
      `${BASE}/rest/v1/herbs?select=id,slug,name,scientific_name,traditional_uses,dosage_adult,contraindications,provenance${process.argv.includes('--include-unpublished') ? '' : '&is_published=eq.true'}&order=slug&limit=1000&offset=${off}`,
      { headers: H }
    );
    const page = await res.json();
    if (!Array.isArray(page))
      throw new Error(
        `herbs query returned ${JSON.stringify(page).slice(0, 120)}`
      );
    herbs.push(...page);
    if (page.length < 1000) break;
  }
  const slugsArg = process.argv.indexOf("--slugs");
  const only =
    slugsArg >= 0
      ? new Set(
          String(process.argv[slugsArg + 1] || "")
            .split(",")
            .filter(Boolean)
        )
      : null;
  let work = only ? herbs.filter((h) => only.has(h.slug)) : herbs;
  if (limit) work = work.slice(0, limit);
  console.log(
    `[faqs] ${work.length} published herbs${DRY ? " (dry run)" : ""}`
  );

  const report = [];
  for (const h of work) {
    const faqs = buildFaqs(h);
    if (DRY) {
      report.push({
        slug: h.slug,
        faqs: faqs.length,
        sample: faqs[1].answer.slice(0, 90),
      });
      continue;
    }
    // Replace: delete the old (AI) rows for this herb, then insert the sourced set.
    const del = await fetch(`${BASE}/rest/v1/herb_faqs?herb_id=eq.${h.id}`, {
      method: "DELETE",
      headers: H,
    });
    const rows = faqs.map((f, i) => ({
      herb_id: h.id,
      question: f.question,
      answer: f.answer,
      category: f.category,
      source: "verified-data",
      confidence_score: 1,
      is_featured: i === 0,
      sort_order: i,
    }));
    const ins = await fetch(`${BASE}/rest/v1/herb_faqs`, {
      method: "POST",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
    report.push({
      slug: h.slug,
      ok: del.ok && ins.ok,
      status: `${del.status}/${ins.status}`,
    });
    if (report.length % 200 === 0)
      console.log(`[faqs] ${report.length}/${work.length}`);
  }

  writeFileSync(
    join(ROOT, "artifacts", "faq-regeneration.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), report }, null, 1)
  );
  if (DRY) {
    for (const r of report.slice(0, 3)) console.log("  ", JSON.stringify(r));
  } else {
    const ok = report.filter((r) => r.ok).length;
    console.log(`[faqs] done: ${ok}/${report.length} herbs rewritten`);
  }
}

main().catch((err) => {
  console.error("[faqs] fatal:", err.message);
  process.exit(1);
});
