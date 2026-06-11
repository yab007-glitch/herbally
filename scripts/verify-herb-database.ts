import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

interface Citation {
  source?: string;
  title?: string;
  url?: string;
  year?: number;
  pmid?: string | number;
}

interface Herb {
  id: string;
  name: string;
  slug: string;
  scientific_name: string;
  description: string;
  citations: unknown;
  pregnancy_safe: boolean;
  nursing_safe: boolean;
  contraindications: string[];
  side_effects: string[];
}

const PM_API_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

// Helper to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Verify if a PMID actually exists on PubMed using the official NCBI E-utilities API.
 */
async function verifyPMIDWithPubMed(pmid: string): Promise<{ valid: boolean; title?: string }> {
  try {
    const url = `${PM_API_BASE}/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`;
    const res = await fetch(url);
    if (!res.ok) return { valid: false };

    const data = (await res.json()) as any;
    if (data.result && data.result[pmid]) {
      const pmidInfo = data.result[pmid];
      if (pmidInfo.error) {
        return { valid: false };
      }
      return { valid: true, title: pmidInfo.title };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("❌ Error: Supabase credentials not found.");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  console.log("📡 Connecting to Supabase and pulling herb database...");

  let page = 0;
  const pageSize = 1000;
  const allHerbs: Herb[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("herbs")
      .select("id, name, slug, scientific_name, description, citations, pregnancy_safe, nursing_safe, contraindications, side_effects")
      .order("name")
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("❌ Error loading herbs:", error);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    allHerbs.push(...(data as any[]));
    page++;
    if (data.length < pageSize) break;
  }

  console.log(`✅ Loaded ${allHerbs.length} herbs.`);

  // Let's run structural and safety logic audits on all 2,699 herbs
  console.log("\n🧪 Running full botanical and safety consistency audits...");

  let botanicalErrors = 0;
  let pregnancyConflicts = 0;
  let nursingConflicts = 0;
  let invalidPMIDStructures = 0;
  let herbsWithCitations = 0;
  let totalCitationsCount = 0;

  const pregnancyTriggers = /\b(avoid in pregnancy|pregnancy warning|do not use if pregnant|contraindicated in pregnancy|stimulate contractions|uterine stimulant|miscarriage)\b/i;
  const nursingTriggers = /\b(avoid while breastfeeding|do not use while nursing|lactation warning|excreted in breast milk)\b/i;

  const flaggedHerbs: Array<{
    name: string;
    slug: string;
    reason: string;
    details: string;
  }> = [];

  for (const herb of allHerbs) {
    // 1. Botanical Naming Check
    const nameWords = herb.scientific_name.trim().split(/\s+/);
    if (nameWords.length < 2) {
      botanicalErrors++;
      flaggedHerbs.push({
        name: herb.name,
        slug: herb.slug,
        reason: "Invalid Botanical Name",
        details: `Scientific name "${herb.scientific_name}" lacks genus or species representation.`,
      });
    }

    // 2. Pregnancy Safety Conflict Check
    const contraStr = (herb.contraindications || []).join(" ");
    const sideStr = (herb.side_effects || []).join(" ");
    const fullText = `${herb.description} ${contraStr} ${sideStr}`;

    if (herb.pregnancy_safe && pregnancyTriggers.test(fullText)) {
      pregnancyConflicts++;
      const match = fullText.match(pregnancyTriggers)?.[0];
      flaggedHerbs.push({
        name: herb.name,
        slug: herb.slug,
        reason: "Pregnancy Safety Conflict",
        details: `Marked as safe, but description/contraindications mention: "${match}".`,
      });
    }

    // 3. Nursing Safety Conflict Check
    if (herb.nursing_safe && nursingTriggers.test(fullText)) {
      nursingConflicts++;
      const match = fullText.match(nursingTriggers)?.[0];
      flaggedHerbs.push({
        name: herb.name,
        slug: herb.slug,
        reason: "Nursing Safety Conflict",
        details: `Marked as safe, but description/contraindications mention: "${match}".`,
      });
    }

    // 4. Citation Structure and PMID Check
    const citations = herb.citations as Citation[] | null;
    if (citations && Array.isArray(citations) && citations.length > 0) {
      herbsWithCitations++;
      totalCitationsCount += citations.length;

      for (const cit of citations) {
        if (cit.url) {
          // Check if it has a PMID
          const pmid = cit.pmid;
          if (pmid) {
            const pmidStr = String(pmid).trim();
            // Validate PMID format (only digits, 1-9 characters)
            if (!/^\d{1,9}$/.test(pmidStr)) {
              invalidPMIDStructures++;
              flaggedHerbs.push({
                name: herb.name,
                slug: herb.slug,
                reason: "Malforming PMID Structure",
                details: `PMID "${pmidStr}" has an invalid numerical format in citations list.`,
              });
            }

            // Validate that the URL correctly formats the PMID
            const expectedUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmidStr}/`;
            if (cit.url.toLowerCase() !== expectedUrl.toLowerCase()) {
              invalidPMIDStructures++;
              flaggedHerbs.push({
                name: herb.name,
                slug: herb.slug,
                reason: "Mismatching Citation URL",
                details: `Citation has PMID "${pmidStr}" but URL points to "${cit.url}" instead of "${expectedUrl}".`,
              });
            }
          }
        }
      }
    }
  }

  // Live Verification of a batch of PubMed citations to demonstrate live verification
  console.log("\n📡 Running Live PubMed PMID validation checks on sample...");
  console.log("Checking a sample of 15 PubMed PMIDs directly against the NCBI Entrez Database...");

  const verifySamplePMIDs: Array<{ pmid: string; herbName: string }> = [];
  for (const herb of allHerbs) {
    const citations = herb.citations as Citation[] | null;
    if (citations && Array.isArray(citations) && citations.length > 0) {
      for (const cit of citations) {
        if (cit.pmid) {
          verifySamplePMIDs.push({ pmid: String(cit.pmid), herbName: herb.name });
          if (verifySamplePMIDs.length >= 15) break;
        }
      }
    }
    if (verifySamplePMIDs.length >= 15) break;
  }

  let verifiedPMIDs = 0;
  let failedPMIDs = 0;
  const verifiedResults: Array<{ pmid: string; herb: string; valid: boolean; title?: string }> = [];

  for (const item of verifySamplePMIDs) {
    const result = await verifyPMIDWithPubMed(item.pmid);
    if (result.valid) {
      verifiedPMIDs++;
      verifiedResults.push({ pmid: item.pmid, herb: item.herbName, valid: true, title: result.title });
    } else {
      failedPMIDs++;
      verifiedResults.push({ pmid: item.pmid, herb: item.herbName, valid: false });
    }
    // Respect rate limit
    await delay(350);
  }

  // --- PRINT SUMMARY ---
  console.log("\n📋 =========================================================");
  console.log("       HERBALLY DATABASE QUALITY & SAFETY DIAGNOSTIC REPORT");
  console.log("=============================================================");
  console.log(`🔍 Total Herbs Scanned:                 ${allHerbs.length}`);
  console.log(`📚 Herbs with Citations:                ${herbsWithCitations} (${((herbsWithCitations / allHerbs.length) * 100).toFixed(1)}%)`);
  console.log(`🔗 Total Citations Scanned:             ${totalCitationsCount}`);
  console.log(`🌿 Botanical Name Structural Errors:    ${botanicalErrors}`);
  console.log(`🤰 Pregnancy Clinical Warnings Mismatches: ${pregnancyConflicts}`);
  console.log(`🤱 Nursing Clinical Warnings Mismatches:   ${nursingConflicts}`);
  console.log(`🚨 Mismarked / Broken PMID Formats:     ${invalidPMIDStructures}`);
  console.log("=============================================================");

  console.log("\n🔗 Live PubMed Entrez API Check results (15 Samples):");
  for (const r of verifiedResults) {
    if (r.valid) {
      console.log(`   ✅ PMID ${r.pmid} [Herb: ${r.herb}]: Valid!`);
      console.log(`      Title: "${r.title}"`);
    } else {
      console.log(`   ❌ PMID ${r.pmid} [Herb: ${r.herb}]: INVALID or Hallucinated PMID!`);
    }
  }

  if (flaggedHerbs.length > 0) {
    console.log(`\n🚨 Flagged Warnings requiring content revision: ${flaggedHerbs.length} items`);
    console.log("Showing top 5 examples:");
    flaggedHerbs.slice(0, 5).forEach((item, index) => {
      console.log(`   ${index + 1}. [${item.reason}] ${item.name} (${item.slug})`);
      console.log(`      ⚠️  ${item.details}`);
    });
  } else {
    console.log("\n🎉 No clinical or structural warnings found in the database. Excellent metadata consistency!");
  }
}

main().catch(console.error);
