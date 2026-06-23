#!/usr/bin/env tsx
/**
 * verify-herb-content.ts — Comprehensive automated content verification
 * for all published herbs in the HerbAlly database.
 *
 * Checks performed:
 *   1. PubMed PMID validation (sampled — hits NCBI API to verify citations are real)
 *   2. Scientific name binomial nomenclature format
 *   3. Safety flag consistency (pregnancy_safe vs contraindications)
 *   4. Required field completeness (description, uses, compounds)
 *   5. Evidence grade correctness (verify auto-assigned grade matches data)
 *   6. Dosage data presence for published herbs
 *   7. Duplicate detection (same scientific name)
 *
 * Output: JSON report to stdout + human-readable summary to stderr.
 *
 * Usage:
 *   npx tsx scripts/verify-herb-content.ts                    # Full check
 *   npx tsx scripts/verify-herb-content.ts --pmid-check       # Include PubMed API verification (slow)
 *   npx tsx scripts/verify-herb-content.ts --slug=ginger      # Single herb
 *   npx tsx scripts/verify-herb-content.ts --format=json      # JSON output only
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

// ─── Types ──────────────────────────────────────────────────────────

interface HerbRow {
  id: string;
  name: string;
  slug: string;
  scientific_name: string;
  description: string | null;
  evidence_level: string | null;
  traditional_uses: string[] | null;
  modern_uses: string[] | null;
  active_compounds: string[] | null;
  contraindications: string[] | null;
  side_effects: string[] | null;
  dosage_adult: string | null;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  pregnancy_safe_oral: boolean | null;
  pregnancy_safe_topical: boolean | null;
  nursing_safe_oral: boolean | null;
  nursing_safe_topical: boolean | null;
  citations: unknown;
  provenance: unknown;
  is_published: boolean;
  view_count: number | null;
}

interface VerificationIssue {
  slug: string;
  name: string;
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
}

// ─── Validation Functions ───────────────────────────────────────────

const BINOMIAL_REGEX = /^[A-Z][a-z]+ [a-z-]+/; // Genus species
const PMID_REGEX = /^\d{7,8}$/;
const VALID_EVIDENCE_LEVELS = ["A", "B", "C", "D", "trad"];

function validateHerb(herb: HerbRow): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const { name, slug, scientific_name, description } = herb;

  // 1. Required fields
  if (!name || name.trim().length < 2) {
    issues.push({
      slug,
      name,
      severity: "error",
      category: "required_field",
      message: "Name is empty or too short",
    });
  }
  if (!scientific_name || scientific_name.trim().length < 2) {
    issues.push({
      slug,
      name,
      severity: "error",
      category: "required_field",
      message: "Scientific name is empty",
    });
  }
  if (!slug || slug.trim().length < 2) {
    issues.push({
      slug,
      name,
      severity: "error",
      category: "required_field",
      message: "Slug is empty",
    });
  }
  if (!description || description.trim().length < 20) {
    issues.push({
      slug,
      name,
      severity: "warning",
      category: "required_field",
      message: "Description is missing or too short (<20 chars)",
    });
  }

  // 2. Scientific name format (binomial nomenclature)
  if (scientific_name && scientific_name.trim().length > 0) {
    const trimmed = scientific_name.trim();
    if (!BINOMIAL_REGEX.test(trimmed)) {
      // Allow some exceptions (single-word names, names with var./subsp./x)
      if (!/^[A-Z][a-z]+/.test(trimmed)) {
        issues.push({
          slug,
          name,
          severity: "warning",
          category: "scientific_name",
          message: `Does not follow binomial format: "${trimmed}"`,
        });
      }
    }
  }

  // 3. Safety flag consistency
  // If pregnancy_safe is true but contraindications include "pregnancy", that's a conflict
  const contra = herb.contraindications || [];
  if (herb.pregnancy_safe === true) {
    const pregContra = contra.find((c) => /pregnan/i.test(c));
    if (pregContra) {
      issues.push({
        slug,
        name,
        severity: "error",
        category: "safety_conflict",
        message: `pregnancy_safe=true but contraindication says: "${pregContra}"`,
      });
    }
  }
  if (herb.nursing_safe === true) {
    const nurseContra = contra.find((c) => /nurs|breastfeed|lactat/i.test(c));
    if (nurseContra) {
      issues.push({
        slug,
        name,
        severity: "error",
        category: "safety_conflict",
        message: `nursing_safe=true but contraindication says: "${nurseContra}"`,
      });
    }
  }
  // If pregnancy_safe is false, contraindications should mention pregnancy
  if (herb.pregnancy_safe === false) {
    const mentionsPregnancy = contra.some((c) => /pregnan/i.test(c));
    if (!mentionsPregnancy) {
      issues.push({
        slug,
        name,
        severity: "info",
        category: "safety_completeness",
        message:
          "pregnancy_safe=false but no pregnancy-related contraindication listed",
      });
    }
  }

  // 4. Uses completeness
  const tradUses = herb.traditional_uses || [];
  const modernUses = herb.modern_uses || [];
  if (tradUses.length === 0 && modernUses.length === 0) {
    issues.push({
      slug,
      name,
      severity: "warning",
      category: "data_completeness",
      message: "No traditional or modern uses listed",
    });
  }

  // 5. Active compounds
  const compounds = herb.active_compounds || [];
  if (compounds.length === 0) {
    issues.push({
      slug,
      name,
      severity: "info",
      category: "data_completeness",
      message: "No active compounds listed",
    });
  }

  // 6. Dosage
  if (!herb.dosage_adult || herb.dosage_adult.trim().length < 3) {
    issues.push({
      slug,
      name,
      severity: "info",
      category: "data_completeness",
      message: "No adult dosage listed",
    });
  }

  // 7. Evidence level validation
  if (
    herb.evidence_level &&
    !VALID_EVIDENCE_LEVELS.includes(herb.evidence_level)
  ) {
    issues.push({
      slug,
      name,
      severity: "error",
      category: "evidence_level",
      message: `Invalid evidence level: "${herb.evidence_level}"`,
    });
  }

  // 8. Evidence grade cross-check against provenance and citations
  const provenance = herb.provenance as {
    verification_method?: string;
    sources?: string[];
  } | null;
  const citations = herb.citations as Array<{
    pmid?: string;
    url?: string;
  }> | null;
  const pmidCount = Array.isArray(citations)
    ? citations.filter((c) => c.pmid && PMID_REGEX.test(String(c.pmid))).length
    : 0;
  const sourceCount = provenance?.sources?.length ?? 0;
  const method = provenance?.verification_method ?? "unverified";

  const expectedGrade =
    sourceCount >= 2 && pmidCount > 0
      ? "A"
      : sourceCount >= 1 && pmidCount > 0
        ? "B"
        : pmidCount > 0
          ? "C"
          : "trad";

  if (herb.evidence_level !== expectedGrade) {
    issues.push({
      slug,
      name,
      severity: "warning",
      category: "evidence_mismatch",
      message: `Evidence level is "${herb.evidence_level}" but data suggests "${expectedGrade}" (${sourceCount} sources, ${pmidCount} PMIDs, method: ${method})`,
    });
  }

  // 9. Provenance method cross-check
  const expectedMethod =
    sourceCount > 0
      ? "primary_source"
      : pmidCount > 0
        ? "ai_summarized"
        : "unverified";
  if (method !== expectedMethod && method !== "manual") {
    issues.push({
      slug,
      name,
      severity: "info",
      category: "provenance_mismatch",
      message: `Provenance method is "${method}" but data suggests "${expectedMethod}" (${sourceCount} sources, ${pmidCount} PMIDs)`,
    });
  }

  // 10. Citation PMID format validation
  if (Array.isArray(citations)) {
    for (const cite of citations) {
      if (cite.pmid && !PMID_REGEX.test(String(cite.pmid))) {
        issues.push({
          slug,
          name,
          severity: "error",
          category: "citation",
          message: `Invalid PMID format: "${cite.pmid}"`,
        });
      }
      if (cite.pmid && !cite.url) {
        issues.push({
          slug,
          name,
          severity: "warning",
          category: "citation",
          message: `PMID ${cite.pmid} has no URL`,
        });
      }
    }
  }

  return issues;
}

// ─── PubMed API Verification (optional, slow) ──────────────────────

async function verifyPmid(
  pmid: string
): Promise<{ valid: boolean; title?: string; error?: string }> {
  try {
    const res = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return { valid: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as {
      result?: Record<string, { title?: string; error?: string }>;
    };
    const entry = data.result?.[pmid];
    if (!entry) return { valid: false, error: "No result entry" };
    if (entry.error) return { valid: false, error: entry.error };
    return { valid: true, title: entry.title };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const doPmidCheck = process.argv.includes("--pmid-check");
  const jsonOutput = process.argv.includes("--format=json");
  const slugArg = process.argv.find((a) => a.startsWith("--slug="));

  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch all herbs with pagination
  const selectCols =
    "id, name, slug, scientific_name, description, evidence_level, traditional_uses, modern_uses, active_compounds, contraindications, side_effects, dosage_adult, pregnancy_safe, nursing_safe, pregnancy_safe_oral, pregnancy_safe_topical, nursing_safe_oral, nursing_safe_topical, citations, provenance, is_published, view_count";

  const allHerbs: HerbRow[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from("herbs")
      .select(selectCols)
      .eq("is_published", true)
      .order("name");
    if (slugArg) {
      query = query.eq("slug", slugArg.split("=")[1]);
    }
    const { data, error } = await query.range(
      page * pageSize,
      (page + 1) * pageSize - 1
    );
    if (error) {
      console.error("Fetch error:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allHerbs.push(...(data as HerbRow[]));
    if (data.length < pageSize || slugArg) break;
    page++;
  }

  process.stderr.write(`Verifying ${allHerbs.length} herbs...\n`);

  // Run validation on all herbs
  const allIssues: VerificationIssue[] = [];
  const herbIssuesMap = new Map<string, VerificationIssue[]>();

  // Track scientific names for duplicate detection
  const sciNameMap = new Map<string, string[]>();

  for (const herb of allHerbs) {
    const issues = validateHerb(herb);
    if (issues.length > 0) {
      allIssues.push(...issues);
      herbIssuesMap.set(herb.slug, issues);
    }

    // Track duplicates by scientific name
    const sciKey = herb.scientific_name?.toLowerCase().trim();
    if (sciKey) {
      const existing = sciNameMap.get(sciKey) || [];
      existing.push(herb.slug);
      sciNameMap.set(sciKey, existing);
    }
  }

  // Check for duplicates
  for (const [sciName, slugs] of sciNameMap) {
    if (slugs.length > 1) {
      for (const slug of slugs) {
        allIssues.push({
          slug,
          name: allHerbs.find((h) => h.slug === slug)?.name || slug,
          severity: "warning",
          category: "duplicate_scientific_name",
          message: `Scientific name "${sciName}" shared by: ${slugs.filter((s) => s !== slug).join(", ")}`,
        });
      }
    }
  }

  // Optional: Verify PMIDs against PubMed API (sample to keep it fast)
  let pmidStats = { checked: 0, valid: 0, invalid: 0, notFound: 0 };
  if (doPmidCheck) {
    process.stderr.write("Verifying PMIDs against PubMed API (sampling)...\n");

    // Collect unique PMIDs — check up to 100 across the whole dataset
    const pmidsToCheck = new Set<string>();
    for (const herb of allHerbs) {
      const citations = herb.citations as Array<{
        pmid?: string;
        url?: string;
      }> | null;
      if (Array.isArray(citations)) {
        for (const c of citations) {
          if (c.pmid && PMID_REGEX.test(String(c.pmid))) {
            pmidsToCheck.add(String(c.pmid));
            if (pmidsToCheck.size >= 100) break;
          }
        }
      }
      if (pmidsToCheck.size >= 100) break;
    }

    for (const pmid of pmidsToCheck) {
      const result = await verifyPmid(pmid);
      pmidStats.checked++;
      if (result.valid) {
        pmidStats.valid++;
      } else {
        pmidStats.invalid++;
        // Find which herbs have this PMID
        for (const herb of allHerbs) {
          const citations = herb.citations as Array<{
            pmid?: string;
            url?: string;
          }> | null;
          if (
            Array.isArray(citations) &&
            citations.some((c) => String(c.pmid) === pmid)
          ) {
            allIssues.push({
              slug: herb.slug,
              name: herb.name,
              severity: "error",
              category: "pmid_invalid",
              message: `PMID ${pmid} not found in PubMed: ${result.error}`,
            });
          }
        }
      }
      // Rate limit: ~3 req/sec
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  // Sort issues by severity (errors first), then by slug
  const severityOrder = { error: 0, warning: 1, info: 2 };
  allIssues.sort((a, b) => {
    const sv = severityOrder[a.severity] - severityOrder[b.severity];
    if (sv !== 0) return sv;
    return a.slug.localeCompare(b.slug);
  });

  // Output
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          total_herbs: allHerbs.length,
          total_issues: allIssues.length,
          pmid_verification: pmidStats,
          issues: allIssues,
        },
        null,
        2
      )
    );
  } else {
    // Human-readable to stderr
    process.stderr.write("\n");
    process.stderr.write(
      "═══════════════════════════════════════════════════════════\n"
    );
    process.stderr.write("HERBALLY CONTENT VERIFICATION REPORT\n");
    process.stderr.write(
      "═══════════════════════════════════════════════════════════\n\n"
    );

    // Summary by category
    const byCategory = new Map<
      string,
      { error: number; warning: number; info: number }
    >();
    for (const issue of allIssues) {
      const cat = byCategory.get(issue.category) || {
        error: 0,
        warning: 0,
        info: 0,
      };
      cat[issue.severity]++;
      byCategory.set(issue.category, cat);
    }

    process.stderr.write("Summary by category:\n");
    for (const [cat, counts] of byCategory) {
      process.stderr.write(
        `  ${cat}: ${counts.error} errors, ${counts.warning} warnings, ${counts.info} info\n`
      );
    }

    // Summary by severity
    const errors = allIssues.filter((i) => i.severity === "error");
    const warnings = allIssues.filter((i) => i.severity === "warning");
    const infos = allIssues.filter((i) => i.severity === "info");

    process.stderr.write(
      `\nTotal: ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info\n`
    );

    if (doPmidCheck) {
      process.stderr.write(
        `\nPubMed PMID verification: ${pmidStats.checked} checked, ${pmidStats.valid} valid, ${pmidStats.invalid} invalid\n`
      );
    }

    // Herbs with no issues
    const cleanHerbs = allHerbs.length - herbIssuesMap.size;
    process.stderr.write(
      `\nHerbs with no issues: ${cleanHerbs}/${allHerbs.length} (${Math.round((cleanHerbs / allHerbs.length) * 100)}%)\n`
    );

    // Print errors
    if (errors.length > 0) {
      process.stderr.write(`\n═══ ERRORS (${errors.length}) ═══\n`);
      for (const issue of errors.slice(0, 50)) {
        process.stderr.write(
          `  [${issue.category}] ${issue.name} (${issue.slug}): ${issue.message}\n`
        );
      }
      if (errors.length > 50) {
        process.stderr.write(`  ... and ${errors.length - 50} more errors\n`);
      }
    }

    // Print warnings
    if (warnings.length > 0) {
      process.stderr.write(`\n═══ WARNINGS (${warnings.length}) ═══\n`);
      for (const issue of warnings.slice(0, 50)) {
        process.stderr.write(
          `  [${issue.category}] ${issue.name} (${issue.slug}): ${issue.message}\n`
        );
      }
      if (warnings.length > 50) {
        process.stderr.write(
          `  ... and ${warnings.length - 50} more warnings\n`
        );
      }
    }

    // Print info
    if (infos.length > 0) {
      process.stderr.write(`\n═══ INFO (${infos.length}) ═══\n`);
      for (const issue of infos.slice(0, 30)) {
        process.stderr.write(
          `  [${issue.category}] ${issue.name} (${issue.slug}): ${issue.message}\n`
        );
      }
      if (infos.length > 30) {
        process.stderr.write(
          `  ... and ${infos.length - 30} more info items\n`
        );
      }
    }

    process.stderr.write(
      "\n═══════════════════════════════════════════════════════════\n"
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
