import { pairPath } from "@/lib/interactions/pair-url";
import { SEVERITY_WEIGHT } from "@/lib/interactions/stack";
import {
  OPEN_DATA_DATASET_VERSION,
  type OpenDataAtomicSnapshot,
} from "@/lib/open-data/snapshot";

export const OPEN_DATA_HTTP_CACHE_POLICY = {
  cacheControl: "public, max-age=0, s-maxage=60, must-revalidate",
  corsAllowOrigin: "*",
  isrRevalidateSeconds: 3600,
} as const;

/** Canonical pretty-printed JSON serializer shared across routes & manifest SHA-256 digests. */
export function serializeOpenDataJson(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

export function buildCatalogPayload(
  snapshot: OpenDataAtomicSnapshot,
  baseUrl: string
) {
  const { stats, activePairs, medications, quarantinedBotanicals } = snapshot;

  const publishedInteractionPairs =
    activePairs.length > 0 ? activePairs.length : stats.totalInteractions;
  const medicationsAndClasses =
    medications.length > 0 ? medications.length : stats.totalMedications;
  const clinicianSignedInteractions =
    activePairs.length > 0
      ? activePairs.filter(
          (p) => p.clinicalActionStatus === "clinician_approved"
        ).length
      : stats.clinicianApprovedInteractions;
  const legacyUnreviewedInteractions = Math.max(
    0,
    publishedInteractionPairs - clinicianSignedInteractions
  );

  return {
    service: "HerbAlly",
    url: baseUrl,
    datasetVersion: OPEN_DATA_DATASET_VERSION,
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    httpCachePolicy: OPEN_DATA_HTTP_CACHE_POLICY,
    editorialContact: "info@herbally.app",
    license:
      "CC BY 4.0 for HerbAlly compilation metadata; cited regulatory excerpts retain publisher licences (see /methodology)",
    countsAvailable: stats.available,
    counts: {
      publishedHerbs: stats.totalHerbs,
      sourceCheckedHerbs: stats.sourceCheckedHerbs,
      clinicianSignedHerbs: stats.clinicallyReviewedHerbs,
      publishedInteractionPairs,
      medicationsAndClasses,
      clinicianSignedInteractions,
      legacyUnreviewedInteractions,
      quarantinedToxicBotanicals: quarantinedBotanicals.length,
    },
    privacyGuarantees: {
      zeroThirdPartyAdTrackers: true,
      zeroMarketingCookiesOnClinicalRoutes: true,
      guestChatRetentionDays: 30,
      clientSideOnlyConsultationExport: true,
      adsLaunchGateEnabled: false,
      privacyContact: "info@herbally.app",
      privacyPolicyUrl: `${baseUrl}/privacy`,
      privacyManifestUrl: `${baseUrl}/open-data/privacy-manifest.json`,
    },
    evidenceHierarchy: {
      tier1:
        "National regulatory monographs (Health Canada LNHPD/NHP, EMA HMPC) & systematic reviews/RCTs",
      tier2: "Human pharmacokinetic & clinical interaction studies",
      tier3: "Clinical case reports & pharmacovigilance signals",
      tier4:
        "Preclinical in vitro / animal mechanistic studies (explicitly labelled)",
      conflictResolutionRule:
        "Higher human clinical evidence overrides preclinical speculation; unresolved source conflicts are surfaced simultaneously or held in quarantined_collision status; absence of a record never implies safety.",
    },
    sources: [
      {
        name: "Health Canada LNHPD & NHP Monographs",
        licence: "Open Government Licence – Canada (OGL-Canada)",
        url: "https://health-products.canada.ca/lnhpd-bdpsnh/",
      },
      {
        name: "EMA HMPC Monographs",
        licence: "EMA Legal Notice (attribution required)",
        url: "https://www.ema.europa.eu/en/human-regulatory-overview/herbal-medicinal-products",
      },
      {
        name: "NIH NCCIH / ODS / LiverTox",
        licence: "US Federal Public Domain (17 U.S.C. §105)",
        url: "https://nccih.nih.gov/",
      },
      {
        name: "PubMed & PubChem (NCBI)",
        licence: "NLM Data Terms / Metadata & CIDs",
        url: "https://pubmed.ncbi.nlm.nih.gov/",
      },
      {
        name: "GBIF Backbone & Wikidata",
        licence: "CC BY 4.0 (GBIF) / CC0 1.0 (Wikidata)",
        url: "https://www.gbif.org/",
      },
    ],
    endpoints: {
      llmsTxt: `${baseUrl}/llms.txt`,
      llmsFullTxt: `${baseUrl}/llms-full.txt`,
      sitemap: `${baseUrl}/sitemap.xml`,
      rss: `${baseUrl}/rss.xml`,
      medications: `${baseUrl}/medications`,
      medicationsJson: `${baseUrl}/open-data/medications.json`,
      interactionsJson: `${baseUrl}/open-data/interactions.json`,
      quarantineJson: `${baseUrl}/open-data/quarantine.json`,
      privacyManifestJson: `${baseUrl}/open-data/privacy-manifest.json`,
      reviewQueueJson: `${baseUrl}/open-data/review-queue.json`,
      manifestJson: `${baseUrl}/open-data/manifest.json`,
      openApiSchemaJson: `${baseUrl}/open-data/schema.json`,
      sourceMonitorLatestJson: `${baseUrl}/open-data/source-monitor-latest.json`,
      securityTxt: `${baseUrl}/.well-known/security.txt`,
      trustCenter: `${baseUrl}/trust`,
      interactionChecker: `${baseUrl}/herb-drug-interactions`,
      npnDecoder: `${baseUrl}/npn-checker`,
      widgets: `${baseUrl}/widgets`,
      clinicalReview: `${baseUrl}/clinical-review`,
      editorialPolicy: `${baseUrl}/editorial-policy`,
      methodology: `${baseUrl}/methodology`,
    },
  };
}

export function buildMedicationsPayload(
  snapshot: OpenDataAtomicSnapshot,
  baseUrl: string
) {
  const { medications, activePairs } = snapshot;

  const totalInteractionPairs =
    activePairs.length > 0
      ? activePairs.length
      : medications.reduce((sum, m) => sum + m.totalInteractions, 0);

  return {
    service: "HerbAlly",
    dataset: "medications",
    url: `${baseUrl}/open-data/medications.json`,
    datasetVersion: OPEN_DATA_DATASET_VERSION,
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    license:
      "CC BY 4.0 for HerbAlly compilation metadata; primary sources retain publisher licences (see /methodology)",
    totalMedications: medications.length,
    totalInteractionPairs,
    medications: medications.map((m) => ({
      drugSlug: m.drugSlug,
      drugName: m.drugName,
      url: `${baseUrl}/medications/${m.drugSlug}`,
      urlFr: `${baseUrl}/fr/medications/${m.drugSlug}`,
      totalInteractions: m.totalInteractions,
      clinicianSignedCount: m.publishedCount,
      legacyUnreviewedCount: m.legacyCount,
      reviewStatus:
        m.publishedCount > 0 && m.legacyCount === 0
          ? "clinician_reviewed"
          : "awaiting_clinical_review",
      highestSeverity: m.highestSeverity,
      countsBySeverity: m.countsBySeverity,
      sampleHerbs: m.sampleHerbs,
    })),
  };
}

export function buildInteractionsPayload(
  snapshot: OpenDataAtomicSnapshot,
  baseUrl: string
) {
  const { activePairs } = snapshot;

  const clinicianSignedPairs = activePairs.filter(
    (p) => p.clinicalActionStatus === "clinician_approved"
  ).length;

  return {
    service: "HerbAlly",
    dataset: "herb_drug_interactions",
    url: `${baseUrl}/open-data/interactions.json`,
    datasetVersion: OPEN_DATA_DATASET_VERSION,
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    license:
      "CC BY 4.0 for HerbAlly compilation metadata; cited primary sources retain publisher licences (see /methodology)",
    totalPairs: activePairs.length,
    clinicianSignedPairs,
    legacyUnreviewedPairs: Math.max(
      0,
      activePairs.length - clinicianSignedPairs
    ),
    interactions: activePairs.map((p) => ({
      id: p.id,
      herbSlug: p.herbSlug,
      herbName: p.herbName,
      herbScientificName: p.herbScientificName,
      drugSlug: p.drugSlug,
      drugName: p.drugName,
      url: `${baseUrl}${pairPath(p.herbSlug, p.drugName)}`,
      urlFr: p.hasFr
        ? `${baseUrl}/fr${pairPath(p.herbSlug, p.drugName)}`
        : null,
      severity: p.severity,
      evidenceLevel: p.evidenceLevel,
      evidenceTier: p.evidenceTier ?? "unknown",
      extrapolationScope: p.extrapolationScope ?? "unverified",
      mechanism: p.mechanism,
      description: p.description,
      source: p.source,
      sourceUrl: p.sourceUrl,
      evidenceNote: p.evidenceNote,
      publicationStatus: p.publicationStatus ?? "legacy_unreviewed",
      clinicalActionStatus:
        p.clinicalActionStatus ?? "blocked_legacy_unreviewed",
      clinicianSigned: p.clinicalActionStatus === "clinician_approved",
      hasFr: p.hasFr,
      updatedAt: p.updatedAt,
    })),
  };
}

export function buildQuarantinePayload(
  snapshot: OpenDataAtomicSnapshot,
  baseUrl: string
) {
  const records = snapshot.quarantinedBotanicals;

  return {
    service: "HerbAlly",
    dataset: "toxic_botanical_quarantine",
    url: `${baseUrl}/open-data/quarantine.json`,
    datasetVersion: OPEN_DATA_DATASET_VERSION,
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    policy:
      "Permanent toxic botanical quarantine: no therapeutic use, dosing, FAQ, supplement claims, or ads.",
    emergencyContacts: {
      usPoisonControl: "1-800-222-1222",
      canadaPoisonControl: "1-844-764-7669",
      emergency: "911",
    },
    totalQuarantinedBotanicals: records.length,
    botanicals: records.map((r) => ({
      slug: r.slug,
      url: `${baseUrl}/herbs/${r.slug}`,
      urlFr: `${baseUrl}/fr/herbs/${r.slug}`,
      quarantineStatus: "permanent_toxic_quarantine",
      affectedParts: r.parts,
      hazardEn: r.reason,
      hazardFr: r.reasonFr,
    })),
  };
}

export function buildOpenApiSchemaPayload(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "HerbAlly Open Botanical Safety Data & Interaction API",
      version: OPEN_DATA_DATASET_VERSION,
      summary:
        "Machine-readable bilingual botanical reference, herb–drug interaction lookup, toxic quarantine registry, cryptographic Open Data manifest, and Health Canada NPN lookup endpoints.",
      description:
        "Educational reference APIs and CC BY 4.0 compilation datasets published by HerbAlly. Absence of an interaction record never implies safety; legacy records without licensed clinical sign-off carry explicit clinical review blockers.",
      contact: {
        name: "HerbAlly Editorial & Privacy Desk",
        email: "info@herbally.app",
        url: `${baseUrl}/trust`,
      },
      license: {
        name: "CC BY 4.0 (compilation metadata)",
        url: "https://creativecommons.org/licenses/by/4.0/",
      },
    },
    servers: [
      {
        url: baseUrl,
        description: "HerbAlly Production",
      },
    ],
    paths: {
      "/open-data/catalog.json": {
        get: {
          operationId: "getOpenDataCatalog",
          summary:
            "Live governance counts, privacy guarantees, evidence hierarchy, source licences, and endpoints",
          responses: {
            "200": {
              description: "CORS-enabled Open Data catalog snapshot",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CatalogResponse" },
                },
              },
            },
          },
        },
      },
      "/open-data/medications.json": {
        get: {
          operationId: "getOpenDataMedications",
          summary: "All documented medications and drug classes (145 entries)",
          responses: {
            "200": {
              description: "CORS-enabled reverse medication lookup dataset",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/MedicationsDataset" },
                },
              },
            },
          },
        },
      },
      "/open-data/interactions.json": {
        get: {
          operationId: "getOpenDataInteractions",
          summary:
            "All active curated herb–drug interaction pairs with citations and review flags (515 entries)",
          responses: {
            "200": {
              description: "CORS-enabled curated interaction pair dataset",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/InteractionsDataset" },
                },
              },
            },
          },
        },
      },
      "/open-data/quarantine.json": {
        get: {
          operationId: "getOpenDataQuarantine",
          summary:
            "Permanently quarantined toxic botanicals and Poison Control emergency numbers (115 entries)",
          responses: {
            "200": {
              description: "CORS-enabled toxic botanical quarantine registry",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/QuarantineDataset" },
                },
              },
            },
          },
        },
      },
      "/open-data/privacy-manifest.json": {
        get: {
          operationId: "getOpenDataPrivacyManifest",
          summary:
            "Machine-readable Quebec Law 25 / PIPEDA privacy, cookie, retention, and sub-processor registry",
          responses: {
            "200": {
              description:
                "CORS-enabled structured privacy and sub-processor manifest",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/PrivacyManifestResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/open-data/review-queue.json": {
        get: {
          operationId: "getOpenDataReviewQueue",
          summary:
            "Prioritized queue of unreviewed contraindicated and severe interaction pairs for PharmD/RPh/MD intake",
          responses: {
            "200": {
              description:
                "CORS-enabled clinical review priority queue sharing unified snapshotId",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReviewQueueResponse" },
                },
              },
            },
          },
        },
      },
      "/open-data/manifest.json": {
        get: {
          operationId: "getOpenDataManifest",
          summary:
            "Cryptographic SHA-256 digests, byte lengths, and record counts across all atomic Open Data files",
          responses: {
            "200": {
              description:
                "CORS-enabled SHA-256 integrity manifest sharing unified snapshotId",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ManifestResponse" },
                },
              },
            },
          },
        },
      },
      "/open-data/schema.json": {
        get: {
          operationId: "getOpenApiSchema",
          summary: "OpenAPI 3.1.0 machine-readable specification",
          responses: {
            "200": {
              description: "OpenAPI 3.1.0 JSON document",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/open-data/source-monitor-latest.json": {
        get: {
          operationId: "getSourceMonitorLatestReport",
          summary:
            "Verified Source & OpenAPI Monitor JSON artifact plus live GitHub Actions workflow run links",
          responses: {
            "200": {
              description: "Verified source monitor JSON report",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/.well-known/security.txt": {
        get: {
          operationId: "getSecurityTxt",
          summary: "RFC 9116 vulnerability disclosure policy contact file",
          responses: {
            "200": {
              description: "Plaintext RFC 9116 security.txt metadata",
              content: {
                "text/plain": { schema: { type: "string" } },
              },
            },
          },
        },
      },
      "/api/interactions/check": {
        get: {
          operationId: "checkSingleInteraction",
          summary: "Check one herb against one medication or drug class",
          parameters: [
            {
              name: "herb",
              in: "query",
              required: true,
              schema: { type: "string", minLength: 2, maxLength: 200 },
              example: "turmeric",
            },
            {
              name: "drug",
              in: "query",
              required: true,
              schema: { type: "string", minLength: 2, maxLength: 200 },
              example: "warfarin",
            },
            {
              name: "locale",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["en", "fr"], default: "en" },
            },
          ],
          responses: {
            "200": {
              description:
                "Lookup completed (found=true for curated record, found=false when absent or withheld=true on retracted citation)",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/InteractionCheckResponse",
                  },
                },
              },
            },
            "400": {
              description: "Invalid or too-short/too-long query parameters",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "429": {
              description:
                "Sliding-window rate limit exceeded (Retry-After: 60)",
              headers: {
                "Retry-After": {
                  schema: { type: "integer", example: 60 },
                },
              },
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "503": {
              description: "Database unavailable (unavailable=true)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/interactions/check-stack": {
        post: {
          operationId: "checkInteractionStack",
          summary: "Check up to 10 herbs against up to 10 medications",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StackCheckRequest" },
              },
            },
          },
          responses: {
            "200": {
              description:
                "Matrix evaluation of matches, conflicts, withheld citations, 7-class overlap alerts, and unrecorded combinations",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/StackCheckResponse" },
                },
              },
            },
            "400": {
              description: "Malformed JSON or invalid herb/drug array lengths",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "413": {
              description: "Request payload exceeds 16 KB limit",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "429": {
              description:
                "Sliding-window rate limit exceeded (Retry-After: 60)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "503": {
              description: "Database unavailable",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/npn/lookup": {
        get: {
          operationId: "lookupHealthCanadaNpn",
          summary:
            "Look up an 8-digit Health Canada NPN / DIN-HM in LNHPD (licence status vs market status)",
          parameters: [
            {
              name: "npn",
              in: "query",
              required: true,
              schema: { type: "string", pattern: "^[0-9]{8}$" },
              example: "80000001",
            },
          ],
          responses: {
            "200": {
              description: "Health Canada LNHPD licence and ingredient payload",
              content: {
                "application/json": { schema: { type: "object" } },
              },
            },
            "400": {
              description: "NPN must be exactly 8 digits",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "NPN not found in LNHPD",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "429": {
              description: "Rate limit exceeded",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        CatalogResponse: {
          type: "object",
          required: [
            "service",
            "url",
            "datasetVersion",
            "snapshotId",
            "generatedAt",
            "counts",
            "sources",
            "endpoints",
          ],
          properties: {
            service: { type: "string" },
            url: { type: "string", format: "uri" },
            datasetVersion: { type: "string" },
            snapshotId: { type: "string" },
            generatedAt: { type: "string", format: "date-time" },
            editorialContact: { type: "string", format: "email" },
            license: { type: "string" },
            countsAvailable: { type: "boolean" },
            counts: {
              type: "object",
              properties: {
                publishedHerbs: { type: "integer" },
                sourceCheckedHerbs: { type: "integer" },
                clinicianSignedHerbs: { type: "integer" },
                publishedInteractionPairs: { type: "integer" },
                medicationsAndClasses: { type: "integer" },
                clinicianSignedInteractions: { type: "integer" },
                legacyUnreviewedInteractions: { type: "integer" },
                quarantinedToxicBotanicals: { type: "integer" },
              },
            },
            privacyGuarantees: { type: "object" },
            evidenceHierarchy: { type: "object" },
            sources: { type: "array", items: { type: "object" } },
            endpoints: { type: "object" },
          },
        },
        ManifestResponse: {
          type: "object",
          required: [
            "service",
            "dataset",
            "datasetVersion",
            "snapshotId",
            "generatedAt",
            "algorithm",
            "files",
          ],
          properties: {
            service: { type: "string" },
            dataset: { type: "string" },
            url: { type: "string", format: "uri" },
            datasetVersion: { type: "string" },
            snapshotId: { type: "string" },
            generatedAt: { type: "string", format: "date-time" },
            algorithm: { type: "string", enum: ["sha256"] },
            files: { type: "object" },
          },
        },
        MedicationsDataset: {
          type: "object",
          required: [
            "service",
            "dataset",
            "datasetVersion",
            "snapshotId",
            "generatedAt",
            "totalMedications",
            "medications",
          ],
          properties: {
            service: { type: "string" },
            dataset: { type: "string" },
            url: { type: "string", format: "uri" },
            datasetVersion: { type: "string" },
            snapshotId: { type: "string" },
            generatedAt: { type: "string", format: "date-time" },
            license: { type: "string" },
            totalMedications: { type: "integer" },
            totalInteractionPairs: { type: "integer" },
            medications: { type: "array", items: { type: "object" } },
          },
        },
        InteractionsDataset: {
          type: "object",
          required: [
            "service",
            "dataset",
            "datasetVersion",
            "snapshotId",
            "generatedAt",
            "totalPairs",
            "clinicianSignedPairs",
            "interactions",
          ],
          properties: {
            service: { type: "string" },
            dataset: { type: "string" },
            url: { type: "string", format: "uri" },
            datasetVersion: { type: "string" },
            snapshotId: { type: "string" },
            generatedAt: { type: "string", format: "date-time" },
            license: { type: "string" },
            totalPairs: { type: "integer" },
            clinicianSignedPairs: { type: "integer" },
            legacyUnreviewedPairs: { type: "integer" },
            interactions: { type: "array", items: { type: "object" } },
          },
        },
        QuarantineDataset: {
          type: "object",
          required: [
            "service",
            "dataset",
            "datasetVersion",
            "snapshotId",
            "generatedAt",
            "emergencyContacts",
            "totalQuarantinedBotanicals",
            "botanicals",
          ],
          properties: {
            service: { type: "string" },
            dataset: { type: "string" },
            url: { type: "string", format: "uri" },
            datasetVersion: { type: "string" },
            snapshotId: { type: "string" },
            generatedAt: { type: "string", format: "date-time" },
            policy: { type: "string" },
            emergencyContacts: {
              type: "object",
              properties: {
                usPoisonControl: { type: "string" },
                canadaPoisonControl: { type: "string" },
                emergency: { type: "string" },
              },
            },
            totalQuarantinedBotanicals: { type: "integer" },
            botanicals: { type: "array", items: { type: "object" } },
          },
        },
        InteractionCheckResponse: {
          type: "object",
          required: ["found"],
          properties: {
            found: { type: "boolean" },
            withheld: { type: "boolean" },
            ambiguous: { type: "boolean" },
            unavailable: { type: "boolean" },
            rateLimited: { type: "boolean" },
            herb: { type: ["object", "null"] },
            pair: { type: ["object", "null"] },
          },
        },
        StackCheckRequest: {
          type: "object",
          required: ["herbs", "drugs"],
          properties: {
            herbs: {
              type: "array",
              minItems: 1,
              maxItems: 10,
              items: { type: "string", minLength: 2, maxLength: 120 },
            },
            drugs: {
              type: "array",
              minItems: 1,
              maxItems: 10,
              items: { type: "string", minLength: 2, maxLength: 120 },
            },
            locale: { type: "string", enum: ["en", "fr"], default: "en" },
          },
        },
        StackCheckResponse: {
          type: "object",
          required: ["checkedAt", "locale", "herbs", "drugs", "summary"],
          properties: {
            checkedAt: { type: "string", format: "date-time" },
            locale: { type: "string", enum: ["en", "fr"] },
            herbs: { type: "array", items: { type: "object" } },
            drugs: { type: "array", items: { type: "string" } },
            summary: { type: "object" },
            matches: { type: "array", items: { type: "object" } },
            conflicts: { type: "array", items: { type: "object" } },
            withheld: { type: "array", items: { type: "object" } },
            unrecorded: { type: "array", items: { type: "object" } },
            stackAlerts: { type: "array", items: { type: "object" } },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            found: { type: "boolean" },
            unavailable: { type: "boolean" },
            rateLimited: { type: "boolean" },
            error: { type: "string" },
            message: { type: "string" },
          },
        },
        PrivacyManifestResponse: {
          type: "object",
          required: [
            "service",
            "dataset",
            "datasetVersion",
            "snapshotId",
            "generatedAt",
            "privacyOfficer",
            "guarantees",
            "subprocessors",
          ],
          properties: {
            service: { type: "string" },
            dataset: { type: "string" },
            url: { type: "string", format: "uri" },
            datasetVersion: { type: "string" },
            snapshotId: { type: "string" },
            generatedAt: { type: "string", format: "date-time" },
            jurisdictions: { type: "array", items: { type: "string" } },
            privacyOfficer: { type: "object" },
            guarantees: { type: "object" },
            cookies: { type: "array", items: { type: "object" } },
            subprocessors: { type: "array", items: { type: "object" } },
          },
        },
        ReviewQueueResponse: {
          type: "object",
          required: [
            "service",
            "dataset",
            "datasetVersion",
            "snapshotId",
            "generatedAt",
            "advisoryBoard",
            "summary",
            "priorityQueue",
          ],
          properties: {
            service: { type: "string" },
            dataset: { type: "string" },
            url: { type: "string", format: "uri" },
            datasetVersion: { type: "string" },
            snapshotId: { type: "string" },
            generatedAt: { type: "string", format: "date-time" },
            onboardingPortalUrl: { type: "string", format: "uri" },
            onboardingPortalUrlFr: { type: "string", format: "uri" },
            governanceProtocolUrl: { type: "string", format: "uri" },
            advisoryBoard: { type: "object" },
            summary: { type: "object" },
            priorityQueue: { type: "array", items: { type: "object" } },
          },
        },
      },
    },
  };
}

export function buildPrivacyManifestPayload(
  snapshot: OpenDataAtomicSnapshot,
  baseUrl: string
) {
  return {
    service: "HerbAlly",
    dataset: "privacy_and_subprocessor_manifest",
    url: `${baseUrl}/open-data/privacy-manifest.json`,
    datasetVersion: OPEN_DATA_DATASET_VERSION,
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    jurisdictions: [
      "Quebec Law 25 (Act respecting the protection of personal information in the private sector)",
      "Canada PIPEDA",
    ],
    privacyOfficer: {
      name: "Yasser Bheekun",
      email: "privacy@herbally.app",
      editorialEmail: "info@herbally.app",
      responseSlaDays: 30,
      breachNotificationAuthority:
        "Commission d'accès à l'information du Québec (CAI)",
    },
    guarantees: {
      zeroThirdPartyAdTrackers: true,
      adsLaunchGateEnabled: false,
      zeroMarketingCookiesOnClinicalRoutes: true,
      clientSideOnlyConsultationExport: true,
      guestChatRetentionDays: 30,
      aiResponseCacheDays: 7,
      phiPermitted: false,
    },
    cookies: [
      {
        name: "herbally-locale",
        purpose: "Stores explicit EN/FR UI language selection.",
        essential: true,
        httpOnly: false,
        maxAge: "1 year",
      },
      {
        name: "herbally-guest-id",
        purpose:
          "Pseudonymous UUID anchoring optional guest saved herbs and 30-day chat history.",
        essential: true,
        httpOnly: true,
        maxAge: "30 days",
      },
      {
        name: "sb-*-auth-token",
        purpose:
          "Supabase Auth session tokens for optional signed-in accounts.",
        essential: true,
        httpOnly: true,
        maxAge: "Session / refresh lifecycle",
      },
      {
        name: "herbally-linkedin-session",
        purpose:
          "AES-GCM encrypted short-lived cookie scoped strictly to /clinical-review LinkedIn OIDC SSO.",
        essential: true,
        httpOnly: true,
        maxAge: "8 hours",
      },
    ],
    subprocessors: [
      {
        name: "Supabase (PostgreSQL)",
        region: "Montreal, Quebec, Canada",
        crossBorder: false,
        status: "active",
        purpose:
          "Reference catalog, optional user accounts, 30-day guest chat sessions, and LinkedIn SSO edit queue (no PHI permitted).",
        retention:
          "30 days (guest chat_sessions.retention_expires_at); 7 days (public ai_response_cache); account deletion via privacy@herbally.app.",
      },
      {
        name: "Cloudflare",
        region: "Global Edge CDN / WAF",
        crossBorder: true,
        status: "active",
        purpose: "DNS, WAF, DDoS mitigation, and public asset caching.",
        retention:
          "Transient edge security metadata; zero herbal/chat body storage.",
      },
      {
        name: "Application Runtime Server (KVM)",
        region: "Self-managed production host",
        crossBorder: false,
        status: "active",
        purpose:
          "Executes Next.js SSR and API handlers with scrubbed error logs.",
        retention: "Rotating operational logs without personal query strings.",
      },
      {
        name: "Ollama Cloud",
        region: "External AI Inference Endpoint",
        crossBorder: true,
        status: "active",
        purpose:
          "Stateless LLM inference for Virtual Herbalist educational responses without user name, email, or account ID.",
        retention:
          "No HerbAlly-retained user identity; session storage stays in Montreal PostgreSQL.",
      },
      {
        name: "Upstash Redis",
        region: "Cloud Redis",
        crossBorder: true,
        status: "active",
        purpose: "Hashed sliding-window rate-limit counters on API routes.",
        retention: "Ephemeral TTL windows (60 seconds to 24 hours).",
      },
      {
        name: "Health Canada LNHPD API",
        region: "Canada",
        crossBorder: false,
        status: "active_public_registry",
        purpose:
          "Queries public 8-digit NPN/DIN-HM licences via /api/npn/lookup.",
        retention: "1-hour public licence cache; zero user identifiers sent.",
      },
      {
        name: "Sentry",
        region: "Cloud Error Telemetry",
        crossBorder: true,
        status: "active",
        purpose:
          "Runtime error diagnostics pre-scrubbed to strip cookies, query parameters, and health terms.",
        retention: "Standard scrubbed technical error retention window.",
      },
      {
        name: "Stripe",
        region: "United States / Global",
        crossBorder: true,
        status: "active_on_donate_only",
        purpose: "Voluntary donation processing on /donate only.",
        retention:
          "Tax/accounting ledger records; zero card storage by HerbAlly.",
      },
      {
        name: "Zoho Mail",
        region: "Mail Hosting",
        crossBorder: true,
        status: "active",
        purpose:
          "Handles inbound support and privacy correspondence to info@herbally.app and privacy@herbally.app.",
        retention: "Deleted upon verified privacy request.",
      },
      {
        name: "LinkedIn OpenID Connect",
        region: "United States / Global",
        crossBorder: true,
        status: "active_opt_in_only",
        purpose:
          "Optional reviewer sign-in (name, OpenID sub, verified email) strictly on /clinical-review.",
        retention:
          "Edit attribution retained in audit log; deletable on request.",
      },
      {
        name: "Google AdSense",
        region: "Global",
        crossBorder: true,
        status: "disabled_launch_gate_false",
        purpose:
          "Currently inactive (ADS_LAUNCH_GATE=false). Permanently forbidden on /embed/*, quarantined toxic plants, and all clinical tools.",
        retention:
          "Zero ad requests or cookies emitted while launch gate is false.",
      },
    ],
  };
}

export function buildReviewQueuePayload(
  snapshot: OpenDataAtomicSnapshot,
  baseUrl: string
) {
  const { activePairs } = snapshot;

  const bySeverity = {
    contraindicated: 0,
    severe: 0,
    moderate: 0,
    mild: 0,
  };
  let clinicianSignedPairs = 0;

  for (const p of activePairs) {
    bySeverity[p.severity] = (bySeverity[p.severity] ?? 0) + 1;
    if (p.clinicalActionStatus === "clinician_approved") {
      clinicianSignedPairs += 1;
    }
  }

  const priorityPairs = activePairs
    .filter(
      (p) =>
        p.clinicalActionStatus !== "clinician_approved" &&
        (p.severity === "contraindicated" || p.severity === "severe")
    )
    .sort((a, b) => {
      const sevDiff =
        (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0);
      if (sevDiff !== 0) return sevDiff;
      const herbDiff = a.herbSlug.localeCompare(b.herbSlug);
      if (herbDiff !== 0) return herbDiff;
      return a.drugSlug.localeCompare(b.drugSlug);
    });

  return {
    service: "HerbAlly",
    dataset: "clinical_review_priority_queue",
    url: `${baseUrl}/open-data/review-queue.json`,
    datasetVersion: OPEN_DATA_DATASET_VERSION,
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    onboardingPortalUrl: `${baseUrl}/clinical-review`,
    onboardingPortalUrlFr: `${baseUrl}/fr/clinical-review`,
    governanceProtocolUrl: `${baseUrl}/editorial-policy#clinical-governance-protocol`,
    advisoryBoard: {
      seatsFilled: 0,
      seatsTotal: 3,
      targetRoles: [
        "PharmD / RPh (Clinical Pharmacist)",
        "MD / DO (Physician)",
        "Clinical Toxicologist / Pharmacognosy Researcher",
      ],
    },
    summary: {
      totalActivePairs: activePairs.length,
      clinicianSignedPairs,
      awaitingReviewPairs: Math.max(
        0,
        activePairs.length - clinicianSignedPairs
      ),
      bySeverity,
      priorityQueueCount: priorityPairs.length,
    },
    priorityQueue: priorityPairs.map((p) => ({
      id: p.id,
      herbSlug: p.herbSlug,
      herbName: p.herbName,
      drugSlug: p.drugSlug,
      drugName: p.drugName,
      severity: p.severity,
      evidenceLevel: p.evidenceLevel,
      source: p.source,
      sourceUrl: p.sourceUrl,
      publicationStatus: p.publicationStatus ?? "legacy_unreviewed",
      pairUrl: `${baseUrl}${pairPath(p.herbSlug, p.drugName)}`,
      reviewSubmitUrl: `${baseUrl}/clinical-review?targetType=interaction&slug=${encodeURIComponent(p.herbSlug)}&drug=${encodeURIComponent(p.drugName)}`,
    })),
  };
}

export const OPEN_DATA_RESPONSE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": OPEN_DATA_HTTP_CACHE_POLICY.cacheControl,
  "Access-Control-Allow-Origin": OPEN_DATA_HTTP_CACHE_POLICY.corsAllowOrigin,
} as const;
