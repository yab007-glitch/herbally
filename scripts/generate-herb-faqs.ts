#!/usr/bin/env tsx
/**
 * Batch FAQ generator for HerbAlly
 * Generates 4-6 high-quality FAQ pairs per herb using Ollama Cloud Pro.
 * Optimized for Google Featured Snippets.
 *
 * Usage:
 *   npx tsx scripts/generate-herb-faqs.ts [--concurrency=10] [--model=glm-5]
 */

import { createClient } from "@supabase/supabase-js";
import { chatCompletion } from "@/lib/ai/ollama-cloud-client";
import { logger } from "@/lib/utils/logger";
import * as fs from "fs";
import * as path from "path";

const PROGRESS_FILE = path.join(process.cwd(), "scripts", ".faq-batch-progress.json");
const REJECTED_FILE = path.join(process.cwd(), "scripts", ".faq-batch-rejected.json");

const CONCURRENCY = parseInt(process.argv.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? "10", 10);
const MODEL = process.argv.find((a) => a.startsWith("--model="))?.split("=")[1] ?? undefined;

if (MODEL) process.env.OLLAMA_CLOUD_MODEL = MODEL;

interface Herb {
  id: string;
  slug: string;
  name: string;
  scientific_name: string;
  description: string | null;
  traditional_uses: string[] | null;
  modern_uses: string[] | null;
  active_compounds: string[] | null;
  dosage_adult: string | null;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  contraindications: string[] | null;
  side_effects: string[] | null;
  evidence_level: string | null;
}

interface FAQPair {
  question: string;
  answer: string;
  category: string;
}

interface Progress {
  completed: Record<string, string>;
  failed: Record<string, string>;
}

function loadProgress(): Progress {
  if (!fs.existsSync(PROGRESS_FILE)) return { completed: {}, failed: {} };
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  } catch {
    return { completed: {}, failed: {} };
  }
}

function saveProgress(progress: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function appendRejected(slug: string, reason: string) {
  const existing = fs.existsSync(REJECTED_FILE) ? JSON.parse(fs.readFileSync(REJECTED_FILE, "utf-8")) : [];
  existing.push({ slug, reason, timestamp: new Date().toISOString() });
  fs.writeFileSync(REJECTED_FILE, JSON.stringify(existing, null, 2));
}

function getSystemPrompt(): string {
  return `You are a medical herbalist and SEO copywriter. Generate 4-6 FAQ pairs for a medicinal herb page.

Rules:
- Each question must be specific, natural-language, and likely to be typed into Google
- Each answer must be 40-120 words, evidence-based, and directly answer the question
- Include one question about mechanism of action (for Featured Snippets)
- Include one question about drug interactions (high search volume)
- Include one question about dosage
- Include one question about safety/pregnancy
- Cite evidence levels where applicable (A, B, C, D, Traditional)
- NEVER make up specific clinical trial data; use general evidence statements
- Output STRICT JSON only, no markdown code blocks, no backticks: { "faqs": [{"question":"...","answer":"...","category":"general|safety|dosage|interactions|mechanism"}] }
- The answer must be self-contained (no "see above" or "as mentioned")`;
}

function getUserPrompt(herb: Herb): string {
  const uses = [...(herb.traditional_uses || []), ...(herb.modern_uses || [])].slice(0, 5).join(", ") || "various uses";
  const compounds = (herb.active_compounds || []).slice(0, 5).join(", ") || "various compounds";
  const pregnancy = herb.pregnancy_safe === true ? "safe" : herb.pregnancy_safe === false ? "unsafe" : "unknown";
  const evidence = herb.evidence_level || "C";

  return `Generate FAQ pairs for ${herb.name} (${herb.scientific_name}).

Description: ${herb.description || "A medicinal herb"}
Uses: ${uses}
Active compounds: ${compounds}
Evidence level: ${evidence}
Pregnancy safety: ${pregnancy}
Adult dosage: ${herb.dosage_adult || "Varies by preparation"}
Side effects: ${(herb.side_effects || []).join("; ") || "Generally mild"}
Contraindications: ${(herb.contraindications || []).join("; ") || "None major documented"}

Generate 4-6 FAQ pairs. Output as JSON. No markdown wrappers.`;
}

function extractJson(text: string): string {
  let clean = text.trim();
  // Remove markdown code blocks more aggressively
  clean = clean.replace(/^\s*```json\s*/i, "");
  clean = clean.replace(/^\s*```\s*/i, "");
  clean = clean.replace(/\s*```\s*$/i, "");
  clean = clean.replace(/^\s*`+/, "").replace(/`+\s*$/, "");
  clean = clean.trim();
  // If there are multiple code blocks, try to find the JSON object
  const jsonMatch = clean.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    const candidate = jsonMatch[1].trim();
    // Ensure it starts with { and ends with }
    if (candidate.startsWith("{") && candidate.endsWith("}")) {
      return candidate;
    }
  }
  return clean;
}

function validateFaqs(faqs: FAQPair[]): { valid: boolean; reason?: string } {
  if (!Array.isArray(faqs) || faqs.length < 3) {
    return { valid: false, reason: `Expected 3+ FAQs, got ${faqs?.length || 0}` };
  }
  for (const faq of faqs) {
    if (!faq.question || faq.question.length < 20) {
      return { valid: false, reason: `Question too short: "${faq.question}"` };
    }
    if (!faq.answer || faq.answer.length < 60) {
      return { valid: false, reason: `Answer too short for: "${faq.question}"` };
    }
    if (faq.answer.length > 800) {
      return { valid: false, reason: `Answer too long (${faq.answer.length} chars) for: "${faq.question}"` };
    }
    if (!faq.category || !["general", "safety", "dosage", "interactions", "mechanism"].includes(faq.category)) {
      return { valid: false, reason: `Invalid category for: "${faq.question}"` };
    }
  }
  return { valid: true };
}

async function generateFaqsForHerb(herb: Herb): Promise<FAQPair[]> {
  const response = await chatCompletion({
    messages: [
      { role: "system", content: getSystemPrompt() },
      { role: "user", content: getUserPrompt(herb) },
    ],
    temperature: 0.35,
    max_tokens: 4000,
    response_format: { type: "json_object" },
    retry: 3,
  });

  const cleanResponse = extractJson(response);
  const parsed = JSON.parse(cleanResponse);
  const faqs = parsed.faqs || parsed.FAQs || parsed.faq || [];

  const validation = validateFaqs(faqs);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  return faqs;
}

async function processHerb(
  herb: Herb,
  supabase: any,
  progress: Progress
): Promise<void> {
  try {
    const faqs = await generateFaqsForHerb(herb);

    const rows = faqs.map((faq, index) => ({
      herb_id: herb.id,
      question: faq.question.trim(),
      answer: faq.answer.trim(),
      category: faq.category,
      source: "ai-generated",
      confidence_score: 0.85,
      is_featured: index < 2,
      sort_order: index,
    }));

    const { error } = await supabase.from("herb_faqs").upsert(rows as any, {
      onConflict: "herb_id,question",
    });

    if (error) {
      throw new Error(`DB insert failed: ${error.message}`);
    }

    progress.completed[herb.slug] = new Date().toISOString();
    console.log(`✅ ${herb.name}: ${faqs.length} FAQs generated`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    progress.failed[herb.slug] = reason;
    appendRejected(herb.slug, reason);
    console.error(`❌ ${herb.name}: ${reason}`);
  }
}

async function fetchAllHerbs(supabase: any): Promise<Herb[]> {
  const allHerbs: Herb[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("herbs")
      .select("id, slug, name, scientific_name, description, traditional_uses, modern_uses, active_compounds, dosage_adult, pregnancy_safe, nursing_safe, contraindications, side_effects, evidence_level")
      .eq("is_published", true)
      .order("view_count", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("Failed to fetch herbs:", error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    allHerbs.push(...data);
    offset += pageSize;

    if (data.length < pageSize) {
      hasMore = false;
    }
  }

  return allHerbs;
}

async function runBatch() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const progress = loadProgress();

  console.log("Loading published herbs...");

  const allHerbs = await fetchAllHerbs(supabase);

  // Fetch herbs that already have FAQs to skip them
  const { data: faqHerbs } = await supabase
    .from("herb_faqs")
    .select("herb_id")
    .limit(5000);

  const faqHerbIds = new Set((faqHerbs || []).map((f: any) => f.herb_id));

  const herbsNeedingFaqs = allHerbs.filter((h: any) => !faqHerbIds.has(h.id)) as Herb[];
  const pending = herbsNeedingFaqs.filter((h) => !progress.completed[h.slug] && !progress.failed[h.slug]);

  console.log(`Total herbs: ${allHerbs.length}`);
  console.log(`Herbs already with FAQs: ${faqHerbIds.size}`);
  console.log(`Already completed in this run: ${Object.keys(progress.completed).length}`);
  console.log(`Previously failed in this run: ${Object.keys(progress.failed).length}`);
  console.log(`Pending: ${pending.length}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Model: ${process.env.OLLAMA_CLOUD_MODEL || "default"}`);
  console.log("---");

  if (pending.length === 0) {
    console.log("All herbs have FAQs! Nothing to do.");
    return;
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((herb) => processHerb(herb, supabase, progress)));
    saveProgress(progress);

    const completed = Object.keys(progress.completed).length;
    const failed = Object.keys(progress.failed).length;
    const pct = ((completed / herbsNeedingFaqs.length) * 100).toFixed(1);
    console.log(`Progress: ${completed}/${herbsNeedingFaqs.length} completed, ${failed} failed (${pct}%)`);
  }

  console.log("\n=== FAQ Generation Complete ===");
  console.log(`Completed: ${Object.keys(progress.completed).length}`);
  console.log(`Failed: ${Object.keys(progress.failed).length}`);
  console.log(`Progress saved to: ${PROGRESS_FILE}`);
}

runBatch().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
