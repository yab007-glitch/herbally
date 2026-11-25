import { getAnonClient } from "@/lib/supabase/anonymous";
import { shouldSuppressPublicAdultDose } from "@/lib/data/dangerous-herbs";
import {
  isPediatricOnlyOrTaggedDose,
  sanitizeAdultInclusiveDose,
  stripPediatricDosageSentences,
} from "@/lib/herbs/regulatory-evidence";
import type { VerifiedHerb } from "./types";

// Caps keep the injected prompt bounded: a popular herb can carry a dozen
// licensed-product claims and several imported monographs.
const REGULATORY_PURPOSES_CAP = 8;
const REGULATORY_DOSES_CAP = 4;
const REGULATORY_RISKS_CAP = 6;
const MONOGRAPH_CLAIMS_CAP = 8;
const MONOGRAPH_SAFETY_CAP = 6;
const MONOGRAPH_DOSES_CAP = 4;

/**
 * Coerce a jsonb column into short display lines, whatever shape it has.
 * `purposes` is a string[] (normalised 2026-11-16), `doses` is
 * { text, population, age_minimum }[], and older imported rows are plain
 * strings, so every shape has to survive.
 */
function toLines(value: unknown, cap: number): string[] {
  const out: string[] = [];

  const pushText = (raw: string): void => {
    const cleaned = stripPediatricDosageSentences(raw.trim());
    if (cleaned) out.push(cleaned);
  };

  const push = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === "string") {
      pushText(v);
      return;
    }
    if (typeof v === "number" || typeof v === "boolean") {
      out.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) push(item);
      return;
    }
    if (typeof v === "object") {
      const record = v as Record<string, unknown>;
      for (const key of [
        "text",
        "claim",
        "purpose",
        "indication",
        "dose",
        "safety",
        "risk",
        "label",
        "description",
        "name",
        "value",
      ]) {
        const candidate = record[key];
        if (typeof candidate === "string" && candidate.trim()) {
          // Keep the qualifier that makes a dose readable ("Adults: 1–2 g").
          const population = record.population;
          const qualifier =
            typeof population === "string" && population.trim()
              ? `${population.trim()}: `
              : "";
          pushText(`${qualifier}${candidate.trim()}`);
          return;
        }
      }
      const leaves = Object.values(record).filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0
      );
      if (leaves.length > 0) pushText(leaves.join(" · "));
    }
  };

  push(value);
  return Array.from(new Set(out)).slice(0, cap);
}

function toDoseLines(value: unknown, cap: number): string[] {
  const out: string[] = [];

  const push = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === "string") {
      const text = stripPediatricDosageSentences(v.trim());
      if (text && !isPediatricOnlyOrTaggedDose({ text })) out.push(text);
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) push(item);
      return;
    }
    if (typeof v === "object") {
      const record = v as Record<string, unknown>;
      for (const key of ["text", "dose", "value"]) {
        const candidate = record[key];
        if (typeof candidate === "string" && candidate.trim()) {
          const sanitized = sanitizeAdultInclusiveDose({
            text: candidate.trim(),
            population:
              typeof record.population === "string" ? record.population : null,
            age_minimum:
              typeof record.age_minimum === "number"
                ? record.age_minimum
                : null,
          });
          if (!sanitized) return;
          const qualifier = sanitized.population
            ? `${sanitized.population}: `
            : "";
          const formatted = `${qualifier}${sanitized.text}`;
          if (!isPediatricOnlyOrTaggedDose({ text: formatted })) {
            out.push(formatted);
          }
          return;
        }
      }
    }
  };

  push(value);
  return Array.from(new Set(out)).slice(0, cap);
}

function toStringArray(value: unknown, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => stripPediatricDosageSentences(v.trim()))
    .filter((v) => v.length > 0)
    .slice(0, cap);
}

/**
 * Attach the regulator's own record and any imported monograph to each herb.
 *
 * Both tables are anon-readable, so the same anon client serves them. Failure
 * to read them must never break the answer: the herbs row alone still grounds
 * the reply.
 */
export async function attachRegulatorRecords(
  herbs: VerifiedHerb[]
): Promise<void> {
  const slugs = Array.from(
    new Set(herbs.map((h) => h.slug).filter((s) => s.length > 0))
  );
  if (slugs.length === 0) return;

  const supabase = getAnonClient();
  if (!supabase) return;

  type RegulatoryRow = {
    herb_slug: string;
    source: string;
    purposes: unknown;
    doses: unknown;
    risks: unknown;
    source_urls: unknown;
  };
  type MonographRow = {
    herb_slug: string;
    source: string;
    licence: string | null;
    claims: unknown;
    safety: unknown;
    doses: unknown;
    url: string | null;
    monograph_date: string | null;
  };
  type SheetRow = {
    slug: string;
    content: Record<string, unknown> | null;
    pmids: string[] | null;
    article_count: number | null;
  };

  try {
    const [regulatoryResult, monographResult, sheetResult] = await Promise.all([
      supabase
        .from("herb_regulatory_evidence_public" as never)
        .select("herb_slug, source, purposes, doses, risks, source_urls")
        .in("herb_slug", slugs),
      supabase
        .from("herb_monograph_sources_public" as never)
        .select(
          "herb_slug, source, licence, claims, safety, doses, url, monograph_date"
        )
        .in("herb_slug", slugs),
      supabase
        .from("herb_pubmed_monographs_public" as never)
        .select("slug, content, pmids, article_count")
        .in("slug", slugs),
    ]);

    const groupBySlug = <T extends { herb_slug: string }>(
      rows: T[] | null | undefined
    ): Map<string, T[]> => {
      const bySlug = new Map<string, T[]>();
      for (const row of rows ?? []) {
        const list = bySlug.get(row.herb_slug) ?? [];
        list.push(row);
        bySlug.set(row.herb_slug, list);
      }
      return bySlug;
    };

    const regulatoryBySlug = groupBySlug(
      (regulatoryResult.data ?? []) as unknown as RegulatoryRow[]
    );
    const monographsBySlug = groupBySlug(
      (monographResult.data ?? []) as unknown as MonographRow[]
    );
    const sheetsBySlug = new Map<string, SheetRow>();
    for (const row of (sheetResult.data ?? []) as unknown as SheetRow[]) {
      if (row.slug) sheetsBySlug.set(row.slug, row);
    }

    const sheetText = (
      content: SheetRow["content"],
      key: string,
      cap: number
    ) => {
      const value = content?.[key];
      if (typeof value !== "string") return null;
      const text = stripPediatricDosageSentences(value.trim());
      if (!text) return null;
      return text.length > cap ? `${text.slice(0, cap).trimEnd()}…` : text;
    };

    for (const herb of herbs) {
      const isBlockedHerb = shouldSuppressPublicAdultDose(herb.slug);
      const regulatory = regulatoryBySlug.get(herb.slug)?.[0];
      if (regulatory) {
        herb.regulatory = {
          source: regulatory.source,
          purposes: toStringArray(regulatory.purposes, REGULATORY_PURPOSES_CAP),
          doses: isBlockedHerb
            ? []
            : toDoseLines(regulatory.doses, REGULATORY_DOSES_CAP),
          risks: toLines(regulatory.risks, REGULATORY_RISKS_CAP),
          urls: toStringArray(regulatory.source_urls, 3),
        };
      }

      herb.monographs = isBlockedHerb
        ? []
        : (monographsBySlug.get(herb.slug) ?? []).slice(0, 3).map((row) => ({
            source: row.source,
            licence: row.licence ?? null,
            claims: toLines(row.claims, MONOGRAPH_CLAIMS_CAP),
            safety: toLines(row.safety, MONOGRAPH_SAFETY_CAP),
            doses: toDoseLines(row.doses, MONOGRAPH_DOSES_CAP),
            url: row.url ?? null,
          }));

      const sheet = sheetsBySlug.get(herb.slug);
      if (sheet) {
        const doseKeys = [
          "dosageAndAdministration",
          "dosage_and_administration",
          "dosage",
          "dose",
          "doses",
          "dosing",
          "recommendedDosage",
          "recommended_dosage",
          "adultDosage",
          "adult_dosage",
          "administration",
          "posology",
          "posologie",
        ];
        const rawDosage = doseKeys
          .map((k) => sheetText(sheet.content, k, 400))
          .find((v): v is string => Boolean(v));
        const safeDosage = isBlockedHerb
          ? null
          : rawDosage
            ? stripPediatricDosageSentences(rawDosage) || null
            : null;
        herb.information_sheet = {
          summary: sheetText(sheet.content, "summary", 600),
          traditional_uses: sheetText(sheet.content, "traditionalUses", 400),
          dosage: safeDosage,
          safety: sheetText(sheet.content, "safetyAndAdverseEffects", 400),
          pregnancy: sheetText(sheet.content, "pregnancyAndLactation", 400),
          drug_interactions: sheetText(sheet.content, "drugInteractions", 400),
          article_count:
            typeof sheet.article_count === "number"
              ? sheet.article_count
              : null,
          pmids: Array.isArray(sheet.pmids)
            ? sheet.pmids
                .filter((p): p is string => typeof p === "string")
                .slice(0, 6)
            : [],
        };
      }
    }
  } catch {
    // Enrichment only — the herbs row is enough to answer.
  }
}
