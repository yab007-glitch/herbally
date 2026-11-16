#!/usr/bin/env python3
"""Propose missing herb fields from the herb's own PubMed monograph.

Read-only until --write-sql. For every published herb whose `traditional_uses`,
`modern_uses` or `side_effects` column is empty but whose monograph carries
relevant prose, ask the configured Ollama Cloud model to lift short labels out
of that prose — in English and French — and emit UPDATE statements.

Why this shape:

- The monograph is the page's own sourced text (every claim carries a PMID).
  The model is told to use nothing else, and every returned label must share a
  content word with the source paragraph, or it is dropped. A label is a
  phrase, not a sentence: 2-70 characters, no citations, no dose.
- Empty is a valid answer. Most monographs have a stub safety section
  ("No PubMed data available."), and the script leaves those rows alone.
- Animal-only findings are excluded from side effects, because a mouse result
  is not a human side effect.
- Nothing is written by this script. It prints SQL on request; the caller
  reviews and applies it, and both the proposals and the previous values stay
  in artifacts/ for rollback.

Usage:
  python3 scripts/backfill-fields-from-monographs.py --generate
  python3 scripts/backfill-fields-from-monographs.py --generate --limit 5
  python3 scripts/backfill-fields-from-monographs.py --write-sql > /tmp/f.sql
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANDIDATES = "/tmp/candidates.json"
OUT = os.path.join(ROOT, "artifacts", "field-backfill-proposals.jsonl")

MODEL = os.environ.get("OLLAMA_CLOUD_MODEL", "deepseek-v4.1-flash").strip()
BASE_URL = os.environ.get("OLLAMA_CLOUD_URL", "https://ollama.com/v1").strip()

SYSTEM = (
    "You extract short labels from a herb monograph. Use only the supplied text. "
    "Do not add facts, do not infer, do not write sentences, do not include PMIDs "
    "or citations, do not include doses. A label is a noun phrase of 2 to 70 "
    "characters, such as 'digestive complaints' or 'contact dermatitis'. Return an "
    "empty array when the supplied text does not state that field. "
    "traditional_uses are what the text says the herb was traditionally used to "
    "treat. modern_uses are conditions the text says the herb is USED TO TREAT or "
    "manage — never conditions that were merely studied, screened, or experimented "
    "on. Both lists are medicinal only: skip culinary, nutritional, industrial, "
    "agricultural, environmental, cosmetic and taxonomic statements, and never "
    "return a phrase that names the plant, its family, or what it is made of. "
    "Every label must name a condition, symptom, or therapeutic property. side_effects must name a specific symptom or effect (for example 'nausea'); "
    "never return a general phrase such as 'mild side effects' or 'well tolerated', "
    "and skip findings limited to animals or cell cultures. For each English label, "
    "give its Canadian French translation in the parallel fr array, same order."
)


def load_key():
    key = os.environ.get("OLLAMA_CLOUD_API_KEY", "").strip()
    if key:
        return key
    env_path = os.path.join(ROOT, ".env.local")
    try:
        with open(env_path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("OLLAMA_CLOUD_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    sys.exit("OLLAMA_CLOUD_API_KEY not configured")


def call(candidates, api_key):
    payload = {
        "model": MODEL,
        "temperature": 0.1,
        "max_tokens": 700,
        "reasoning_effort": "none",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": json.dumps(candidates, ensure_ascii=False)},
        ],
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL.rstrip('/')}/chat/completions",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body["choices"][0]["message"]["content"]


def parse_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?|\n?```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object")
    return json.loads(text[start : end + 1])


def tokens(text):
    return {w for w in re.findall(r"[a-z]{4,}", (text or "").lower())}


USE_CUE = re.compile(
    r"\b(used (to|for|in|as)|uses? for|treatment of|treat(s|ed|ing)?|"
    r"manag(e|es|ed|ement) of|indicated for|remedy for|therapy for|"
    r"applied (to|for)|administered (for|to))\b",
    re.I,
)
SAFETY_CUE = re.compile(
    r"\b(adverse|side effect|toxicit|toxic|hepatotox|nephrotox|risk of|"
    r"reported|associated with|caus(ed|es|ing)|led to|result(s|ed|ing) in|"
    r"contraindicat|caution|avoid)\b",
    re.I,
)
ANIMAL = re.compile(
    r"\b(mice|mouse|rats?|in vitro|cell lines?|cell cultures?|murine)\b", re.I
)
VACUOUS = {
    "side effects", "adverse effects", "mild side effects",
    "mild and transient side effects", "well tolerated", "no adverse effects",
    "no side effects", "safety",
}


def sentences(text):
    return re.split(r"(?<=[.!?;])\s+", text or "")


def gated(text, cue, exclude=None):
    """Keep only sentences that assert the field we are extracting."""
    keep = []
    for sentence in sentences(text):
        if cue.search(sentence) and not (exclude and exclude.search(sentence)):
            keep.append(sentence.strip())
    return " ".join(keep)


GENERIC = {
    "flavoring", "flavourings", "medicine", "health", "treatment", "ailments",
    "conditions", "diseases", "remedy", "uses", "use", "therapy",
    "médecine", "santé", "traitement", "maladie", "maladies", "affection",
    "affections", "usage", "usages", "remède", "thérapie",
}
# A medicinal list must not fill up with food, industrial, or taxonomic entries
# ("sorbent for environmental remediation", "edible alga", "calcium source").
NON_MEDICINAL = re.compile(
    r"\b(edible|food|culinary|spice|flavou?r|nutrition|nutritive|fodder|"
    r"industrial|agricultural|environmental|remediation|sorbent|fuel|timber|"
    r"ornamental|cosmetic|perfume|taxonom|genus|species|family|cultivar|"
    r"source|alga|plant|herb)\b",
    re.I,
)


def clean_items(items, source_tokens=None, max_items=4):
    """Keep short, grounded, citation-free labels."""
    out = []
    if not isinstance(items, list):
        return out
    for raw in items:
        if not isinstance(raw, str):
            continue
        item = re.sub(r"\s+", " ", raw).strip(" .;,:-")
        if not (2 <= len(item) <= 70):
            continue
        low = item.lower()
        if "pmid" in low or re.search(r"\d+\s*(mg|ml|g|mcg|µg)\b", low):
            continue
        if source_tokens is not None and not (tokens(item) & source_tokens):
            continue
        if item.lower() in GENERIC or item.lower() in VACUOUS:
            continue
        if NON_MEDICINAL.search(item):
            continue
        if item.lower() in {x.lower() for x in out}:
            continue
        out.append(item)
        if len(out) >= max_items:
            break
    return out


def request_for(row):
    asked = {}
    if row["n_trad"] == 0 and len(row.get("mono_trad") or "") > 60:
        asked["traditional_uses"] = row["mono_trad"]
    if row["n_modern"] == 0:
        modern = gated(
            (row.get("summary") or "") + " " + (row.get("mono_clinical") or ""),
            USE_CUE,
            ANIMAL,
        )
        if len(modern) > 40:
            asked["modern_uses"] = modern
    if row["n_se"] == 0:
        safety = gated(row.get("mono_safety") or "", SAFETY_CUE, ANIMAL)
        if len(safety) > 40:
            asked["side_effects"] = safety
    if not asked:
        return None
    return {
        "name": row["name"],
        "scientific_name": row["scientific_name"],
        "extract": {
            field: text[:2500] for field, text in asked.items()
        },
        "instructions": (
            "Return one object with keys traditional_uses_en, traditional_uses_fr, "
            "modern_uses_en, modern_uses_fr, side_effects_en, side_effects_fr. "
            "Every key must be an array; use [] when nothing is stated."
        ),
    }


def load_done():
    done = set()
    try:
        with open(OUT, "r", encoding="utf-8") as fh:
            for line in fh:
                try:
                    done.add(json.loads(line)["slug"])
                except Exception:
                    continue
    except FileNotFoundError:
        pass
    return done


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--generate", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--write-sql", action="store_true")
    args = ap.parse_args()

    if args.write_sql:
        write_sql()
        return

    rows = json.load(open(CANDIDATES, "r", encoding="utf-8"))
    done = load_done()
    todo = [r for r in rows if r["slug"] not in done]
    if args.limit:
        todo = todo[: args.limit]
    api_key = load_key()

    def work(row):
        req = request_for(row)
        if req is None:
            return {"slug": row["slug"], "skipped": "no source text"}
        try:
            content = call(req, api_key)
            parsed = parse_json(content)
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError,
                KeyError, json.JSONDecodeError) as exc:
            return {"slug": row["slug"], "error": f"{type(exc).__name__}: {exc}"}
        proposal = {"slug": row["slug"], "name": row["name"], "raw": parsed}
        if "traditional_uses" in req["extract"]:
            src = tokens(req["extract"]["traditional_uses"])
            proposal["traditional_uses"] = clean_items(
                parsed.get("traditional_uses_en"), src
            )
            proposal["traditional_uses_fr"] = clean_items(
                parsed.get("traditional_uses_fr"),
                None,
                max_items=len(proposal["traditional_uses"]),
            )
        if "modern_uses" in req["extract"]:
            src = tokens(req["extract"]["modern_uses"])
            proposal["modern_uses"] = clean_items(parsed.get("modern_uses_en"), src)
            proposal["modern_uses_fr"] = clean_items(
                parsed.get("modern_uses_fr"),
                None,
                max_items=len(proposal["modern_uses"]),
            )
        if "side_effects" in req["extract"]:
            src = tokens(req["extract"]["side_effects"])
            proposal["side_effects"] = clean_items(parsed.get("side_effects_en"), src)
            proposal["side_effects_fr"] = clean_items(
                parsed.get("side_effects_fr"),
                None,
                max_items=len(proposal["side_effects"]),
            )
        # A modern-use label that merely repeats a traditional one adds nothing
        # to the page; drop it (and the French twin at the same index).
        trad = {t.lower() for t in proposal.get("traditional_uses", [])}
        if proposal.get("modern_uses"):
            keep = [i for i, m in enumerate(proposal["modern_uses"]) if m.lower() not in trad]
            proposal["modern_uses"] = [proposal["modern_uses"][i] for i in keep]
            fr = proposal.get("modern_uses_fr") or []
            proposal["modern_uses_fr"] = [fr[i] for i in keep if i < len(fr)]
            if len(proposal["modern_uses_fr"]) != len(proposal["modern_uses"]):
                proposal.pop("modern_uses_fr", None)
        for en_key, fr_key in (
            ("traditional_uses", "traditional_uses_fr"),
            ("side_effects", "side_effects_fr"),
        ):
            if proposal.get(en_key) and len(proposal.get(fr_key) or []) != len(proposal[en_key]):
                proposal.pop(fr_key, None)
        return proposal

    results = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        for i, res in enumerate(pool.map(work, todo), 1):
            results.append(res)
            with open(OUT, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(res, ensure_ascii=False) + "\n")
            if i % 25 == 0:
                print(f"{i}/{len(todo)}", file=sys.stderr)
            time.sleep(0.35)

    ok = sum(1 for r in results if "error" not in r and "skipped" not in r)
    print(f"proposals written: {ok}/{len(todo)} -> {OUT}", file=sys.stderr)


def sql_array(values):
    return "ARRAY[" + ",".join("'" + v.replace("'", "''") + "'" for v in values) + "]::text[]"


def jsonb_array(values):
    return "'" + json.dumps(values, ensure_ascii=False).replace("'", "''") + "'::jsonb"


def write_sql():
    rows = {}
    for line in open(OUT, "r", encoding="utf-8"):
        rec = json.loads(line)
        if "error" in rec or "skipped" in rec:
            continue
        rows[rec["slug"]] = rec

    out = ["BEGIN;"]
    n = 0
    for slug, rec in rows.items():
        safe = slug.replace("'", "''")
        for field in ("traditional_uses", "modern_uses", "side_effects"):
            en = rec.get(field)
            if not en:
                continue
            # One statement per column, so each write is guarded on its own
            # emptiness and a missing translation never blanks a live one.
            out.append(
                f"UPDATE public.herbs SET {field} = {sql_array(en)} "
                f"WHERE slug = '{safe}' AND coalesce(cardinality({field}),0)=0;"
            )
            fr = rec.get(field + "_fr") or []
            if fr:
                out.append(
                    "UPDATE public.herbs SET translations = jsonb_set("
                    "coalesce(translations,'{}'::jsonb), "
                    f"'{{fr,{field}}}', {jsonb_array(fr)}, true) "
                    f"WHERE slug = '{safe}' AND "
                    f"coalesce(jsonb_array_length(translations->'fr'->'{field}'),0)=0;"
                )
            n += 1
    out.append("COMMIT;")
    print("\n".join(out))
    print(f"-- {n} field writes", file=sys.stderr)


if __name__ == "__main__":
    main()
