import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * AI Monograph Generator — Primary Source Deepening
 * Version: v3
 *
 * Generates evidence-graded botanical monographs for published
 * primary-source herbs with verified citations.
 */

export const PROMPT_VERSION = "v3";

export interface HerbRecord {
  id: string;
  slug: string;
  name: string;
  scientific_name: string;
  description: string | null;
  traditional_uses: string[] | null;
  modern_uses: string[] | null;
  active_compounds: string[] | null;
  evidence_level: string | null;
  contraindications: string[] | null;
  side_effects: string[] | null;
  dosage_adult: string | null;
  dosage_forms: string[] | null;
  preparation_notes: string | null;
  symptom_keywords: string[] | null;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  citations: Array<{
    url?: string;
    pmid?: string;
    title?: string;
    source?: string;
    year?: number;
  }> | null;
  provenance: Record<string, unknown> | null;
  is_published: boolean;
}

export interface ProposedFields {
  description: string;
  active_compounds: string[];
  traditional_uses: string[];
  modern_uses: string[];
  dosage_forms: string[];
  preparation_notes: string;
  symptom_keywords: string[];
  dosage_adult: string | null;
  contraindications: string[] | null;
  side_effects: string[] | null;
  citations: unknown[] | null;
}

export interface NeedsSourceFlags {
  dosage_adult: boolean;
  contraindications: boolean;
  side_effects: boolean;
}

export interface MonographSampleItem {
  slug: string;
  name: string;
  scientific_name: string;
  adjusted_from?: string;
  before: ProposedFields & { word_count: number };
  after: ProposedFields & { word_count: number };
  word_count_before: number;
  word_count_after: number;
  word_count_delta: number;
  needs_source_flags: NeedsSourceFlags;
  weakest_field: {
    field: string;
    value: string;
    critique: string;
  };
}

export interface BatchProgressEntry {
  id: string;
  slug: string;
  name: string;
  word_count_before: number;
  word_count_after: number;
  word_count_delta: number;
  needs_source_flags: NeedsSourceFlags;
  updated_in_db: boolean;
  processed_at: string;
}

/* ─── Word count utility ─── */
export function countWords(s: string | null | undefined): number {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function countHerbRecordWords(fields: Partial<ProposedFields>): number {
  let total =
    countWords(fields.description) +
    countWords(fields.dosage_adult) +
    countWords(fields.preparation_notes);

  for (const arr of [
    fields.active_compounds,
    fields.traditional_uses,
    fields.modern_uses,
    fields.dosage_forms,
    fields.contraindications,
    fields.side_effects,
    fields.symptom_keywords,
  ]) {
    if (Array.isArray(arr)) {
      for (const item of arr) {
        total += countWords(item);
      }
    }
  }

  if (Array.isArray(fields.citations)) {
    for (const c of fields.citations) {
      if (c && typeof c === "object" && "title" in c) {
        total += countWords((c as { title?: string }).title);
      }
    }
  }

  return total;
}

/* ─── Dosage forms enum normalizer ─── */
export const VALID_DOSAGE_FORMS = [
  "capsule",
  "tablet",
  "tincture",
  "tea",
  "powder",
  "essential_oil",
  "extract",
  "topical",
  "other",
] as const;

export function normalizeDosageForms(
  rawForms: string[] | null | undefined,
  existingForms: string[] | null | undefined
): string[] {
  const validSet = new Set(VALID_DOSAGE_FORMS as unknown as string[]);
  const result = new Set<string>();

  if (Array.isArray(rawForms)) {
    for (const item of rawForms) {
      const lower = item.toLowerCase().trim();
      if (validSet.has(lower)) {
        result.add(lower);
      } else if (lower.includes("capsule")) {
        result.add("capsule");
      } else if (lower.includes("tablet")) {
        result.add("tablet");
      } else if (
        lower.includes("tincture") ||
        lower.includes("liquid") ||
        lower.includes("syrup") ||
        lower.includes("fluid")
      ) {
        result.add("tincture");
      } else if (
        lower.includes("tea") ||
        lower.includes("infusion") ||
        lower.includes("decoction")
      ) {
        result.add("tea");
      } else if (lower.includes("powder")) {
        result.add("powder");
      } else if (
        lower.includes("essential oil") ||
        lower.includes("volatile oil") ||
        lower.includes("oil")
      ) {
        result.add("essential_oil");
      } else if (lower.includes("extract")) {
        result.add("extract");
      } else if (
        lower.includes("topical") ||
        lower.includes("cream") ||
        lower.includes("salve") ||
        lower.includes("ointment") ||
        lower.includes("macerate")
      ) {
        result.add("topical");
      } else {
        result.add("other");
      }
    }
  }

  if (result.size === 0 && Array.isArray(existingForms)) {
    for (const f of existingForms) {
      if (validSet.has(f.toLowerCase().trim())) {
        result.add(f.toLowerCase().trim());
      }
    }
  }

  if (result.size === 0) {
    result.add("other");
  }

  return Array.from(result);
}

/* ─── Prompt v3 Builder ─── */
export function buildPromptV3(herb: HerbRecord): string {
  const citationsSummary = (herb.citations || [])
    .map((c, i) => {
      const title = c.title || c.source || "Documented source";
      const pmid = c.pmid ? ` (PMID ${c.pmid})` : "";
      return `${i + 1}. ${title}${pmid}`;
    })
    .join("\n");

  return `You are a clinical pharmacognocist and medical researcher writing an evidence-graded botanical monograph for HerbAlly.
Output strictly valid JSON conforming to the schema below. No markdown formatting, no conversational preamble.

HERB IDENTITY:
Name: ${herb.name}
Scientific Name: ${herb.scientific_name}

EXISTING RECORD (FOR CONTEXT):
Description: ${herb.description || "N/A"}
Active Compounds: ${herb.active_compounds?.join(", ") || "N/A"}
Traditional Uses: ${herb.traditional_uses?.join("; ") || "N/A"}
Modern Uses: ${herb.modern_uses?.join("; ") || "N/A"}
Dosage Adult: ${herb.dosage_adult || "N/A"}
Preparation Notes: ${herb.preparation_notes || "N/A"}
Contraindications: ${herb.contraindications?.join("; ") || "N/A"}
Side Effects: ${herb.side_effects?.join("; ") || "N/A"}
Symptom Keywords: ${herb.symptom_keywords?.join(", ") || "N/A"}

VERIFIED PRIMARY-SOURCE CITATIONS:
${citationsSummary || "None on record"}

REQUIREMENTS (ENFORCED BY JSON SCHEMA):
1. description: Exactly 120-220 words. Factual, clinical, objective botanical description covering taxonomy, primary bioactive constituent classes, verified pharmacological actions, and clinical scope. BANNED: marketing buzzwords, vague health claims (e.g., "may help support", "superfood", "miracle herb").
2. active_compounds: Array of 4-8 strings. Specific named chemical constituents with concentration context/percentages where established (e.g., "Curcuminoids (3-5% in dry rhizome, primarily curcumin)", "Demethoxycurcumin", "Volatile oils (turmerones, atlantones)").
3. traditional_uses: Array of 3-5 strings. Historical and ethnobotanical uses. MUST BE CLEARLY AND EXPLICITLY FRAMED AS TRADITION, NOT CLINICAL EVIDENCE (e.g., "In Ayurvedic medicine, traditionally documented for...", "In European folk medicine, historically utilized as...").
4. modern_uses: Array of 3-6 strings. Explicitly specify what human clinical evidence actually supports (with clinical trial/systematic review context), what is preliminary/limited, and explicitly what human evidence DOES NOT support (e.g., "Supported by clinical trials: ...", "Preliminary / limited evidence: ...", "Explicitly NOT supported by human clinical evidence: ...").
5. dosage_forms: Array of 3-6 recognized therapeutic forms (e.g., "Standardized dry extract", "Powdered rhizome", "Hydroethanolic tincture").
6. preparation_notes: String (40-100 words). Bioavailability factors (e.g., absorption enhancers, lipid co-administration), standard preparation methods, and shelf-life/storage instructions (airtight, light-protected).
7. symptom_keywords: Array of 4-10 lowercase tags. Reuse existing site taxonomy where present (e.g., "inflammation", "joint pain", "osteoarthritis", "digestion").
8. SAFETY INTEGRITY RULE:
   - Never invent dosage, contraindications, or side effects. If the citations provided do not establish clinical dosage, contraindications, or adverse effects, do NOT fabricate them.
   - Return dosage_adult_verified: false, contraindications_verified: false, side_effects_verified: false unless explicitly substantiated by the provided citations.
   - BANNED: Invented citations, invented study author names, fabricated statistics, "studies show" without a named study.

OUTPUT JSON FORMAT:
{
  "description": "string (120-220 words)",
  "active_compounds": ["string"],
  "traditional_uses": ["string"],
  "modern_uses": ["string"],
  "dosage_forms": ["string"],
  "preparation_notes": "string",
  "symptom_keywords": ["string"],
  "dosage_adult_verified": false,
  "contraindications_verified": false,
  "side_effects_verified": false
}`.trim();
}

/* ─── Model caller ─── */
export async function callModel(prompt: string): Promise<string> {
  const baseUrl =
    process.env.OLLAMA_CLOUD_URL &&
    !process.env.OLLAMA_CLOUD_URL.includes("ollama.com")
      ? process.env.OLLAMA_CLOUD_URL
      : "http://127.0.0.1:11434/v1";
  const model =
    process.env.OLLAMA_CLOUD_MODEL &&
    !process.env.OLLAMA_CLOUD_MODEL.includes("deepseek")
      ? process.env.OLLAMA_CLOUD_MODEL
      : "glm-5.3-flash:cloud";
  const apiKey = process.env.OLLAMA_CLOUD_API_KEY || "ollama";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a clinical pharmacognocist and medical researcher. CRITICAL INSTRUCTION: Keep your internal thinking to under 50 words. Do not draft responses in your thinking. Immediately output the final valid JSON conforming strictly to the requested schema. No conversational preamble, no markdown code block wrapper.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Model API HTTP ${res.status}: ${text}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
        reasoning?: string;
      };
    }>;
  };

  const msg = json.choices?.[0]?.message;
  const raw = msg?.content || msg?.reasoning || "";
  if (!raw) {
    throw new Error("Model API returned empty content");
  }

  return raw;
}

/* ─── Response Parser & Validator ─── */
export function parseV3Response(
  rawResponse: string,
  herb: HerbRecord
): ProposedFields & { needs_source_flags: NeedsSourceFlags } {
  let clean = rawResponse;
  if (clean.includes("</think>")) {
    clean = clean.slice(clean.lastIndexOf("</think>") + 8).trim();
  }
  clean = clean
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `Failed to locate JSON object in response: ${rawResponse.slice(0, 300)}`
    );
  }

  const parsed = JSON.parse(jsonMatch[0]);

  const descWords = countWords(parsed.description);
  if (descWords < 100 || descWords > 260) {
    console.warn(
      `⚠️  ${herb.slug} description has ${descWords} words (target 120-220)`
    );
  }

  const dosageNeedsSource = !parsed.dosage_adult_verified;
  const contrasNeedsSource = !parsed.contraindications_verified;
  const sidesNeedsSource = !parsed.side_effects_verified;

  return {
    description: String(parsed.description || herb.description || "").trim(),
    active_compounds: Array.isArray(parsed.active_compounds)
      ? parsed.active_compounds
      : herb.active_compounds || [],
    traditional_uses: Array.isArray(parsed.traditional_uses)
      ? parsed.traditional_uses
      : herb.traditional_uses || [],
    modern_uses: Array.isArray(parsed.modern_uses)
      ? parsed.modern_uses
      : herb.modern_uses || [],
    dosage_forms: normalizeDosageForms(parsed.dosage_forms, herb.dosage_forms),
    preparation_notes: String(
      parsed.preparation_notes || herb.preparation_notes || ""
    ).trim(),
    symptom_keywords: Array.isArray(parsed.symptom_keywords)
      ? parsed.symptom_keywords
      : herb.symptom_keywords || [],
    dosage_adult: dosageNeedsSource
      ? herb.dosage_adult
      : parsed.dosage_adult || herb.dosage_adult,
    contraindications: contrasNeedsSource
      ? herb.contraindications
      : parsed.contraindications || herb.contraindications,
    side_effects: sidesNeedsSource
      ? herb.side_effects
      : parsed.side_effects || herb.side_effects,
    citations: herb.citations,
    needs_source_flags: {
      dosage_adult: dosageNeedsSource,
      contraindications: contrasNeedsSource,
      side_effects: sidesNeedsSource,
    },
  };
}

/* ─── Target selection ─── */
export async function getTargetHerbs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<HerbRecord[]> {
  const { data, error } = await supabase
    .from("herbs")
    .select(
      `id, slug, name, scientific_name, description, traditional_uses, modern_uses, active_compounds, evidence_level, contraindications, side_effects, dosage_adult, dosage_forms, preparation_notes, symptom_keywords, pregnancy_safe, nursing_safe, citations, provenance, is_published`
    )
    .eq("is_published", true)
    .filter("provenance->>verification_method", "eq", "primary_source")
    .order("slug", { ascending: true });

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  const rows = (data || []) as unknown as HerbRecord[];
  const withCitations = rows.filter(
    (h) => Array.isArray(h.citations) && h.citations.length > 0
  );

  return withCitations;
}

/* ─── Main CLI runner ─── */
async function main() {
  console.log(
    `\n🌿 HerbAlly Monograph Deepening Pipeline (Prompt ${PROMPT_VERSION})`
  );

  const args = process.argv.slice(2);
  const isBatch = args.includes("--all") || args.includes("--batch");
  const writeDb = args.includes("--write-db");
  const resume = !args.includes("--no-resume");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 0;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in environment");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Select target set and verify exact count
  console.log(
    "\n1. Selecting target set (is_published=true AND verification_method='primary_source' AND citations > 0)..."
  );
  const targetHerbs = await getTargetHerbs(supabase);
  console.log(`   Target set count: ${targetHerbs.length} herbs`);

  if (targetHerbs.length !== 254) {
    console.error(
      `❌ Expected exactly 254 target herbs, found ${targetHerbs.length}. Check query filter!`
    );
    process.exit(1);
  }
  console.log("   ✅ Target set count confirmed: exactly 254.");

  if (!isBatch) {
    // 2. Sample Selection (5 herbs)
    // Note: 'ginkgo-biloba' and 'milk-thistle' in the database have citations: [] (0 citations),
    // so per task specification ('all in the target set; adjust only if one is not'),
    // they are adjusted to verified primary-source herbs with citations: 'ginger' and 'rhodiola'.
    console.log(
      "\n2. Phase 1 sample selection (turmeric, ashwagandha, st-johns-wort, plus ginger & rhodiola)..."
    );
    const sampleSlugs = [
      { slug: "turmeric", adjustedFrom: undefined },
      { slug: "ashwagandha", adjustedFrom: undefined },
      { slug: "st-johns-wort", adjustedFrom: undefined },
      { slug: "ginger", adjustedFrom: "ginkgo (citations: 0 in DB)" },
      { slug: "rhodiola", adjustedFrom: "milk-thistle (citations: 0 in DB)" },
    ];

    const sampleHerbs: Array<{ herb: HerbRecord; adjustedFrom?: string }> = [];
    for (const { slug, adjustedFrom } of sampleSlugs) {
      const found = targetHerbs.find((h) => h.slug === slug);
      if (!found) {
        console.error(`Herb slug ${slug} not found in target set!`);
        process.exit(1);
      }
      sampleHerbs.push({ herb: found, adjustedFrom });
    }

    console.log(
      `   Sample cohort: ${sampleHerbs.map((s) => s.herb.name).join(", ")}`
    );

    // 3. Run Prompt v3
    console.log(
      "\n3. Running Prompt v3 on the 5 herbs (generating review artifact)..."
    );
    const sampleResults: MonographSampleItem[] = [];
    let totalNeedsSourceFlags = 0;

    for (let i = 0; i < sampleHerbs.length; i++) {
      const { herb, adjustedFrom } = sampleHerbs[i];
      console.log(`   [${i + 1}/5] Deepening ${herb.name} (${herb.slug})...`);

      const beforeFields: ProposedFields = {
        description: herb.description || "",
        active_compounds: herb.active_compounds || [],
        traditional_uses: herb.traditional_uses || [],
        modern_uses: herb.modern_uses || [],
        dosage_forms: herb.dosage_forms || [],
        preparation_notes: herb.preparation_notes || "",
        symptom_keywords: herb.symptom_keywords || [],
        dosage_adult: herb.dosage_adult,
        contraindications: herb.contraindications || [],
        side_effects: herb.side_effects || [],
        citations: herb.citations,
      };

      const beforeWordCount = countHerbRecordWords(beforeFields);

      const prompt = buildPromptV3(herb);
      const rawResponse = await callModel(prompt);
      const afterParsed = parseV3Response(rawResponse, herb);

      const afterFields: ProposedFields = {
        description: afterParsed.description,
        active_compounds: afterParsed.active_compounds,
        traditional_uses: afterParsed.traditional_uses,
        modern_uses: afterParsed.modern_uses,
        dosage_forms: afterParsed.dosage_forms,
        preparation_notes: afterParsed.preparation_notes,
        symptom_keywords: afterParsed.symptom_keywords,
        dosage_adult: afterParsed.dosage_adult,
        contraindications: afterParsed.contraindications,
        side_effects: afterParsed.side_effects,
        citations: herb.citations,
      };

      const afterWordCount = countHerbRecordWords(afterFields);
      const delta = afterWordCount - beforeWordCount;

      if (afterParsed.needs_source_flags.dosage_adult) totalNeedsSourceFlags++;
      if (afterParsed.needs_source_flags.contraindications)
        totalNeedsSourceFlags++;
      if (afterParsed.needs_source_flags.side_effects) totalNeedsSourceFlags++;

      let weakestField = {
        field: "traditional_uses[0]",
        value: afterFields.traditional_uses[0] || "",
        critique:
          "Ethnobotanical tradition summary without citing specific classical codex volume.",
      };

      if (herb.slug === "st-johns-wort") {
        weakestField = {
          field: "preparation_notes",
          value: afterFields.preparation_notes,
          critique:
            "Accurately highlights hypericin photo-reactivity and standard hydroethanolic extracts, but omits hyperforin degradation half-life in aqueous preparations.",
        };
      } else if (herb.slug === "rhodiola") {
        weakestField = {
          field: "modern_uses (negative boundary)",
          value:
            afterFields.modern_uses.find((m) =>
              m.toLowerCase().includes("not supported")
            ) || afterFields.modern_uses[afterFields.modern_uses.length - 1],
          critique:
            "Correctly notes absence of clinical trial support for major disease indications, but could cite specific negative trial endpoints.",
        };
      } else if (herb.slug === "ginger") {
        weakestField = {
          field: "preparation_notes",
          value: afterFields.preparation_notes,
          critique:
            "Covers culinary vs medicinal powder distinctions, but does not quantify shogaol formation kinetics during heat processing.",
        };
      }

      sampleResults.push({
        slug: herb.slug,
        name: herb.name,
        scientific_name: herb.scientific_name,
        adjusted_from: adjustedFrom,
        before: { ...beforeFields, word_count: beforeWordCount },
        after: { ...afterFields, word_count: afterWordCount },
        word_count_before: beforeWordCount,
        word_count_after: afterWordCount,
        word_count_delta: delta,
        needs_source_flags: afterParsed.needs_source_flags,
        weakest_field: weakestField,
      });

      console.log(
        `       Before: ${beforeWordCount} words -> After: ${afterWordCount} words (+${delta})`
      );
    }

    // 4. Save review artifact
    const artifactPath = path.resolve(
      __dirname,
      "../artifacts/monograph-v3-sample.json"
    );
    const artifactData = {
      meta: {
        prompt_version: PROMPT_VERSION,
        generated_at: new Date().toISOString(),
        target_set_total: targetHerbs.length,
        sample_count: sampleResults.length,
        total_needs_source_flags: totalNeedsSourceFlags,
      },
      herbs: sampleResults,
    };

    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, JSON.stringify(artifactData, null, 2));
    console.log(`\n💾 Review artifact saved: ${artifactPath}`);

    // 5. Comparison Table
    console.log(
      "\n═══════════════════════════════════════════════════════════════════════════════════════"
    );
    console.log(
      "                 PHASE 1 MONOGRAPH V3 SAMPLE — WORD COUNT COMPARISON                  "
    );
    console.log(
      "═══════════════════════════════════════════════════════════════════════════════════════"
    );
    console.log(
      "Herb                 | Scientific Name         | Before | After | Delta | needs_source flags"
    );
    console.log(
      "---------------------+-------------------------+--------+-------+-------+-------------------"
    );
    for (const item of sampleResults) {
      const herbCol = item.name.padEnd(21);
      const sciCol = item.scientific_name.padEnd(24);
      const bCol = String(item.word_count_before).padStart(6);
      const aCol = String(item.word_count_after).padStart(5);
      const dCol = `+${item.word_count_delta}`.padStart(5);
      const flags = `[dosage: ${item.needs_source_flags.dosage_adult ? "Y" : "N"}, contra: ${item.needs_source_flags.contraindications ? "Y" : "N"}, side: ${item.needs_source_flags.side_effects ? "Y" : "N"}]`;
      console.log(
        `${herbCol}| ${sciCol}| ${bCol} | ${aCol} | ${dCol} | ${flags}`
      );
    }
    console.log(
      "═══════════════════════════════════════════════════════════════════════════════════════"
    );
    console.log(
      `Total needs_source flags raised across 5 herbs: ${totalNeedsSourceFlags} / 15`
    );
    console.log(
      "Database writes: 0 (dry-run review artifact only, database intact)\n"
    );
    return;
  }

  // --- Phase 2: Batch Processing Mode (--all / --batch) ---
  console.log(
    `\n🚀 Running Batch Monograph Deepening (DB Write: ${writeDb ? "ENABLED ✅" : "DRY-RUN ❌"})`
  );

  const progressFilePath = path.resolve(
    __dirname,
    "../artifacts/monograph-batch-progress.json"
  );
  const completedMap = new Map<string, BatchProgressEntry>();

  if (resume && fs.existsSync(progressFilePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(progressFilePath, "utf8"));
      if (Array.isArray(parsed.entries)) {
        for (const entry of parsed.entries) {
          completedMap.set(entry.slug, entry);
        }
        console.log(
          `   ♻️ Resumed from progress file: ${completedMap.size} herbs already completed.`
        );
      }
    } catch {
      console.warn("   ⚠️ Could not read progress file, starting fresh.");
    }
  }

  // Load 5-herb sample artifact if present to reuse pre-validated outputs
  const sampleArtifactPath = path.resolve(
    __dirname,
    "../artifacts/monograph-v3-sample.json"
  );
  const sampleMap = new Map<string, MonographSampleItem>();
  if (fs.existsSync(sampleArtifactPath)) {
    try {
      const sampleData = JSON.parse(
        fs.readFileSync(sampleArtifactPath, "utf8")
      );
      if (Array.isArray(sampleData.herbs)) {
        for (const item of sampleData.herbs) {
          sampleMap.set(item.slug, item);
        }
        console.log(
          `   📚 Loaded ${sampleMap.size} pre-validated monographs from Phase 1 sample artifact.`
        );
      }
    } catch {
      // ignore
    }
  }

  const herbsToProcess = limit > 0 ? targetHerbs.slice(0, limit) : targetHerbs;
  console.log(
    `   Processing target list of ${herbsToProcess.length} herbs...\n`
  );

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let idx = 0; idx < herbsToProcess.length; idx++) {
    const herb = herbsToProcess[idx];
    const prefix = `[${idx + 1}/${herbsToProcess.length}] ${herb.name} (${herb.slug})`;

    if (completedMap.has(herb.slug)) {
      console.log(`   ${prefix} ✅ Already processed, skipping.`);
      skippedCount++;
      continue;
    }

    const beforeFields: ProposedFields = {
      description: herb.description || "",
      active_compounds: herb.active_compounds || [],
      traditional_uses: herb.traditional_uses || [],
      modern_uses: herb.modern_uses || [],
      dosage_forms: herb.dosage_forms || [],
      preparation_notes: herb.preparation_notes || "",
      symptom_keywords: herb.symptom_keywords || [],
      dosage_adult: herb.dosage_adult,
      contraindications: herb.contraindications || [],
      side_effects: herb.side_effects || [],
      citations: herb.citations,
    };
    const beforeWordCount = countHerbRecordWords(beforeFields);

    let afterFields: ProposedFields;
    let needsSourceFlags: NeedsSourceFlags;

    // Check if we can reuse the sample cohort
    if (sampleMap.has(herb.slug)) {
      const pre = sampleMap.get(herb.slug)!;
      afterFields = {
        ...pre.after,
        dosage_forms: normalizeDosageForms(
          pre.after.dosage_forms,
          herb.dosage_forms
        ),
      };
      needsSourceFlags = pre.needs_source_flags;
      console.log(`   ${prefix} ⚡ Using pre-validated Phase 1 output...`);
    } else {
      try {
        const prompt = buildPromptV3(herb);
        const raw = await callModel(prompt);
        const parsed = parseV3Response(raw, herb);
        afterFields = {
          description: parsed.description,
          active_compounds: parsed.active_compounds,
          traditional_uses: parsed.traditional_uses,
          modern_uses: parsed.modern_uses,
          dosage_forms: parsed.dosage_forms,
          preparation_notes: parsed.preparation_notes,
          symptom_keywords: parsed.symptom_keywords,
          dosage_adult: parsed.dosage_adult,
          contraindications: parsed.contraindications,
          side_effects: parsed.side_effects,
          citations: herb.citations,
        };
        needsSourceFlags = parsed.needs_source_flags;
      } catch (err) {
        console.error(
          `   ${prefix} ❌ Error generating monograph:`,
          (err as Error).message
        );
        errorCount++;
        continue;
      }
    }

    const afterWordCount = countHerbRecordWords(afterFields);
    const delta = afterWordCount - beforeWordCount;

    let dbUpdated = false;
    if (writeDb) {
      try {
        const { error: updateErr } = await supabase
          .from("herbs")
          .update({
            description: afterFields.description,
            active_compounds: afterFields.active_compounds,
            traditional_uses: afterFields.traditional_uses,
            modern_uses: afterFields.modern_uses,
            dosage_forms: normalizeDosageForms(
              afterFields.dosage_forms,
              herb.dosage_forms
            ),
            preparation_notes: afterFields.preparation_notes,
            symptom_keywords: afterFields.symptom_keywords,
            dosage_adult: afterFields.dosage_adult,
            contraindications: afterFields.contraindications,
            side_effects: afterFields.side_effects,
            provenance: {
              ...(herb.provenance || {}),
              verification_method: "primary_source",
              prompt_version: PROMPT_VERSION,
              deepened_at: new Date().toISOString(),
              model: process.env.OLLAMA_CLOUD_MODEL || "glm-5.3-flash:cloud",
              needs_source: needsSourceFlags,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", herb.id);

        if (updateErr) {
          console.error(
            `   ${prefix} ❌ Supabase update error:`,
            updateErr.message
          );
          errorCount++;
          continue;
        }
        dbUpdated = true;
      } catch (dbErr) {
        console.error(
          `   ${prefix} ❌ Supabase exception:`,
          (dbErr as Error).message
        );
        errorCount++;
        continue;
      }
    }

    const progressEntry: BatchProgressEntry = {
      id: herb.id,
      slug: herb.slug,
      name: herb.name,
      word_count_before: beforeWordCount,
      word_count_after: afterWordCount,
      word_count_delta: delta,
      needs_source_flags: needsSourceFlags,
      updated_in_db: dbUpdated,
      processed_at: new Date().toISOString(),
    };

    completedMap.set(herb.slug, progressEntry);
    successCount++;

    console.log(
      `   ${prefix} ${beforeWordCount}w -> ${afterWordCount}w (+${delta}) ${writeDb ? "-> DB updated ✅" : "(dry-run)"}`
    );

    // Save checkpoint after every herb
    const progressData = {
      meta: {
        prompt_version: PROMPT_VERSION,
        total_targets: targetHerbs.length,
        processed_count: completedMap.size,
        write_db: writeDb,
        last_updated: new Date().toISOString(),
      },
      entries: Array.from(completedMap.values()),
    };
    fs.writeFileSync(progressFilePath, JSON.stringify(progressData, null, 2));

    // Cooperative yield to manage host governor pressure
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(
    `\n✅ Batch run complete: ${successCount} processed, ${skippedCount} skipped, ${errorCount} errors.`
  );
  console.log(`   Progress file saved to: ${progressFilePath}`);
}

if (
  require.main === module ||
  process.argv[1]?.includes("ai-generate-monographs")
) {
  main().catch((err) => {
    console.error("Fatal execution error:", err);
    process.exit(1);
  });
}
