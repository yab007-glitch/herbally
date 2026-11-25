/**
 * Truthful technical data classification and data-flow register helper.
 * Documents what HerbAlly stores client-side and server-side without claiming
 * legal/regulatory certifications (no HIPAA, EFVP-complete, or signed-DPA claims).
 */

export type DataClassification =
  | "public_catalog"
  | "pseudonymous_session_or_browser"
  | "user_submitted_health_optional";

export interface DataFlowRecord {
  id: string;
  surface: string;
  classification: DataClassification;
  storageLocation: string;
  retention: string;
  thirdPartyRecipients: string[];
  notes: string;
}

export function getDataFlowInventory(): readonly DataFlowRecord[] {
  return [
    {
      id: "df-profile-health",
      surface: "/profile (health_profiles, patient_profiles, user_medications)",
      classification: "user_submitted_health_optional",
      storageLocation: "Supabase Postgres (authenticated RLS per user_id)",
      retention:
        "User-deletable in /profile; retention column added in migration 00103",
      thirdPartyRecipients: ["Supabase hosting"],
      notes:
        "Opt-in only for signed-in users; anonymous browsing requires no profile.",
    },
    {
      id: "df-dosage-calc",
      surface: "/calculator & /profile dosage history (dosage_calculations)",
      classification: "user_submitted_health_optional",
      storageLocation:
        "Supabase Postgres (adults 18+ only after 00100; anon insert revoked)",
      retention:
        "Last 20 entries queried per user; legacy <18 rows quarantined",
      thirdPartyRecipients: ["Supabase hosting"],
      notes:
        "New pediatric calculations are blocked; legacy <18 and scaling-formula rows remain quarantined and redacted without deletion.",
    },
    {
      id: "df-ai-chat",
      surface: "/herbalist & POST /api/chat",
      classification: "user_submitted_health_optional",
      storageLocation:
        "Ephemeral stream + optional chat_sessions for signed-in users; personalized/multi-turn queries bypass ai_response_cache",
      retention: "stateless public cache expires in 7 days",
      thirdPartyRecipients: [
        "Ollama Cloud AI inference provider",
        "Supabase hosting",
      ],
      notes:
        "Users are instructed not to paste identifying information (name, RAMQ, SSN, MRN). Zero-retention vendor DPAs remain pending owner action.",
    },
    {
      id: "df-browser-storage",
      surface:
        "Stack checker, garden notes, recent searches, theme/consent prefs",
      classification: "pseudonymous_session_or_browser",
      storageLocation:
        "Browser localStorage / sessionStorage (no server transmission unless signed-in sync)",
      retention:
        "Cleared via clearAllLocalHerbAllyData() in storage-inventory.ts",
      thirdPartyRecipients: [],
      notes:
        "Service worker public caches explicitly exclude /api/, /auth/, /profile, and /herbalist.",
    },
  ];
}
