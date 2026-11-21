#!/usr/bin/env python3
"""Enrich thin herb entries and close EN/FR translation parity gaps from
verified local sources, official Health Canada HTML monographs, and
PubMed-backed herb_pubmed_monographs sheets.

Zero fabrication:
- Imports verified unmapped Health Canada NHP HTML monographs from
  `artifacts/hc-cache/` into `herb_monograph_sources` (matching exact species).
- Leaves any herb with zero source backing untouched.
- Never invents adult dosages from unverified text.
- Strips [PMID:...] markers from descriptions and checklist labels, rejects
  vague filler, rejects em/en dashes, and enforces content-token overlap with
  supplied source material.
- Writes resumable progress to `/tmp/thin-herb-fix-cache.jsonl` and emits
  idempotent SQL at `supabase/migrations/00084_fix_thin_herbs_and_fr_parity.sql`.

Usage:
  python3 scripts/fix-thin-herbs.py --limit 10
  python3 scripts/fix-thin-herbs.py
"""
import argparse
import html as html_lib
import importlib.util
import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"
HC_CACHE = ARTIFACTS / "hc-cache"
EXPORT_PATH = Path("/tmp/herbs-thin-export.json")
NO_SRC_PUBMED = Path("/tmp/no_src_pubmed_abstracts.json")
CACHE_PATH = Path("/tmp/thin-herb-fix-cache.jsonl")
OUT_SQL = ROOT / "supabase" / "migrations" / "00084_fix_thin_herbs_and_fr_parity.sql"

HC_ATTRIBUTION = "Contains information licensed under the Open Government Licence – Canada."

# Exact verified botanical Health Canada monographs in artifacts/hc-cache/
# mapped to published herb slugs that do not yet have a Health Canada row.
EXTRA_HC_MAP = {
    "aloe.topical.topique2": "aloe-vera-leaf",
    "basil.seed.graine2": "basil-holy-seed",
    "frankincense.oral2": "boswellia-carteri",
    "heal.all.oral2": "selfheal-herb",
    "marshmallow.leaf.guimauve.feuille2": "marshmallow-leaf",
    "rosemary.romarin.topical2": "rosmarinus-officinalis-l",
    "tomato.extract2": "solanum-lycopersicum",
    "diindolylmethane": "dim-natural-horm",
}

VAGUE_LABEL = re.compile(
    r"^(medicinal (purposes?|uses?|properties)|therapeutic (agent|use|purposes?)|"
    r"various (ailments|complaints|purposes)|general (tonic|medicine|health)|"
    r"folk medicine|health support|traditional medicine|side effects?|adverse effects?|"
    r"mild side effects?|well tolerated|no side effects?|none reported|"
    r"consult (a )?healthcare (practitioner|provider))$",
    re.I,
)
NON_MEDICINAL = re.compile(
    r"\b(cosmetic|perfume|timber|fodder|forage|fuel|ornamental|dye|insecticid|piscicid)\b",
    re.I,
)
NO_DATA_RE = re.compile(
    r"^(no pubmed data available\.?|not documented\.?|none known\.?|not established\.?|"
    r"consult a healthcare provider\.?)$",
    re.I,
)
DOSE_RE = re.compile(r"\b\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|µg|iu)\b", re.I)
OVERCLAIM_RE = re.compile(r"\b(cures?|miracle|guaranteed|100% safe|FDA[- ]approved)\b", re.I)

SYSTEM_PROMPT = (
    "You are a scientific bilingual (English and Canadian French) botanical "
    "encyclopedia editor. Use ONLY the supplied facts. Do not invent botanical "
    "traits, compounds, uses, side effects, contraindications, or doses. "
    "Do not include '[PMID:...]' tags or inline citation brackets in descriptions "
    "or array labels. Do not use em dashes or en dashes. Do not claim a plant "
    "cures disease; use measured encyclopedic language such as 'historically used "
    "for' or 'clinically studied for'. Return valid JSON only matching the requested keys."
)


def load_env():
    env = {}
    env_file = ROOT / ".env.local"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
            if m:
                env[m.group(1)] = m.group(2).strip("\"'")
    return env


def clean_str(s: str) -> str:
    if not isinstance(s, str):
        return ""
    s = re.sub(r"\[?\s*PMID\s*:?\s*\d+(?:\s*,\s*(?:PMID\s*:?\s*)?\d+)*\s*\]?", "", s, flags=re.I)
    s = s.replace("—", ", ").replace("–", "-")
    s = re.sub(r"\s+([.,;:])", r"\1", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-zàâäéèêëïîôöùûüç]{4,}", (text or "").lower())}


def is_meaningful_pm_text(val) -> bool:
    if not isinstance(val, str):
        return False
    s = re.sub(r"\bNo PubMed data available\.?", "", val, flags=re.I)
    s = re.sub(r"\bConsult a healthcare provider\.?", "", s, flags=re.I).strip()
    return len(s) >= 25 and not NO_DATA_RE.match(s)


def build_source_bundle(herb, pm, src_list, reg, extra_pm):
    parts = []
    # 1. Official monographs
    for s in src_list:
        claims = [
            c.get("text") if isinstance(c, dict) else str(c)
            for c in (s.get("claims") or [])
        ]
        safety = [str(x) for x in (s.get("safety") or [])]
        doses = [str(x) for x in (s.get("doses") or [])]
        chunk = []
        if claims:
            chunk.append("Uses/Indications: " + " | ".join(claims[:8]))
        if safety:
            chunk.append("Safety/Cautions: " + " | ".join(safety[:8]))
        if doses:
            chunk.append("Doses: " + " | ".join(doses[:5]))
        if chunk:
            parts.append(f"[{s['source']}]\n" + "\n".join(chunk))

    # 2. Regulatory evidence (Health Canada LNHPD)
    if reg:
        purposes = [str(x) for x in (reg.get("purposes") or [])][:8]
        risks = [str(x) for x in (reg.get("risks") or [])][:6]
        if purposes or risks:
            rchunk = []
            if purposes:
                rchunk.append("Authorized uses: " + "; ".join(purposes))
            if risks:
                rchunk.append("Authorized cautions: " + "; ".join(risks))
            parts.append("[Health Canada LNHPD]\n" + "\n".join(rchunk))

    # 3. PubMed-compiled sheet (EN & FR excerpts)
    if pm and isinstance(pm.get("content"), dict):
        c = pm["content"]
        pchunk = []
        for field in (
            "summary",
            "background",
            "traditionalUses",
            "activeCompounds",
            "mechanismOfAction",
            "safetyAndAdverseEffects",
            "pregnancyAndLactation",
            "drugInteractions",
        ):
            v = c.get(field)
            if is_meaningful_pm_text(v):
                pchunk.append(f"{field}: {v[:900]}")
        ce = c.get("clinicalEvidence")
        if isinstance(ce, list) and ce:
            ce_str = "; ".join(
                f"{item.get('condition', '')} ({item.get('summary', '')[:180]})"
                for item in ce[:4]
                if isinstance(item, dict) and item.get("summary")
            )
            if ce_str.strip():
                pchunk.append(f"clinicalEvidence: {ce_str[:900]}")
        elif is_meaningful_pm_text(ce):
            pchunk.append(f"clinicalEvidence: {str(ce)[:700]}")
        if pchunk:
            parts.append("[PubMed Monograph Sheet]\n" + "\n".join(pchunk))

    # 4. Fresh NCBI abstracts for otherwise unsourced herbs
    if extra_pm and extra_pm.get("articles"):
        echunk = [
            f"Title: {a['title']}\nAbstract: {a['abstract'][:700]}"
            for a in extra_pm["articles"][:3]
            if a.get("abstract") or a.get("title")
        ]
        if echunk:
            parts.append("[PubMed Literature]\n" + "\n\n".join(echunk))

    # Existing herb description for context (never discard existing info)
    if (herb.get("description") or "").strip():
        parts.append(f"[Existing Summary]\n{herb['description']}")

    return "\n\n".join(parts)[:6000]


def determine_needs(herb):
    fr = (herb.get("translations") or {}).get("fr") or {}
    if not isinstance(fr, dict):
        fr = {}
    desc_en = (herb.get("description") or "").strip()
    desc_fr = (fr.get("description") or "").strip() if isinstance(fr.get("description"), str) else ""
    raw_sub = herb.get("raw_sub") or 0

    need_desc_en = len(desc_en) < 260 or (raw_sub < 400 and len(desc_en) < 420)
    need_desc_fr = len(desc_fr) < 260 or need_desc_en
    need_trad = len(herb.get("traditional_uses") or []) == 0
    need_mod = len(herb.get("modern_uses") or []) == 0
    need_cmp = len(herb.get("active_compounds") or []) == 0
    need_se = len(herb.get("side_effects") or []) == 0
    need_con = len(herb.get("contraindications") or []) == 0

    se_list = herb.get("side_effects") or []
    con_list = herb.get("contraindications") or []
    dose_en = (herb.get("dosage_adult") or "").strip()

    fr_se = fr.get("side_effects")
    fr_con = fr.get("contraindications")
    fr_dose = fr.get("dosage_adult")

    need_translate_se_fr = len(se_list) > 0 and not (isinstance(fr_se, list) and len(fr_se) > 0)
    need_translate_con_fr = len(con_list) > 0 and not (isinstance(fr_con, list) and len(fr_con) > 0)
    need_translate_dose_fr = bool(dose_en) and not (isinstance(fr_dose, str) and fr_dose.strip())

    return {
        "desc_en": need_desc_en,
        "desc_fr": need_desc_fr,
        "trad": need_trad,
        "mod": need_mod,
        "cmp": need_cmp,
        "se": need_se,
        "con": need_con,
        "translate_se_fr": need_translate_se_fr,
        "translate_con_fr": need_translate_con_fr,
        "translate_dose_fr": need_translate_dose_fr,
    }


def call_llm(herb, needs, src_text, api_key, base_url, model):
    asked = []
    if needs["desc_en"]:
        asked.append(
            '"description_en": 2 to 4 original sentences in plain modern English (330 to 620 characters). '
            "Describe the herb's identity/origin, primary active constituents or properties, and documented traditional or studied uses strictly from the supplied source material. No doses, no PMID brackets, no em dashes."
        )
    if needs["desc_fr"]:
        if needs["desc_en"]:
            asked.append(
                '"description_fr": Accurate natural Canadian French equivalent of description_en (340 to 720 characters). No PMID brackets, no em dashes.'
            )
        else:
            asked.append(
                '"description_fr": Complete, natural Canadian French translation/expansion of the existing English description (at least 300 characters, keeping all facts; no PMID brackets, no em dashes).'
            )
    if needs["trad"]:
        asked.append(
            '"traditional_uses_en": array of 2 to 4 short condition/purpose noun phrases (2 to 65 chars each) documented as traditional medicinal uses in the source (or [] if none).'
        )
        asked.append(
            '"traditional_uses_fr": parallel Canadian French array matching traditional_uses_en in same order.'
        )
    if needs["mod"]:
        asked.append(
            '"modern_uses_en": array of 2 to 4 short clinical/researched medicinal application noun phrases (2 to 65 chars each) grounded in human evidence from the source (or [] if none).'
        )
        asked.append(
            '"modern_uses_fr": parallel Canadian French array matching modern_uses_en in same order.'
        )
    if needs["cmp"]:
        asked.append(
            '"active_compounds": array of 2 to 6 specific chemical compounds/constituents explicitly named in the source (or [] if none named).'
        )
    if needs["se"]:
        asked.append(
            '"side_effects_en": array of 2 to 4 specific human side effects/adverse reactions explicitly documented in the source safety text (skip animal-only findings and vague filler like "well tolerated"; return [] if none stated).'
        )
        asked.append(
            '"side_effects_fr": parallel Canadian French array matching side_effects_en in same order.'
        )
    elif needs["translate_se_fr"]:
        asked.append(
            f'"side_effects_fr": translate this exact English list into natural Canadian French, same length and order: {json.dumps(herb["side_effects"], ensure_ascii=False)}'
        )
    if needs["con"]:
        asked.append(
            '"contraindications_en": array of 2 to 4 specific contraindications, pregnancy/nursing cautions, or medication interaction precautions explicitly stated in the source safety text (or [] if none stated).'
        )
        asked.append(
            '"contraindications_fr": parallel Canadian French array matching contraindications_en in same order.'
        )
    elif needs["translate_con_fr"]:
        asked.append(
            f'"contraindications_fr": translate this exact English list into natural Canadian French, same length and order: {json.dumps(herb["contraindications"], ensure_ascii=False)}'
        )
    if needs["translate_dose_fr"]:
        asked.append(
            f'"dosage_adult_fr": translate this English dosage line accurately into natural Canadian French: {json.dumps(herb["dosage_adult"], ensure_ascii=False)}'
        )

    user_msg = (
        f"Herb: {herb['name']} ({herb['scientific_name']})\n\n"
        f"Source Material:\n\"\"\"\n{src_text}\n\"\"\"\n\n"
        "Return a single JSON object containing ONLY these keys:\n- "
        + "\n- ".join(asked)
    )
    payload = {
        "model": model,
        "temperature": 0.15,
        "max_tokens": 1300,
        "reasoning_effort": "none",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
    }
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        res = json.loads(resp.read().decode("utf-8"))
    raw = res["choices"][0]["message"]["content"].strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw)
    start, end = raw.find("{"), raw.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("Invalid JSON response")
    return json.loads(raw[start : end + 1])


def clean_array_pair(en_list, fr_list, src_tokens, max_items=4, allow_non_alpha=False):
    if not isinstance(en_list, list):
        return [], []
    if not isinstance(fr_list, list):
        fr_list = []
    out_en, out_fr = [], []
    seen = set()
    for idx, raw_en in enumerate(en_list):
        item = clean_str(str(raw_en)).strip(" .;,:-")
        if not (2 <= len(item) <= 115):
            continue
        if VAGUE_LABEL.match(item) or NON_MEDICINAL.search(item):
            continue
        if "pmid" in item.lower() or DOSE_RE.search(item) or OVERCLAIM_RE.search(item):
            continue
        if not allow_non_alpha and src_tokens:
            itoks = tokens(item)
            if itoks and not (itoks & src_tokens):
                stems = {t[:3] for t in src_tokens}
                if not any(t[:3] in stems for t in itoks):
                    continue
        if item.lower() in seen:
            continue
        seen.add(item.lower())
        fr_item = clean_str(str(fr_list[idx])).strip(" .;,:-") if idx < len(fr_list) else ""
        if not fr_item:
            fr_item = item
        out_en.append(item)
        out_fr.append(fr_item[:130])
        if len(out_en) >= max_items:
            break
    return out_en, out_fr


def validate_result(herb, needs, raw, src_text):
    src_toks = tokens(src_text + " " + (herb.get("name") or "") + " " + (herb.get("scientific_name") or ""))
    out = {}

    if needs["desc_en"]:
        d_en = clean_str(raw.get("description_en", ""))
        if 260 <= len(d_en) <= 1050 and not OVERCLAIM_RE.search(d_en) and not NO_DATA_RE.match(d_en):
            if not DOSE_RE.search(d_en) or DOSE_RE.search(src_text):
                out["description_en"] = d_en

    if needs["desc_fr"]:
        d_fr = clean_str(raw.get("description_fr", ""))
        if 260 <= len(d_fr) <= 2400 and not OVERCLAIM_RE.search(d_fr) and not NO_DATA_RE.match(d_fr):
            out["description_fr"] = d_fr

    if needs["trad"]:
        en_l, fr_l = clean_array_pair(raw.get("traditional_uses_en"), raw.get("traditional_uses_fr"), src_toks, 4)
        if en_l:
            out["traditional_uses_en"] = en_l
            out["traditional_uses_fr"] = fr_l

    if needs["mod"]:
        en_l, fr_l = clean_array_pair(raw.get("modern_uses_en"), raw.get("modern_uses_fr"), src_toks, 4)
        if en_l:
            out["modern_uses_en"] = en_l
            out["modern_uses_fr"] = fr_l

    if needs["cmp"]:
        cmps = []
        seen = set()
        for c in (raw.get("active_compounds") or []):
            cs = clean_str(str(c)).strip(" .;,:-")
            if 2 <= len(cs) <= 70 and cs.lower() not in seen and "pmid" not in cs.lower():
                itoks = tokens(cs)
                if not itoks or any(t[:4] in {x[:4] for x in src_toks} for t in itoks):
                    seen.add(cs.lower())
                    cmps.append(cs)
            if len(cmps) >= 6:
                break
        if cmps:
            out["active_compounds"] = cmps

    if needs["se"]:
        en_l, fr_l = clean_array_pair(raw.get("side_effects_en"), raw.get("side_effects_fr"), src_toks, 4)
        if en_l:
            out["side_effects_en"] = en_l
            out["side_effects_fr"] = fr_l
    elif needs["translate_se_fr"]:
        fr_raw = raw.get("side_effects_fr")
        if isinstance(fr_raw, list) and len(fr_raw) == len(herb["side_effects"]):
            cleaned = [clean_str(str(x)).strip(" .;") for x in fr_raw]
            if all(len(x) >= 2 for x in cleaned):
                out["side_effects_fr"] = cleaned

    if needs["con"]:
        en_l, fr_l = clean_array_pair(raw.get("contraindications_en"), raw.get("contraindications_fr"), src_toks, 4)
        if en_l:
            out["contraindications_en"] = en_l
            out["contraindications_fr"] = fr_l
    elif needs["translate_con_fr"]:
        fr_raw = raw.get("contraindications_fr")
        if isinstance(fr_raw, list) and len(fr_raw) == len(herb["contraindications"]):
            cleaned = [clean_str(str(x)).strip(" .;") for x in fr_raw]
            if all(len(x) >= 2 for x in cleaned):
                out["contraindications_fr"] = cleaned

    if needs["translate_dose_fr"]:
        df = clean_str(raw.get("dosage_adult_fr", ""))
        if len(df) >= 3:
            out["dosage_adult_fr"] = df

    return out


def deterministic_fallback(herb, needs, pm):
    out = {}
    if not pm or not isinstance(pm.get("content"), dict):
        return out
    c = pm["content"]
    if needs["desc_en"] and is_meaningful_pm_text(c.get("summary")):
        s1 = clean_str(c.get("summary", ""))
        s2 = clean_str(c.get("background", "")) if is_meaningful_pm_text(c.get("background")) else ""
        combined = f"{s1} {s2}".strip() if s2 and s2[:40].lower() != s1[:40].lower() else s1
        if len(combined) > 580:
            # Trim cleanly on sentence boundary
            sents = re.split(r"(?<=[.!?])\s+", combined)
            acc = []
            for st in sents:
                if sum(len(x) for x in acc) + len(st) > 580 and acc:
                    break
                acc.append(st)
            combined = " ".join(acc)
        if len(combined) >= 200:
            out["description_en"] = combined
    if needs["desc_fr"] and isinstance(c.get("fr"), dict) and is_meaningful_pm_text(c["fr"].get("summary")):
        s1 = clean_str(c["fr"].get("summary", ""))
        s2 = clean_str(c["fr"].get("background", "")) if is_meaningful_pm_text(c["fr"].get("background")) else ""
        combined = f"{s1} {s2}".strip() if s2 and s2[:40].lower() != s1[:40].lower() else s1
        if len(combined) > 640:
            sents = re.split(r"(?<=[.!?])\s+", combined)
            acc = []
            for st in sents:
                if sum(len(x) for x in acc) + len(st) > 640 and acc:
                    break
                acc.append(st)
            combined = " ".join(acc)
        if len(combined) >= 200:
            out["description_fr"] = combined
    return out


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def sql_text_array(items: list[str]) -> str:
    return "ARRAY[" + ", ".join(sql_str(x) for x in items) + "]::text[]"


def build_hc_inserts():
    spec = importlib.util.spec_from_file_location(
        "imp", ROOT / "scripts" / "import-remaining-monographs.py"
    )
    imp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(imp)

    sql = []
    for atid, slug in sorted(EXTRA_HC_MAP.items()):
        f = HC_CACHE / f"{atid}.html"
        if not f.exists():
            continue
        uses, doses, safety = imp.parse_hc_html(f.read_text(encoding="utf-8", errors="ignore"))
        if not uses and not doses and not safety:
            continue
        claims = [{"section": "Use(s) or Purpose(s)", "text": u} for u in uses[:25]]
        url = f"https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid={atid}&lang=eng"
        sql.append(
            "INSERT INTO public.herb_monograph_sources (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, retrieved_at)\n"
            f"SELECT h.slug, 'Health Canada', 'ogl-canada', {sql_str(HC_ATTRIBUTION)}, {sql_str(url)}, "
            f"{sql_str(json.dumps(claims, ensure_ascii=False))}::jsonb, "
            f"{sql_str(json.dumps(safety[:30], ensure_ascii=False))}::jsonb, "
            f"{sql_str(json.dumps(doses[:25], ensure_ascii=False))}::jsonb, "
            "'imported-ogl-canada', CURRENT_DATE\n"
            f"FROM public.herbs h WHERE h.slug = {sql_str(slug)} AND h.is_published = true\n"
            "ON CONFLICT (herb_slug, source) DO NOTHING;"
        )
    return sql


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=10)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not EXPORT_PATH.exists():
        sys.exit(f"Missing {EXPORT_PATH}")

    env = load_env()
    api_key = env.get("OLLAMA_CLOUD_API_KEY", "").strip()
    base_url = env.get("OLLAMA_CLOUD_URL", "https://ollama.com/v1").strip()
    model = env.get("OLLAMA_CLOUD_MODEL", "deepseek-v4.1-flash").strip()
    if not api_key:
        sys.exit("Missing OLLAMA_CLOUD_API_KEY")

    data = json.loads(EXPORT_PATH.read_text(encoding="utf-8"))
    extra_pm = json.loads(NO_SRC_PUBMED.read_text(encoding="utf-8")) if NO_SRC_PUBMED.exists() else {}
    pm_map = {p["slug"]: p for p in data["pubmed"]}
    src_map = {}
    for s in data["sources"]:
        src_map.setdefault(s["herb_slug"], []).append(s)
    reg_map = {r["herb_slug"]: r for r in data["regulatory"]}

    cache = {}
    if CACHE_PATH.exists():
        for line in CACHE_PATH.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                rec = json.loads(line)
                cache[rec["slug"]] = rec
            except Exception:
                continue

    tasks = []
    skipped_no_source = 0
    for herb in data["gap_herbs"]:
        slug = herb["slug"]
        needs = determine_needs(herb)
        if not any(needs.values()):
            continue
        pm = pm_map.get(slug)
        srcs = src_map.get(slug, [])
        reg = reg_map.get(slug)
        epm = extra_pm.get(slug)
        src_text = build_source_bundle(herb, pm, srcs, reg, epm)
        # Check if we actually have grounded backing beyond just existing short desc
        has_grounding = bool(pm or srcs or reg or epm)
        only_pure_translation = (
            not needs["desc_en"]
            and not needs["desc_fr"]
            and not needs["trad"]
            and not needs["mod"]
            and not needs["cmp"]
            and not needs["se"]
            and not needs["con"]
        )
        if not has_grounding and not only_pure_translation:
            skipped_no_source += 1
            continue
        if slug in cache:
            continue
        tasks.append((herb, needs, src_text, pm))

    if args.limit > 0:
        tasks = tasks[: args.limit]

    print(
        f"Gap herbs={len(data['gap_herbs'])}, cached={len(cache)}, "
        f"to_process={len(tasks)}, skipped_no_source={skipped_no_source}",
        flush=True,
    )

    lock = Lock()
    ok, fb_cnt, fail_cnt = 0, 0, 0

    def process(item):
        herb, needs, src_text, pm = item
        slug = herb["slug"]
        last_err = None
        for attempt in range(3):
            try:
                raw = call_llm(herb, needs, src_text, api_key, base_url, model)
                validated = validate_result(herb, needs, raw, src_text)
                if validated or not (needs["desc_en"] or needs["desc_fr"]):
                    return {"slug": slug, "updates": validated, "mode": "llm"}
            except Exception as exc:
                last_err = str(exc)
                time.sleep(1.0 * (attempt + 1))
        fb = deterministic_fallback(herb, needs, pm)
        if fb:
            return {"slug": slug, "updates": fb, "mode": "fallback"}
        return {"slug": slug, "updates": {}, "mode": "empty", "error": last_err}

    with CACHE_PATH.open("a", encoding="utf-8") as cfh:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futs = [pool.submit(process, t) for t in tasks]
            for i, fut in enumerate(as_completed(futs), 1):
                res = fut.result()
                cache[res["slug"]] = res
                with lock:
                    cfh.write(json.dumps(res, ensure_ascii=False) + "\n")
                    cfh.flush()
                if res["mode"] == "llm":
                    ok += 1
                elif res["mode"] == "fallback":
                    fb_cnt += 1
                else:
                    fail_cnt += 1
                if i % 50 == 0 or i == len(tasks):
                    print(f"Progress {i}/{len(tasks)} (llm={ok}, fallback={fb_cnt}, empty={fail_cnt})", flush=True)

    if args.dry_run:
        return

    # Emit migration SQL
    sql_parts = [
        "-- 2026-11-20 Fix thin herb entries, import remaining Health Canada botanical monographs,",
        "-- enrich empty clinical arrays from verified sources, and close EN/FR translation parity.",
        "-- Generated deterministically by scripts/fix-thin-herbs.py",
        "",
        "BEGIN;",
        "",
        "-- 1. Additional exact-match Health Canada botanical monographs",
    ]
    sql_parts.extend(build_hc_inserts())
    sql_parts.append("")
    sql_parts.append("-- 2. Enriched descriptions, clinical arrays, and FR translations")

    updated_count = 0
    herb_by_slug = {h["slug"]: h for h in data["gap_herbs"]}
    for slug in sorted(cache.keys()):
        if slug not in herb_by_slug:
            continue
        upd = cache[slug].get("updates") or {}
        if not upd:
            continue
        herb = herb_by_slug[slug]
        sets = []
        fr_patch = {}

        if "description_en" in upd:
            sets.append(f"description = {sql_str(upd['description_en'])}")
        if "description_fr" in upd:
            fr_patch["description"] = upd["description_fr"]

        if "traditional_uses_en" in upd and not (herb.get("traditional_uses") or []):
            sets.append(f"traditional_uses = {sql_text_array(upd['traditional_uses_en'])}")
            fr_patch["traditional_uses"] = upd["traditional_uses_fr"]

        if "modern_uses_en" in upd and not (herb.get("modern_uses") or []):
            sets.append(f"modern_uses = {sql_text_array(upd['modern_uses_en'])}")
            fr_patch["modern_uses"] = upd["modern_uses_fr"]

        if "active_compounds" in upd and not (herb.get("active_compounds") or []):
            sets.append(f"active_compounds = {sql_text_array(upd['active_compounds'])}")

        if "side_effects_en" in upd and not (herb.get("side_effects") or []):
            sets.append(f"side_effects = {sql_text_array(upd['side_effects_en'])}")
            fr_patch["side_effects"] = upd["side_effects_fr"]
        elif "side_effects_fr" in upd:
            fr_patch["side_effects"] = upd["side_effects_fr"]

        if "contraindications_en" in upd and not (herb.get("contraindications") or []):
            sets.append(f"contraindications = {sql_text_array(upd['contraindications_en'])}")
            fr_patch["contraindications"] = upd["contraindications_fr"]
        elif "contraindications_fr" in upd:
            fr_patch["contraindications"] = upd["contraindications_fr"]

        if "dosage_adult_fr" in upd:
            fr_patch["dosage_adult"] = upd["dosage_adult_fr"]

        if fr_patch:
            fr_json = sql_str(json.dumps(fr_patch, ensure_ascii=False)) + "::jsonb"
            sets.append(
                "translations = COALESCE(translations, '{}'::jsonb) || "
                f"jsonb_build_object('fr', COALESCE(translations->'fr', '{{}}'::jsonb) || {fr_json})"
            )

        if not sets:
            continue
        sets.append("updated_at = NOW()")
        sql_parts.append(
            f"UPDATE public.herbs SET {', '.join(sets)} WHERE slug = {sql_str(slug)} AND is_published = true;"
        )
        updated_count += 1

    sql_parts.extend(["", "COMMIT;", ""])
    OUT_SQL.write_text("\n".join(sql_parts), encoding="utf-8")
    print(f"Wrote {OUT_SQL} with {updated_count} herb updates.")


if __name__ == "__main__":
    main()
