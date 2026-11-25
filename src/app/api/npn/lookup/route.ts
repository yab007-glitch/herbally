import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import {
  cleanBotanicalIngredientName,
  formatLnhpdStatus,
  normalizeNpnInput,
  parseLnhpdArray,
  type LnhpdDoseRow,
  type LnhpdIngredientRow,
  type LnhpdLicenceRow,
  type LnhpdPurposeRow,
  type LnhpdRiskRow,
} from "@/lib/npn/lnhpd";
import { resolveHerb } from "@/lib/interactions/resolve-herb";
import { getHerbPairs } from "@/lib/interactions/pairs";
import { isPediatricOnlyOrTaggedDose } from "@/lib/herbs/regulatory-evidence";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";

const npnQuerySchema = z.object({
  npn: z.string().trim().min(1).max(32),
  locale: z.enum(["en", "fr"]).optional(),
});

const LNHPD_BASE = "https://health-products.canada.ca/api/natural-licences";
const HC_HEADERS = {
  "User-Agent": "HerbAlly/1.0 (+https://herbally.app)",
  Accept: "application/json",
};

async function fetchLnhpdJson(
  endpoint: string,
  id: string | number,
  locale: "en" | "fr",
  timeoutMs = 8_500
): Promise<unknown> {
  const url = `${LNHPD_BASE}/${endpoint}/?lang=${locale}&type=json&id=${encodeURIComponent(String(id))}`;
  const res = await fetch(url, {
    headers: HC_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`Health Canada LNHPD ${endpoint} HTTP ${res.status}`);
  }
  return res.json();
}

export async function GET(request: NextRequest) {
  const { success } = await rateLimit(
    rateLimitKey("npn-lookup", getClientIP(request)),
    30,
    60_000
  );
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute.", rateLimited: true },
      {
        status: 429,
        headers: { "Retry-After": "60", "Cache-Control": "no-store" },
      }
    );
  }

  const parsedQuery = npnQuerySchema.safeParse({
    npn: request.nextUrl.searchParams.get("npn") ?? "",
    locale: request.nextUrl.searchParams.get("locale") ?? undefined,
  });
  const npn = parsedQuery.success
    ? normalizeNpnInput(parsedQuery.data.npn)
    : null;
  if (!npn) {
    return NextResponse.json(
      {
        error:
          "Enter a valid 8-digit Health Canada NPN or DIN-HM (e.g. 80000001).",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const locale: "en" | "fr" =
    parsedQuery.data?.locale === "fr" ||
    request.headers.get("x-locale") === "fr"
      ? "fr"
      : "en";

  try {
    const licencePayload = await fetchLnhpdJson("productlicence", npn, locale);
    const parsedLicences = parseLnhpdArray<LnhpdLicenceRow>(licencePayload);
    if (!parsedLicences.ok) {
      throw new Error("Unexpected Health Canada LNHPD productlicence payload");
    }
    const licences = parsedLicences.rows;

    if (licences.length === 0) {
      return NextResponse.json(
        {
          error:
            locale === "fr"
              ? `Aucun produit trouvé dans le registre de Santé Canada pour le NPN ${npn}.`
              : `No Health Canada LNHPD record found for NPN ${npn}.`,
          notFound: true,
        },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const licence = licences[0];
    const lnhpdId = licence.lnhpd_id;

    const [ingredientsRes, purposesRes, risksRes, dosesRes] =
      await Promise.allSettled([
        fetchLnhpdJson("medicinalingredient", lnhpdId, locale),
        fetchLnhpdJson("productpurpose", lnhpdId, locale),
        fetchLnhpdJson("productrisk", lnhpdId, locale),
        fetchLnhpdJson("productdose", lnhpdId, locale),
      ]);

    function resolveSection<T>(res: PromiseSettledResult<unknown>): {
      status: "ok" | "unavailable";
      rows: T[];
    } {
      if (res.status !== "fulfilled") {
        return { status: "unavailable", rows: [] };
      }
      const parsed = parseLnhpdArray<T>(res.value);
      if (!parsed.ok) {
        return { status: "unavailable", rows: [] };
      }
      return { status: "ok", rows: parsed.rows };
    }

    const ingredientsSection =
      resolveSection<LnhpdIngredientRow>(ingredientsRes);
    const purposesSection = resolveSection<LnhpdPurposeRow>(purposesRes);
    const risksSection = resolveSection<LnhpdRiskRow>(risksRes);
    const dosesSection = resolveSection<LnhpdDoseRow>(dosesRes);

    const sectionStatus = {
      ingredients: ingredientsSection.status,
      purposes: purposesSection.status,
      risks: risksSection.status,
      doses: dosesSection.status,
    };

    const unavailableSections = (
      Object.entries(sectionStatus) as Array<
        [keyof typeof sectionStatus, "ok" | "unavailable"]
      >
    )
      .filter(([, status]) => status === "unavailable")
      .map(([section]) => section);

    if (unavailableSections.length === 4) {
      logger.error("npn_lookup_all_sections_failed", { npn, lnhpdId });
      return NextResponse.json(
        {
          error:
            locale === "fr"
              ? "Impossible de récupérer les détails du produit auprès de Santé Canada pour le moment."
              : "Could not retrieve product details from Health Canada's LNHPD register right now.",
          unavailableSections,
        },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rawIngredients = ingredientsSection.rows;
    const rawPurposes = purposesSection.rows;
    const rawRisks = risksSection.rows;
    const rawDoses = dosesSection.rows;

    // Resolve distinct botanical names against HerbAlly herbs (cap 12 lookups)
    const uniqueCleaned = new Map<string, string>();
    for (const row of rawIngredients.slice(0, 20)) {
      const orig = (row.ingredient_name ?? "").trim();
      if (!orig) continue;
      const cleaned = cleanBotanicalIngredientName(orig);
      if (cleaned.length >= 3 && !uniqueCleaned.has(cleaned.toLowerCase())) {
        uniqueCleaned.set(cleaned.toLowerCase(), cleaned);
      }
    }

    const herbMatchMap = new Map<
      string,
      {
        slug: string;
        name: string;
        scientificName: string;
        interactionCount: number;
      } | null
    >();

    let herbMatchingUnavailable = false;
    await Promise.all(
      [...uniqueCleaned.entries()].slice(0, 12).map(async ([key, cleaned]) => {
        try {
          const matched = await resolveHerb(cleaned);
          if (!matched) {
            herbMatchMap.set(key, null);
            return;
          }
          const pairs = await getHerbPairs(matched.slug, locale);
          herbMatchMap.set(key, {
            slug: matched.slug,
            name:
              locale === "fr" && matched.frName ? matched.frName : matched.name,
            scientificName: matched.scientific_name,
            interactionCount: pairs.length,
          });
        } catch (err) {
          herbMatchingUnavailable = true;
          logger.warn("npn_herb_matching_unavailable", {
            error: err instanceof Error ? err.message : String(err),
          });
          herbMatchMap.set(key, null);
        }
      })
    );

    const ingredients = rawIngredients.map((row) => {
      const name = (row.ingredient_name ?? "").trim();
      const cleaned = cleanBotanicalIngredientName(name).toLowerCase();
      return {
        name,
        cleanedName: cleanBotanicalIngredientName(name),
        quantity: row.quantity ?? null,
        unit: row.quantity_unit_of_measure ?? null,
        potencyAmount: row.potency_amount ?? null,
        potencyConstituent: row.potency_constituent || null,
        potencyUnit: row.potency_unit_of_measure || null,
        dhe: row.dried_herb_equivalent || null,
        dheUnit: row.dhe_unit_of_measure || null,
        extractType: row.extract_type_desc || null,
        sourceMaterial: row.source_material || null,
        matchedHerb: herbMatchMap.get(cleaned) ?? null,
      };
    });

    const purposes = [
      ...new Set(
        rawPurposes
          .map((p) => (p.purpose ?? "").trim())
          .filter((p) => p.length > 0)
      ),
    ];

    const risks = rawRisks
      .filter((r) => (r.risk_text ?? "").trim().length > 0)
      .map((r) => ({
        type: (r.risk_type_desc ?? "").trim(),
        subType: (r.sub_risk_type_desc ?? "").trim(),
        text: (r.risk_text ?? "").trim(),
      }));

    const doses = rawDoses
      .filter((d) => {
        const pop = (d.population_type_desc ?? "").trim();
        const combined = [
          pop,
          d.quantity_dose != null ? String(d.quantity_dose) : "",
          (d.uom_type_desc_quantity_dose ?? "").trim(),
        ]
          .filter(Boolean)
          .join(" ");
        return !isPediatricOnlyOrTaggedDose({
          population: pop,
          text: combined,
        });
      })
      .map((d) => ({
        population: (d.population_type_desc ?? "").trim(),
        quantity: d.quantity_dose ?? null,
        unit: (d.uom_type_desc_quantity_dose ?? "").trim(),
        frequency: d.frequency ?? null,
        frequencyUnit: (d.uom_type_desc_frequency ?? "").trim(),
      }));

    const statusInfo = formatLnhpdStatus(licence.flag_product_status, locale);
    const partial = unavailableSections.length > 0 || herbMatchingUnavailable;

    return NextResponse.json(
      {
        npn: licence.licence_number ?? npn,
        lnhpdId,
        locale,
        productName: licence.product_name ?? `NPN ${npn}`,
        companyName: licence.company_name ?? null,
        dosageForm: licence.dosage_form ?? null,
        submissionType: licence.sub_submission_type_desc ?? null,
        licenceDate: licence.licence_date ?? null,
        revisedDate: licence.revised_date ?? null,
        status: statusInfo,
        partial,
        unavailableSections,
        sectionStatus,
        herbMatchingUnavailable,
        ingredients,
        purposes,
        risks,
        doses,
        sourceUrl:
          locale === "fr"
            ? `https://produits-sante.canada.ca/lnhpd-bdpsnh/info?licence=${licence.licence_number ?? npn}`
            : `https://health-products.canada.ca/lnhpd-bdpsnh/info?licence=${licence.licence_number ?? npn}`,
      },
      {
        headers: {
          "Cache-Control": partial
            ? "no-store"
            : "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" ||
        error.name === "AbortError" ||
        /timed out|aborted/i.test(error.message));
    logger.error("npn_lookup_failed", {
      isTimeout,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: isTimeout
          ? locale === "fr"
            ? "Le registre public de Santé Canada tarde à répondre ou ce NPN est introuvable. Réessayez dans un instant."
            : "Health Canada's public LNHPD register timed out or did not recognise that NPN. Please verify the 8 digits and try again."
          : locale === "fr"
            ? "Impossible de joindre le registre de Santé Canada pour le moment."
            : "Could not reach Health Canada's LNHPD register right now.",
        timeout: isTimeout,
      },
      {
        status: isTimeout ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
