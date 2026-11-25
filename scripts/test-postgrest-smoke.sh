#!/usr/bin/env bash
# Real PostgREST HTTP smoke suite against a migrated PG16 database (post-00104).
# Verifies:
#   - herbs_public + herb_categories(*) embed
#   - herbs_public + drug_interactions(*) embed
#   - drug_interactions + herbs!inner(...) embed
#   - /rpc/herb_page_bundle (chamomile, fennel, senna-leaf)
#   - /rpc/search_herbs_by_symptom
#   - herb_monograph_sources_public (claims, safety, doses sanitized on fennel/senna-leaf)
#   - raw column denials (401/403) across base tables + dosage_calculations locks
#   - /rpc/create_safety_incident_with_audit (8-parameter atomic RPC)
#   - post-contract admin CRUD via service_role (POST/PATCH/GET/DELETE)

set -euo pipefail

POSTGREST_URL="${POSTGREST_URL:-http://127.0.0.1:3001}"
JWT_SIGNING_MATERIAL="${PGRST_JWT_SECRET:?PGRST_JWT_SECRET is required}"

mint_jwt() {
  local role="$1"
  local sub="${2:-}"
  node -e '
    const crypto = require("node:crypto");
    const secret = process.argv[1];
    const role = process.argv[2];
    const sub = process.argv[3];
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const header = b64({ alg: "HS256", typ: "JWT" });
    const now = Math.floor(Date.now() / 1000);
    const payloadObj = { role, iss: "herbally-ci", iat: now, exp: now + 3600 };
    if (sub) payloadObj.sub = sub;
    const payload = b64(payloadObj);
    const sig = crypto.createHmac("sha256", secret).update(header + "." + payload).digest("base64url");
    process.stdout.write(header + "." + payload + "." + sig);
  ' "$JWT_SIGNING_MATERIAL" "$role" "$sub"
}

ANON_JWT="$(mint_jwt anon)"
AUTH_JWT="$(mint_jwt authenticated 11111111-1111-1111-1111-111111111111)"
SERVICE_JWT="$(mint_jwt service_role)"

expect_status() {
  local label="$1"
  local expected_re="$2"
  local actual="$3"
  if [[ ! "$actual" =~ ^($expected_re)$ ]]; then
    echo "FAIL [$label]: expected HTTP ($expected_re), got $actual" >&2
    exit 1
  fi
  echo "OK [$label] -> HTTP $actual"
}

echo "==> 1) herbs_public + herb_categories(*) embed"
CAT_BODY="$(curl -fsS -H "Authorization: Bearer ${ANON_JWT}" \
  "${POSTGREST_URL}/herbs_public?select=id,slug,name,herb_categories(id,name,name_fr,slug)&slug=eq.chamomile")"
node -e '
  const rows = JSON.parse(process.argv[1]);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Expected 1 chamomile row");
  if (!rows[0].herb_categories || rows[0].herb_categories.slug !== "calming-sleep") {
    throw new Error("Missing or unexpected herb_categories embed: " + JSON.stringify(rows[0]));
  }
' "$CAT_BODY"
echo "OK [herbs_public + herb_categories(*) embed]"

echo "==> 2) herbs_public + drug_interactions(*) embed"
IX_EMBED_BODY="$(curl -fsS -H "Authorization: Bearer ${ANON_JWT}" \
  "${POSTGREST_URL}/herbs_public?select=id,slug,name,drug_interactions(id,drug_name,severity,publication_status)&slug=eq.chamomile")"
node -e '
  const rows = JSON.parse(process.argv[1]);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Expected 1 chamomile row");
  if (!Array.isArray(rows[0].drug_interactions) || rows[0].drug_interactions.length < 1) {
    throw new Error("Missing drug_interactions embed on herbs_public: " + JSON.stringify(rows[0]));
  }
' "$IX_EMBED_BODY"
echo "OK [herbs_public + drug_interactions(*) embed]"

echo "==> 3) drug_interactions + herbs!inner(...) embed"
REV_EMBED_BODY="$(curl -fsS -H "Authorization: Bearer ${ANON_JWT}" \
  "${POSTGREST_URL}/drug_interactions?select=id,drug_name,severity,publication_status,herbs!inner(slug,name,name_fr,is_published)&herbs.slug=eq.chamomile")"
node -e '
  const rows = JSON.parse(process.argv[1]);
  if (!Array.isArray(rows) || rows.length < 1 || rows[0].herbs?.slug !== "chamomile") {
    throw new Error("Missing herbs!inner embed on drug_interactions: " + process.argv[1]);
  }
' "$REV_EMBED_BODY"
echo "OK [drug_interactions + herbs!inner(...) embed]"

echo "==> 4) /rpc/herb_page_bundle (chamomile + fennel)"
BUNDLE_BODY="$(curl -fsS -X POST \
  -H "Authorization: Bearer ${ANON_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"p_slug":"chamomile"}' \
  "${POSTGREST_URL}/rpc/herb_page_bundle")"
node -e '
  const b = JSON.parse(process.argv[1]);
  if (!b || !b.herb || b.herb.slug !== "chamomile") throw new Error("Missing chamomile bundle");
  if (b.herb.dosage_child !== null && b.herb.dosage_child !== undefined) {
    throw new Error("Bundle leaked dosage_child");
  }
  if (/Children 6-12 years/i.test(b.herb.dosage_adult || "")) {
    throw new Error("Bundle leaked pediatric dosage_adult");
  }
  if (!/Children who ingest 5 g/i.test(b.herb.dosage_adult || "")) {
    throw new Error("Bundle dropped genuine poisoning warning");
  }
' "$BUNDLE_BODY"
echo "OK [/rpc/herb_page_bundle]"

echo "==> 5) /rpc/search_herbs_by_symptom"
SEARCH_BODY="$(curl -fsS -X POST \
  -H "Authorization: Bearer ${ANON_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"search_term":"chamomile"}' \
  "${POSTGREST_URL}/rpc/search_herbs_by_symptom")"
node -e '
  const rows = JSON.parse(process.argv[1]);
  if (!Array.isArray(rows) || rows.length < 1) throw new Error("Empty search_herbs_by_symptom result");
  for (const r of rows) {
    if (r.dosage_child !== null) throw new Error("search_herbs_by_symptom leaked dosage_child");
    if (/Children 6-12 years/i.test(r.dosage_adult || "")) {
      throw new Error("search_herbs_by_symptom leaked pediatric sentence");
    }
  }
' "$SEARCH_BODY"
echo "OK [/rpc/search_herbs_by_symptom]"

echo "==> 6) herb_monograph_sources_public sanitization (fennel & senna-leaf)"
SRC_BODY="$(curl -fsS -H "Authorization: Bearer ${ANON_JWT}" \
  "${POSTGREST_URL}/herb_monograph_sources_public?select=herb_slug,claims,safety,doses&herb_slug=in.(fennel,senna-leaf)")"
node -e '
  const rows = JSON.parse(process.argv[1]);
  if (!Array.isArray(rows) || rows.length < 2) throw new Error("Missing fennel/senna-leaf source rows");
  const serialized = JSON.stringify(rows);
  if (/give 10 ml|7\.5 mg daily|7\.5 mg at bedtime/i.test(serialized)) {
    throw new Error("herb_monograph_sources_public leaked pediatric dosing in claims/safety/doses: " + serialized);
  }
  if (!/Contraindicated in children under 12/i.test(serialized) || !/Fennel oil not for infants/i.test(serialized)) {
    throw new Error("herb_monograph_sources_public stripped genuine warnings: " + serialized);
  }
' "$SRC_BODY"
echo "OK [herb_monograph_sources_public sanitized]"

echo "==> 6b) herb_monographs_public, herb_faqs_public, herb_pubmed_monographs_public sanitization"
MONO_BODY="$(curl -fsS -H "Authorization: Bearer ${ANON_JWT}" \
  "${POSTGREST_URL}/herb_monographs_public?select=herb_slug,drug_interactions&herb_slug=eq.chamomile")"
FAQ_BODY="$(curl -fsS -H "Authorization: Bearer ${ANON_JWT}" \
  "${POSTGREST_URL}/herb_faqs_public?select=question,answer,translations&herb_id=eq.33333333-3333-3333-3333-333333333333")"
PM_BODY="$(curl -fsS -H "Authorization: Bearer ${ANON_JWT}" \
  "${POSTGREST_URL}/herb_pubmed_monographs_public?select=slug,content&slug=eq.chamomile")"
node -e '
  const mono = JSON.parse(process.argv[1]);
  const faq = JSON.parse(process.argv[2]);
  const pm = JSON.parse(process.argv[3]);
  if (!Array.isArray(mono) || mono.length !== 1 || /100 mg/i.test(JSON.stringify(mono[0].drug_interactions))) {
    throw new Error("herb_monographs_public drug_interactions leak: " + process.argv[1]);
  }
  if (!Array.isArray(faq) || faq.length !== 4 || /100 mg/i.test(JSON.stringify(faq))) {
    throw new Error("herb_faqs_public parity/length or leak check failed: " + process.argv[2]);
  }
  if (!faq.some((f) => f.question === "Can children take chamomile?")) {
    throw new Error("herb_faqs_public dropped safe child question with warning answer: " + process.argv[2]);
  }
  const enFrFallbackFaq = faq.find(
    (f) => f.question === "Safety information" && /Stop use and consult a healthcare professional/i.test(f.answer || "")
  );
  if (
    !enFrFallbackFaq ||
    enFrFallbackFaq.translations?.fr?.question !== "Information de sécurité"
  ) {
    throw new Error("herb_faqs_public missing EN+FR fallback-question warning FAQ: " + process.argv[2]);
  }
  const enEmptyFrWarningFaq = faq.find(
    (f) => f.question === "Safety information" && f.answer === ""
  );
  if (
    !enEmptyFrWarningFaq ||
    enEmptyFrWarningFaq.translations?.fr?.question !== "Information de sécurité" ||
    !/Cesser l.utilisation/i.test(enEmptyFrWarningFaq.translations?.fr?.answer || "") ||
    /child|children|enfant|6[-–]12|6 à 12|100 mg|pediatric/i.test(JSON.stringify(enEmptyFrWarningFaq))
  ) {
    throw new Error("herb_faqs_public missing or leaked EN-empty/FR-warning FAQ: " + process.argv[2]);
  }
  if (!Array.isArray(pm) || pm.length !== 1 || /100 mg|150 mg|200 mg|50 mg|75 mg|80 mg|40 mg|25 mg|10 mg|pediatricDosage|pediatricDose|pediatricUse|childDose|paediatricDosage|useInChildren|use_in_children|doseInChildren|dose_in_children|administrationInChildren|use_in_infants|minor_dosage/i.test(JSON.stringify(pm[0].content))) {
    throw new Error("herb_pubmed_monographs_public content leak: " + process.argv[3]);
  }
  if (!/500 mg/.test(pm[0].content?.adultDosage || "")) {
    throw new Error("herb_pubmed_monographs_public stripped adultDosage: " + process.argv[3]);
  }
  if (!/Children should not take this product\./.test(pm[0].content?.childSafety || "")) {
    throw new Error("herb_pubmed_monographs_public stripped childSafety warning: " + process.argv[3]);
  }
  if (
    !/Minor side effects: mild nausea/.test(pm[0].content?.minorSideEffects || "") ||
    !/children should not take this product\./.test(pm[0].content?.minorSideEffects || "")
  ) {
    throw new Error("herb_pubmed_monographs_public stripped minorSideEffects warning: " + process.argv[3]);
  }
' "$MONO_BODY" "$FAQ_BODY" "$PM_BODY"
echo "OK [monographs/faqs/pubmed public views sanitized]"

echo "==> 7) Raw column denials (401/403) and dosage_calculations locks"
for endpoint in \
  "/herbs?select=dosage_child" \
  "/herbs?select=dosage_adult" \
  "/herbs?select=description" \
  "/herb_faqs?select=question" \
  "/herb_faqs?select=answer" \
  "/herb_monographs?select=summary" \
  "/herb_monographs?select=drug_interactions" \
  "/herb_regulatory_evidence?select=doses,purposes,risks" \
  "/herb_monograph_sources?select=claims,safety,doses" \
  "/herb_pubmed_monographs?select=content"; do
  status=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${ANON_JWT}" "${POSTGREST_URL}${endpoint}")
  expect_status "anon deny ${endpoint}" "401|403" "$status"
done

echo "==> 7b) Public evidence views filter out unpublished herbs & draft PubMed sheets"
for pub_check in \
  "/herbs_public?slug=eq.draft-unpublished-herb" \
  "/herb_faqs_public?herb_id=eq.33333333-3333-3333-3333-333333333339" \
  "/herb_monographs_public?herb_slug=eq.draft-unpublished-herb" \
  "/herb_regulatory_evidence_public?herb_slug=eq.draft-unpublished-herb" \
  "/herb_monograph_sources_public?herb_slug=eq.draft-unpublished-herb" \
  "/herb_pubmed_monographs_public?slug=in.(draft-unpublished-herb,fennel)"; do
  UNPUB_BODY="$(curl -fsS -H "Authorization: Bearer ${ANON_JWT}" "${POSTGREST_URL}${pub_check}")"
  node -e '
    const rows = JSON.parse(process.argv[1]);
    if (!Array.isArray(rows) || rows.length !== 0) {
      throw new Error("Unpublished/draft evidence leaked via " + process.argv[2] + ": " + process.argv[1]);
    }
  ' "$UNPUB_BODY" "$pub_check"
done
echo "OK [public evidence views filter unpublished herbs and draft PubMed sheets]"

calc_anon=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H "Authorization: Bearer ${ANON_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"patient_age":30,"adult_dose":"500 mg","calculated_dose":"500 mg","formula_used":"adult_reference"}' \
  "${POSTGREST_URL}/dosage_calculations")
expect_status "anon deny dosage_calculations INSERT" "401|403" "$calc_anon"

calc_minor=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H "Authorization: Bearer ${AUTH_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"11111111-1111-1111-1111-111111111111","patient_age":12,"adult_dose":"500 mg","calculated_dose":"500 mg","formula_used":"adult_reference"}' \
  "${POSTGREST_URL}/dosage_calculations")
expect_status "auth deny minor dosage_calculations INSERT" "400|401|403" "$calc_minor"

echo "==> 8) /rpc/create_safety_incident_with_audit (8 exact args via service_role + anon deny + audit & cleanup)"
inc_anon=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H "Authorization: Bearer ${ANON_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"p_category":"pediatric_safety","p_severity":"high","p_surface_url":"https://herbally.app/en/calculator","p_summary":"Unauthorized smoke report","p_details":"No PHI","p_triage_status":"open_triage","p_sla_due_at":"2026-11-30T00:00:00Z","p_actor":"public_intake"}' \
  "${POSTGREST_URL}/rpc/create_safety_incident_with_audit")
expect_status "anon deny /rpc/create_safety_incident_with_audit" "401|403" "$inc_anon"

INC_BODY="$(curl -fsS -X POST \
  -H "Authorization: Bearer ${SERVICE_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"p_category":"pediatric_safety","p_severity":"high","p_surface_url":"https://herbally.app/en/calculator","p_summary":"PostgREST smoke report","p_details":"No PHI","p_triage_status":"open_triage","p_sla_due_at":"2026-11-30T00:00:00Z","p_actor":"public_intake"}' \
  "${POSTGREST_URL}/rpc/create_safety_incident_with_audit")"
INC_ID="$(node -e '
  const id = JSON.parse(process.argv[1]);
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Unexpected incident RPC response: " + process.argv[1]);
  }
  process.stdout.write(id);
' "$INC_BODY")"

AUDIT_BODY="$(curl -fsS -H "Authorization: Bearer ${SERVICE_JWT}" \
  "${POSTGREST_URL}/safety_incident_audit_log?incident_id=eq.${INC_ID}&select=audit_id,actor,action")"
node -e '
  const rows = JSON.parse(process.argv[1]);
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].actor !== "public_intake" || rows[0].action !== "created") {
    throw new Error("Missing atomic audit log row for incident: " + process.argv[1]);
  }
' "$AUDIT_BODY"

inc_del_status=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE \
  -H "Authorization: Bearer ${SERVICE_JWT}" \
  "${POSTGREST_URL}/safety_incidents?id=eq.${INC_ID}")
expect_status "service_role DELETE safety_incident cleanup" "200|204" "$inc_del_status"
echo "OK [/rpc/create_safety_incident_with_audit]"

echo "==> 9) Post-contract admin herb CRUD via service_role (create -> update -> verify herbs_public -> delete)"
CREATED_BODY="$(curl -fsS -X POST \
  -H "Authorization: Bearer ${SERVICE_JWT}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"name":"PostgREST Smoke Herb","slug":"postgrest-smoke-herb","scientific_name":"Ocimum smoke","description":"Smoke description.","dosage_adult":"300 mg daily","is_published":true}' \
  "${POSTGREST_URL}/herbs?select=id,slug,name,description,dosage_adult")"
CREATED_ID="$(node -e '
  const rows = JSON.parse(process.argv[1]);
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].slug !== "postgrest-smoke-herb") {
    throw new Error("Admin create failed: " + process.argv[1]);
  }
  process.stdout.write(rows[0].id);
' "$CREATED_BODY")"

UPDATED_BODY="$(curl -fsS -X PATCH \
  -H "Authorization: Bearer ${SERVICE_JWT}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"description":"Updated PostgREST smoke description."}' \
  "${POSTGREST_URL}/herbs?id=eq.${CREATED_ID}&select=id,slug,description")"
node -e '
  const rows = JSON.parse(process.argv[1]);
  if (!Array.isArray(rows) || rows[0]?.description !== "Updated PostgREST smoke description.") {
    throw new Error("Admin update failed: " + process.argv[1]);
  }
' "$UPDATED_BODY"

PUB_CHECK="$(curl -fsS -H "Authorization: Bearer ${ANON_JWT}" \
  "${POSTGREST_URL}/herbs_public?slug=eq.postgrest-smoke-herb&select=id,slug,description")"
node -e '
  const rows = JSON.parse(process.argv[1]);
  if (!Array.isArray(rows) || rows[0]?.description !== "Updated PostgREST smoke description.") {
    throw new Error("herbs_public did not reflect admin CRUD: " + process.argv[1]);
  }
' "$PUB_CHECK"

del_status=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE \
  -H "Authorization: Bearer ${SERVICE_JWT}" \
  "${POSTGREST_URL}/herbs?id=eq.${CREATED_ID}")
expect_status "service_role DELETE cleanup" "200|204" "$del_status"

echo "✓ All real PostgREST post-00104 smoke checks passed."
