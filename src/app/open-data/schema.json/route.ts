import { siteUrl } from "@/lib/seo/site-url";

export const revalidate = 3600;

export async function GET() {
  const baseUrl = siteUrl();

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "HerbAlly Open Botanical Safety Data & Interaction API",
      version: "3.12.0",
      summary:
        "Machine-readable bilingual botanical reference, herb–drug interaction lookup, toxic quarantine registry, and Health Canada NPN lookup endpoints.",
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
          summary: "Live governance counts, source licences, and endpoints",
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
          summary: "All documented medications and drug classes (142 entries)",
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
            "All active curated herb–drug interaction pairs with citations and review flags (509 entries)",
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
                "Matrix evaluation of matches, conflicts, withheld citations, and unrecorded combinations",
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
          required: ["service", "url", "counts", "sources", "endpoints"],
          properties: {
            service: { type: "string" },
            url: { type: "string", format: "uri" },
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
            sources: { type: "array", items: { type: "object" } },
            endpoints: { type: "object" },
          },
        },
        MedicationsDataset: {
          type: "object",
          required: ["service", "dataset", "totalMedications", "medications"],
          properties: {
            service: { type: "string" },
            dataset: { type: "string" },
            url: { type: "string", format: "uri" },
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
            "totalPairs",
            "clinicianSignedPairs",
            "interactions",
          ],
          properties: {
            service: { type: "string" },
            dataset: { type: "string" },
            url: { type: "string", format: "uri" },
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
            "emergencyContacts",
            "totalQuarantinedBotanicals",
            "botanicals",
          ],
          properties: {
            service: { type: "string" },
            dataset: { type: "string" },
            url: { type: "string", format: "uri" },
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
      },
    },
  };

  return new Response(JSON.stringify(spec, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
