# Quebec Law 25 & PIPEDA Technical Readiness Checklist

> **STATUS: DRAFT TECHNICAL READINESS CHECKLIST — NOT A COMPLETED EFVP OR LEGAL DETERMINATION**
>
> Qualified legal and privacy counsel must complete formal Privacy Impact Assessments (EFVP), confirm cross-border transfer notices, and verify vendor DPAs before claiming Law 25 or PIPEDA compliance.

| Control Area                                                                         | Software Status                                                                | Owner / Legal Counsel Action Required                                        |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Default-private minimization (chat cache bypass for personalized/multi-turn queries) | Implemented in code (`route.ts`)                                               | Verify deployed telemetry does not log full request bodies                   |
| Explicit opt-in consent ledger (`user_privacy_consents`)                             | Migration `00103` authored; server action rejects `health_data_consent: false` | Review and apply `00103` in production Supabase; finalize legal consent text |
| Client-side storage wipe (`clearAllLocalHerbAllyData`)                               | Implemented (`storage-inventory.ts`)                                           | Confirm UX discoverability and browser-deletion guidance                     |
| Service worker exclusion of private routes                                           | Implemented (`public/sw.js` `v8`)                                              | Keep private paths synchronized when adding new authenticated routes         |
| Third-party AI & Supabase DPAs / zero-retention terms                                | Blocked externally (not provable in repo)                                      | Execute DPAs and privacy impact assessment (EFVP) with vendor counsel        |
