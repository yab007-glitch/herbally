# Safety Incident & Public Corrections SOP

> **STATUS: DRAFT — REQUIRES OWNER AND QUALIFIED CLINICAL/LEGAL APPROVAL**
>
> This SOP governs software incident intake (`POST /api/safety-incidents`), triage, SLA tracking, and public corrections (`public_corrections_log`). It does **not** constitute regulatory medical-device or pharmacovigilance reporting compliance.

## 1. Intake & Triage Windows

| Severity   | Target Triage SLA (`sla_due_at`) | Initial Engineering Containment                                               |
| ---------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `critical` | 24 hours                         | Quarantine affected surface/row immediately; disable automated numeric output |
| `high`     | 72 hours                         | Add block/warning banner; suppress search index (`noindex`) if needed         |
| `medium`   | 7 days                           | Log issue, schedule editorial/clinical review                                 |
| `low`      | 30 days                          | Batch with scheduled content audit                                            |

## 2. Immutable Audit Trail & Corrections Log

- Every intake writes a primary `safety_incidents` record and an audit entry in `safety_incident_audit_log`.
- Verified fixes affecting public safety information must record a non-PHI summary in `public_corrections_log` (`GET /api/safety-incidents`).
- Incident submitters must be instructed not to include personal health information (PHI) or identifying medical records.
