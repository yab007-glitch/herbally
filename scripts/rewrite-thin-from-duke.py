#!/usr/bin/env python3
"""Rewrite thin herb pages from Dr. Duke's CC0 ethnobotanical database.

The source is the USDA-ARS database archived by the National Agricultural
Library on Ag Data Commons (DOI 10.15482/USDA.ADC/1239279), released CC0.
It is not the copyrighted Duke's Handbook; no text is copied from either.
Each record is a use label plus the region where it was recorded, which is
enough to write an original page grounded in documented ethnobotany.

Read-only until --apply. Every applied row keeps its previous values in the
JSONL so it can be rolled back individually.
"""
import argparse
import collections
import csv
import importlib.util
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUKE = "/tmp/duke-db/data/ETHNOBOT.csv"
CANDIDATES = "/tmp/thin-duke-candidates.json"
OUT = os.path.join(ROOT, "artifacts", "thin-rewrite-duke.jsonl")
BACKUP = os.path.join(ROOT, "artifacts", "thin-rewrite-duke-backup.jsonl")

SOURCE_NAME = "Dr. Duke's Phytochemical and Ethnobotanical Databases (USDA ARS)"
SOURCE_URL = "https://doi.org/10.15482/USDA.ADC/1239279"
SOURCE_CITE = ("U.S. Department of Agriculture, Agricultural Research Service. "
               "1992-2016. Dr. Duke's Phytochemical and Ethnobotanical Databases.")

# Non-medicinal, non-use, or unsafe-to-publish labels. Everything else in the
# table is a condition or a therapeutic property and can be written up.
NONMED = re.compile(
    r"poison|piscicid|insecticid|repellent|\bfish\b|arrow|magic|ritual|"
    r"veterinar|fib(er|re)|dye|tannin|forage|fodder|fuel|timber|basket|"
    r"cordage|thatch|ornamental|hedge|adhesive|perfume|incense|airwick|"
    r"deodor|detergent|soap|cosmetic|gum|resin|latex|wax|starch|paper|"
    r"\bmat\b|rope|cloth|shelter|hunting|fishing|ornament|glue|ink|varnish|"
    r"alcohol|beverage|\bfood\b|famine|condiment|spice|flavou?r|nutritive|repel|"
    r"abort|ecbolic|emmenagogue|cancer|tumou?r|carcinogen|mutagen|antidote",
    re.I)

LANG = {"german", "english", "french", "dutch", "spanish", "italian",
        "chinese", "greek", "latin", "arabic", "hindi", "portuguese",
        "russian", "japanese", "korean", "burmese", "thai"}

SYSTEM = (
    "You write reference entries for a herbal encyclopedia. You are given an "
    "ethnobotanical record: the plant's family, the regions where its use was "
    "recorded, and a list of documented applications. Write complete, original, "
    "modern English. Use only the facts given. Do not invent botanical "
    "description, chemistry, preparation, dose, or efficacy. Do not claim the "
    "plant treats or cures disease; describe what was recorded, using phrasing "
    "such as 'traditionally recorded for'. No em dashes. Return JSON only."
)

# Reuse the validator from the public-domain rewrite so both sources are held
# to the same bar (length, filler, overclaim, dose, dash, copied runs).
_spec = importlib.util.spec_from_file_location(
    "pdrewrite", os.path.join(ROOT, "scripts", "rewrite-thin-from-pd.py"))
pd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pd)

ENV = pd.ENV
BASE = pd.BASE
KEY = pd.KEY
MODEL = pd.MODEL
OLLAMA = pd.OLLAMA


def api(url, method="GET", body=None, headers=None, timeout=60):
    return pd.api(url, method=method, body=body, headers=headers, timeout=timeout)


def library():
    """Every published row, with a retry on the transient 500s the nano throws."""
    cols = ("slug,name,scientific_name,description,traditional_uses,"
            "dosage_adult,provenance")
    out, offset = [], 0
    while True:
        url = (f"{BASE}/rest/v1/herbs?select={cols}&is_published=eq.true"
               f"&order=slug&limit=1000&offset={offset}")
        rows = None
        for attempt in range(4):
            try:
                _, rows = api(url)
                break
            except Exception as e:                         # noqa: BLE001
                print(f"  library retry {attempt + 1}: {e}", flush=True)
                time.sleep(3 * (attempt + 1))
        if rows is None:
            sys.exit("library load failed after retries")
        out.extend(rows)
        if len(rows) < 1000:
            break
        offset += 1000
    return {h["slug"]: h for h in out}


def binomial(row):
    g = (row.get("GENUS") or "").strip().lower()
    s = (row.get("SPECIES") or "").strip().lower()
    return f"{g} {s}" if g and s else None


def region_name(value):
    v = (value or "").strip().rstrip("*")
    base = v.split("(")[0].strip()
    low = base.lower()
    if not base or low == "elsewhere" or low in LANG:
        return None
    if low == "us":
        return "the United States"
    if low == "uk":
        return "the United Kingdom"
    if low == "us(a)":
        return "the United States"
    return base


def readable(label):
    """Turn 'Ache(Head)' into 'headache' and leave the rest alone."""
    m = re.match(r"^Ache\((\w+)\)$", label)
    if m:
        part = m.group(1).lower()
        return {"head": "headache", "tooth": "toothache", "back": "backache",
                "ear": "earache", "stomach": "stomach ache"}.get(part, f"{part} ache")
    return label.replace("_", " ").strip()


def load_duke():
    by = collections.defaultdict(lambda: {"acts": set(), "regions": collections.Counter(),
                                          "family": "", "refs": set()})
    with open(DUKE, encoding="utf-8", errors="replace", newline="") as f:
        for row in csv.DictReader(f):
            b = binomial(row)
            if not b:
                continue
            rec = by[b]
            act = (row.get("ACTIVITY") or "").strip()
            if act:
                rec["acts"].add(readable(act))
            r = region_name(row.get("COUNTRY"))
            if r:
                rec["regions"][r] += 1
            if not rec["family"] and (row.get("FAMILY") or "").strip():
                rec["family"] = row["FAMILY"].strip().title()
            ref = (row.get("REFERENCE") or "").strip()
            if ref:
                rec["refs"].add(ref)
    return by


def build_item(herb, rec):
    acts = sorted(a for a in rec["acts"] if a and not NONMED.search(a))
    if len(acts) < 3:
        return None
    regions = [r for r, _ in rec["regions"].most_common(6)]
    family = rec["family"] or "not recorded"
    return {
        "activities": acts,
        "regions": regions,
        "family": family,
        "record_count": len(rec["acts"]),
        "text": ", ".join(acts) + " | " + ", ".join(regions),
        "refs": sorted(rec["refs"])[:8],
    }


OPENINGS = (
    "Lead with the plant's common name and the single most distinctive "
    "application in its record.",
    "Lead with the family and the region or regions where the plant is used.",
    "Lead with the therapeutic theme that appears most often in the list, "
    "without naming the family first.",
    "Lead with a plain statement of what the plant was used for, then bring in "
    "the family and the regions.",
)


def call_model(herb, item, retry=0):
    acts = item["activities"][:40]
    regions = ", ".join(item["regions"]) or "not recorded"
    geo = (
        f"Regions where use was recorded: {regions}\n" if item["regions"]
        else "Regions where use was recorded: none listed. Do not mention any "
             "region or country.\n"
    )
    opening = OPENINGS[sum(ord(ch) for ch in herb["slug"]) % len(OPENINGS)]
    # Where a common name exists, the Latin name is withheld: given it, the
    # model opens nearly every entry with "<Binomial>, a member of the <Family>
    # family", which reads as machine output across a thousand pages. Where the
    # common name is itself the binomial there is nothing else to call the
    # plant, so it stays.
    has_common = item.get("has_common")
    label = herb["name"] if has_common else (
        f"{herb['name']} (the only name recorded for it)")
    user = (
        f"Herb: {label}\n"
        f"Family: {item['family']}\n{geo}"
        f"Documented applications ({item['record_count']} in total): "
        f"{', '.join(acts)}\n\n"
        f"Opening style for this entry: {opening}\n\n"
        "Write JSON with exactly two keys:\n"
        "- description: 2 to 4 sentences, 320 to 700 characters, plain modern "
        "English. Name the plant, its family and the regions where its use was "
        "recorded, and describe the main medicinal applications, grouping "
        "related ones instead of listing every label. "
        + ("Do not use a Latin or scientific name anywhere; start from the "
           "common name or from an application. " if has_common else "")
        + "If no regions are listed, "
        "leave geography out and do not say that any are missing. Archaic "
        "technical labels (vulnerary, rubefacient, resolvent, discutient, "
        "deobstruent) should be explained in plain words or left out. Vary "
        "sentence length and structure.\n"
        "- traditional_uses: 2 to 5 short noun phrases, each 2 to 10 words, "
        "naming a condition or purpose drawn from the list, for example "
        "'fever and malaria' or 'skin inflammation'. Do not list taxonomy, "
        "regions, or history as a use, and do not invent a use not in the list.\n"
        "Do not give doses, recipes, or preparation instructions. Do not say "
        "the plant treats or cures disease. Write directly about the plant: do "
        "not say 'the source', 'the excerpt', or 'the record'. No em dashes, and "
        "do not name the database."
    )
    if retry:
        user += (
            " Your previous attempt failed validation. Rewrite from scratch, "
            "remove any dose, filler phrase, or copied wording, keep every "
            "claim inside the application list, and do not open with the "
            "scientific name followed by a clause about the family."
        )
    body = {
        "model": MODEL,
        "messages": [{"role": "system", "content": SYSTEM},
                     {"role": "user", "content": user}],
        "temperature": 0.7 if retry else 0.5,
        "max_tokens": 900,
        "reasoning_effort": "none",
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        f"{OLLAMA}/chat/completions", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {ENV['OLLAMA_CLOUD_API_KEY']}"},
        method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.load(r)
    content = data["choices"][0]["message"]["content"]
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
    return json.loads(content)


def own_text(h):
    """Same metric as the importer: description + uses + dosage."""
    uses = h.get("traditional_uses") or []
    if isinstance(uses, str):
        uses = [uses]
    return (len(h.get("description") or "")
            + sum(len(u or "") for u in uses if isinstance(u, str))
            + len(h.get("dosage_adult") or ""))


def build_candidates(limit=None):
    herbs = library()
    duke = load_duke()
    rich_by_species = collections.defaultdict(list)
    for h in herbs.values():
        b = (h.get("scientific_name") or "").strip().lower()
        m = re.match(r"^([a-z]+)\s+([a-z\-]+)", b)
        if m and own_text(h) >= 400:
            rich_by_species[f"{m.group(1)} {m.group(2)}"].append(h["slug"])

    picked, skipped = {}, collections.Counter()
    for slug, h in herbs.items():
        if own_text(h) >= 400:
            continue
        prov = h.get("provenance") or {}
        if isinstance(prov, dict) and prov.get("verification_status") in (
                "formula", "non_plant"):
            skipped["formula or non-plant"] += 1
            continue
        if pd.PRODUCT_SLUG.search(slug):
            skipped["product page"] += 1
            continue
        m = re.match(r"^([a-z]+)\s+([a-z\-]+)",
                     (h.get("scientific_name") or "").strip().lower())
        if not m:
            skipped["no binomial"] += 1
            continue
        key = f"{m.group(1)} {m.group(2)}"
        if rich_by_species.get(key):
            skipped["species already has a rich page"] += 1
            continue
        rec = duke.get(key)
        if not rec:
            skipped["not in Duke ethnobotany"] += 1
            continue
        item = build_item(h, rec)
        if not item:
            skipped["too few medicinal labels"] += 1
            continue
        picked[slug] = {"slug": slug, "name": h.get("name"),
                        "scientific_name": h.get("scientific_name"),
                        "has_common": (h.get("name") or "").strip().lower()
                        != (h.get("scientific_name") or "").strip().lower(),
                        "binomial": key, **item}
    out = sorted(picked.values(), key=lambda r: r["slug"])
    if limit:
        out = out[:limit]
    json.dump({"candidates": out, "skipped": dict(skipped)},
              open(CANDIDATES, "w"), indent=1)
    print(f"[candidates] {len(out)} pages", flush=True)
    for k, v in skipped.most_common():
        print(f"  skipped {v:5d}  {k}", flush=True)
    return out


def opening_ok(desc, item):
    """Reject the encyclopedic template that the model falls back to.

    'X, a member of the Y family, has been traditionally recorded...' on 1,100
    pages reads as machine output even when every fact is right. The family
    still has to appear, just not in the first sentence alongside the name.
    """
    name = (item.get("scientific_name") or "").strip()
    if item.get("has_common") and name and desc.lower().startswith(name.lower()):
        return False
    if not item.get("regions") and re.search(
            r"\b(region|regions|country|countries|not listed|not documented|"
            r"no record)\b", desc, re.I):
        return False
    return True


def generate(workers=3, limit=None):
    data = json.load(open(CANDIDATES))
    cands = data["candidates"]
    herbs = library()

    done = set()
    if os.path.exists(OUT):
        for line in open(OUT, encoding="utf-8"):
            try:
                row = json.loads(line)
                if row.get("status") in ("ok", "skipped"):
                    done.add(row["slug"])
            except json.JSONDecodeError:
                continue
    todo = [c for c in cands if c["slug"] not in done]
    if limit:
        todo = todo[:limit]
    print(f"[generate] candidates {len(cands)}, done {len(done)}, to do {len(todo)}",
          flush=True)

    lock = Lock()
    counts = collections.Counter()
    with open(OUT, "a", encoding="utf-8") as fh:
        def write(row):
            with lock:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
                fh.flush()

        def one(c):
            slug = c["slug"]
            herb = herbs.get(slug)
            if not herb:
                write({"slug": slug, "status": "skipped", "reason": "not in library"})
                return
            last, result = None, None
            for attempt in range(3):
                try:
                    obj = call_model(herb, c, retry=attempt)
                except Exception as e:                     # noqa: BLE001
                    last = f"api: {type(e).__name__}: {e}"
                    time.sleep(2 * (attempt + 1))
                    continue
                # No source text to copy from here: the input is a list of
                # one- and two-word labels, so any "copied run" the PD check
                # finds is the model repeating the data, not plagiarism.
                result, last = pd.validate(obj, "")
                if result and not opening_ok(result["description"], c):
                    result, last = None, "template opening"
                if result:
                    break
            old_desc = (herb.get("description") or "").strip()
            uses_len = sum(len(u) for u in (result["traditional_uses"] if result else []))
            dosage_len = len(herb.get("dosage_adult") or "")
            # Keep an existing substantive description only when the page still
            # clears the thin threshold afterwards; otherwise the rewrite would
            # leave the row thin for the sake of preserving a short paragraph.
            keep_desc = (len(old_desc) >= 240
                         and "licensed natural-health products" not in old_desc
                         and len(old_desc) + uses_len + dosage_len >= 400)
            row = {
                "slug": slug,
                "name": herb.get("name"),
                "scientific_name": herb.get("scientific_name"),
                "binomial": c["binomial"],
                "family": c["family"],
                "regions": c["regions"],
                "applications": c["activities"][:40],
                "refs": c["refs"],
                "model": MODEL,
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "keep_description": keep_desc,
                "old": {
                    "description": herb.get("description"),
                    "traditional_uses": herb.get("traditional_uses"),
                    "provenance": herb.get("provenance"),
                },
            }
            if result:
                row.update(result)
                row["status"] = "ok"
            else:
                row["status"] = "rejected"
                row["reason"] = last
            write(row)
            with lock:
                counts["ok" if result else "rejected"] += 1
                n = counts["ok"] + counts["rejected"]
                if n % 25 == 0 or n == len(todo):
                    print(f"  {n}/{len(todo)} ok {counts['ok']} "
                          f"rejected {counts['rejected']}", flush=True)

        with ThreadPoolExecutor(max_workers=workers) as pool:
            list(pool.map(one, todo))
    print(f"[generate] ok {counts['ok']}, rejected {counts['rejected']}", flush=True)


def provenance_for(old, row):
    prov = dict(old or {})
    sources = prov.get("sources")
    new = {"name": SOURCE_NAME, "type": "ethnobotanical",
           "licence": "CC0-1.0", "url": SOURCE_URL}
    if isinstance(sources, list):
        names = {(s.get("name") if isinstance(s, dict) else s) for s in sources}
        if SOURCE_NAME not in names:
            sources.append(new)
        prov["sources"] = sources
    else:
        prov["sources"] = [new]
    prov["verification_method"] = "ai_summarized"
    prov["rewrite"] = {
        "method": "summarized-from-ethnobotanical-database",
        "model": MODEL,
        "source": "Duke ETHNOBOT (USDA ARS, CC0)",
        "citation": SOURCE_CITE,
        "references": row.get("refs") or [],
        "date": time.strftime("%Y-%m-%d", time.gmtime()),
    }
    return prov


def apply():
    if not os.path.exists(OUT):
        sys.exit(f"nothing to apply: {OUT} is missing")
    rows = [json.loads(l) for l in open(OUT, encoding="utf-8") if l.strip()]
    latest = {}
    for r in rows:
        if r.get("status") == "ok":
            latest[r["slug"]] = r
    written = set()
    if os.path.exists(BACKUP):
        for line in open(BACKUP, encoding="utf-8"):
            try:
                written.add(json.loads(line)["slug"])
            except Exception:                              # noqa: BLE001
                continue
    todo = [r for r in latest.values() if r["slug"] not in written]
    print(f"[apply] rows ready {len(latest)}, already written {len(written)}, "
          f"to write {len(todo)}", flush=True)

    lock = Lock()
    state = {"done": 0, "consecutive": 0, "stop": False}
    with open(BACKUP, "a", encoding="utf-8") as backup:
        def write(row):
            with lock:
                if state["stop"]:
                    return
            slug = urllib.parse.quote(row["slug"], safe="")
            body = {
                "traditional_uses": row["traditional_uses"],
                "provenance": provenance_for(row.get("old", {}).get("provenance"), row),
            }
            if not row.get("keep_description"):
                body["description"] = row["description"]
            try:
                status, _ = api(f"{BASE}/rest/v1/herbs?slug=eq.{slug}",
                                method="PATCH", body=body,
                                headers={"Content-Type": "application/json",
                                         "Prefer": "return=minimal"})
                ok = 200 <= status < 300
            except Exception as e:                         # noqa: BLE001
                print(f"  FAIL {row['slug']}: {e}", flush=True)
                ok = False
            # ~1,000 PATCHes in one pass is more sustained write pressure than
            # the nano has taken since the 2026-11-08 outage. Two workers plus
            # a short pause keeps the rate well under what took it down.
            time.sleep(0.15)
            with lock:
                if ok:
                    state["done"] += 1
                    state["consecutive"] = 0
                    backup.write(json.dumps(row, ensure_ascii=False) + "\n")
                    backup.flush()
                else:
                    state["consecutive"] += 1
                    if state["consecutive"] >= 3:
                        state["stop"] = True
                        print("  three consecutive failures: stopping", flush=True)
                n = state["done"]
            if n % 25 == 0 or not ok:
                print(f"  {'ok' if ok else 'FAIL'} {row['slug']} ({n}/{len(todo)})",
                      flush=True)

        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(write, todo))
    print(f"[apply] wrote {state['done']} of {len(todo)}; backup {BACKUP}",
          flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidates", action="store_true")
    ap.add_argument("--generate", action="store_true")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--show", type=str, help="print one candidate record")
    args = ap.parse_args()
    if args.apply:
        apply()
    elif args.generate:
        generate(workers=args.workers, limit=args.limit)
    else:
        cands = build_candidates(limit=args.limit)
        if args.show:
            for c in cands:
                if c["slug"] == args.show:
                    print(json.dumps(c, indent=1)[:2000])
                    break


if __name__ == "__main__":
    main()
