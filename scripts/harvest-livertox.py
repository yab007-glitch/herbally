#!/usr/bin/env python3
"""Import LiverTox herbals/dietary-supplement chapters as sourced safety notes.

LiverTox is published by NIDDK (NIH) on the NCBI Bookshelf. The bulk archive at
https://ftp.ncbi.nlm.nih.gov/pub/litarch/29/31/livertox_NBK547852.tar.gz carries
one BITS/JATS XML file per chapter. The XML has no license or copyright
statement, which under the archive's own terms means the document is in the
public domain and may be reproduced with attribution.

This is the safety/hepatotoxicity layer the library was missing: the NCCIH pages
cover uses and general safety, LiverTox covers whether the herb can injure the
liver and how likely that is (its A-E likelihood score).

The chapter list is the "Herbal and Dietary Supplements" index page:
https://www.ncbi.nlm.nih.gov/books/n/livertox/HerbalDietarySuppl/

Usage:
  python3 scripts/harvest-livertox.py --dry-run
  python3 scripts/harvest-livertox.py --apply

The XML directory defaults to /tmp/livertox_bulk/nxml/livertox_NBK547852. To
rebuild it, download the tarball above and extract the chapters named in
/tmp/livertox_bulk/hds-chapters.json (the scraper is deliberately not included:
the FTP archive is the supported route and needs no browser).
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XML_DIR = "/tmp/livertox_bulk/nxml/livertox_NBK547852"
CHAPTERS = "/tmp/livertox_bulk/hds-chapters.json"
OUT = os.path.join(ROOT, "artifacts", "livertox-extracts.json")
APPLY = "--apply" in sys.argv
DRY = not APPLY

# URL slug -> nxml id when the archive shortens the name.
FILE_OVERRIDES = {"Dragonsblood": "Dragonsbld"}

# Chapter name -> herb slug, only where the name alone is ambiguous.
OVERRIDES = {
    "ma huang": "ephedra",
    "lingzhi reishi": "reishi",
    "pennyroyal oil": "lamiaceae-pennyroyal",
    "margosa oil": "neem",
    "cat s claw": "cats-claw",
    "lion s mane": "lions-mane",
    "eugenol clove oil": "clove",
    "bitter melon": "bitter-melon-metabolic",
    "buchu": "buchu-betulina-leaf",
    "cascara": "frangula-purshiana",
    "guarana": "guarana-seed",
    "horsetail": "horsetail-equisetum",
    "mistletoe": "european-mistletoe",
    "senna": "senna-leaf",
    "tinospora": "guduchi",
}

# Chapters about a branded product or a mixture, not one herb page.
SKIP = {
    "herbalife", "hydroxycut", "move free", "oxyelite pro", "slimquick",
    "chinese and other asian herbal medicines",
    "sho saiko to and dai saiko to",
    "bee products",
    "beeprod",
    # Bromelain is an enzyme extract, not pineapple leaf; attaching its
    # hepatotoxicity chapter to the leaf page would merge different parts.
    "bromelain",
}


def load_env():
    env = {}
    for line in open(os.path.join(ROOT, ".env.local")):
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m:
            env[m.group(1)] = m.group(2).strip("\"'")
    return env


def text(el):
    return " ".join("".join(el.itertext()).split())


def title_of(el):
    t = el.find("title")
    return text(t) if t is not None else ""


def parse_chapter(path):
    root = ET.parse(path).getroot()
    meta_title = root.find(".//book-part-meta//title-group/title")
    name = text(meta_title) if meta_title is not None else title_of(root)
    body = root.find(".//body")
    sections = {}
    if body is not None:
        for sec in body.findall("sec"):
            key = title_of(sec).lower()
            if key == "overview":
                for sub in sec.findall("sec"):
                    sections[title_of(sub).lower()] = [text(p) for p in sub.findall("p")]
            elif key:
                sections[key] = [text(p) for p in sec.findall("p")]
    hep = sections.get("hepatotoxicity", [])
    likelihood = None
    likelihood_text = None
    narrative = []
    other_names = []
    drug_class = None
    for p in hep:
        m = re.match(r"Likelihood score:\s*([A-E])\b(.*)", p)
        if m:
            likelihood = m.group(1)
            likelihood_text = p
        elif re.match(r"(Other Names?|Drug Class):", p):
            if p.lower().startswith("other name"):
                other_names = [
                    s.strip() for s in p.split(":", 1)[1].split(",") if s.strip()
                ]
            else:
                drug_class = p.split(":", 1)[1].strip()
        else:
            narrative.append(p)
    outcome = []
    for p in sections.get("outcome and management", []):
        if re.match(r"(Other Names?|Drug Class):", p):
            if p.lower().startswith("other name") and not other_names:
                other_names = [s.strip() for s in p.split(":", 1)[1].split(",") if s.strip()]
            elif p.lower().startswith("drug class") and not drug_class:
                drug_class = p.split(":", 1)[1].strip()
            continue
        outcome.append(p)
    return {
        "name": name,
        "likelihood": likelihood,
        "likelihood_text": likelihood_text,
        "hepatotoxicity": narrative,
        "outcome": outcome,
        "other_names": other_names,
        "drug_class": drug_class,
        "sections": {
            k: v
            for k, v in sections.items()
            if k in ("introduction", "background", "hepatotoxicity", "mechanism of injury", "outcome and management")
        },
    }


def norm(s):
    s = s.lower().replace("’", "'").replace("–", "-")
    s = re.sub(r"\[[^\]]*\]", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


def fetch_herbs(base, key):
    herbs = []
    for off in range(0, 8000, 1000):
        url = (
            f"{base}/rest/v1/herbs?select=id,slug,name,scientific_name,"
            f"common_names,is_published,traditional_uses,dosage_adult,image_url"
            f"&limit=1000&offset={off}"
        )
        req = urllib.request.Request(
            url, headers={"apikey": key, "Authorization": f"Bearer {key}"}
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            page = json.load(r)
        herbs += page
        if len(page) < 1000:
            break
    return herbs


def main():
    env = load_env()
    base = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    H = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    if os.path.exists(CHAPTERS):
        chapters = json.load(open(CHAPTERS))
    else:
        chapters = [[f[:-5], f[:-5]] for f in os.listdir(XML_DIR) if f.endswith(".nxml")]
    print(f"[livertox] {len(chapters)} HDS chapters")

    records = []
    for slug, label in chapters:
        fn = FILE_OVERRIDES.get(slug, slug) + ".nxml"
        path = os.path.join(XML_DIR, fn)
        if not os.path.exists(path):
            print(f"  ! missing xml for {slug} ({label})")
            continue
        rec = parse_chapter(path)
        rec["chapter"] = slug
        rec["url"] = f"https://www.ncbi.nlm.nih.gov/books/n/livertox/{slug}/"
        rec["label"] = label
        if not rec["name"]:
            rec["name"] = label
        records.append(rec)
    print(f"[livertox] parsed {len(records)} chapters")

    herbs = fetch_herbs(base, key)
    print(f"[livertox] {len(herbs)} herbs in library")

    def score(h):
        return (
            (2 if h.get("is_published") else 0)
            + (2 if h.get("traditional_uses") else 0)
            + (2 if str(h.get("dosage_adult") or "").strip() else 0)
            + (1 if h.get("image_url") else 0)
            - len(h["slug"]) / 200
        )

    by_name = {}
    by_slug = {h["slug"]: h for h in herbs}
    for h in herbs:
        sci = str(h.get("scientific_name") or "")
        keys = [
            h.get("name"),
            *(h.get("common_names") or []),
            sci,
            " ".join(sci.split()[:2]) if sci else None,
        ]
        for k in keys:
            if not k:
                continue
            n = norm(k)
            if n and (n not in by_name or score(h) > score(by_name[n])):
                by_name[n] = h

    mapped = []
    unmatched = []
    skipped = []
    for rec in records:
        base_name = norm(rec["name"])
        if base_name in SKIP or rec["chapter"] in SKIP:
            skipped.append((rec["name"], "branded product / mixture"))
            continue
        cand = None
        if base_name in OVERRIDES and OVERRIDES[base_name] in by_slug:
            cand = by_slug[OVERRIDES[base_name]]
        if not cand:
            cand = by_name.get(base_name)
        if not cand:
            for alt in rec["other_names"]:
                cand = by_name.get(norm(alt))
                if cand:
                    break
        if not cand:
            cand = by_slug.get(norm(rec["name"]).replace(" ", "-"))
        if not cand:
            unmatched.append((rec["name"], rec["chapter"]))
            continue
        rec["herb_slug"] = cand["slug"]
        mapped.append(rec)

    print(f"[livertox] mapped {len(mapped)}, unmatched {len(unmatched)}, skipped {len(skipped)}")
    for name, slug in unmatched:
        print(f"  ? {name} ({slug})")
    json.dump(
        {"records": records, "mapped": [r["herb_slug"] for r in mapped]},
        open(OUT, "w"),
        indent=1,
        ensure_ascii=False,
    )
    print(f"[livertox] wrote {OUT}")

    if DRY:
        for r in mapped[:5]:
            print(f"  - {r['name']} -> {r['herb_slug']} (score {r['likelihood'] or 'n/a'})")
        return

    for r in mapped:
        safety = []
        if r["likelihood_text"]:
            safety.append(r["likelihood_text"])
        safety += r["hepatotoxicity"]
        safety += r["outcome"]
        row = {
            "herb_slug": r["herb_slug"],
            "source": "LiverTox",
            "licence": "us-federal-public-domain",
            "attribution": (
                "LiverTox, National Institute of Diabetes and Digestive and Kidney "
                "Diseases (NIDDK). The source document carries no copyright statement; "
                "US government work, reproduced with attribution."
            ),
            "url": r["url"],
            "claims": [],
            "safety": safety,
            "doses": [],
            "generation_method": "imported-public-domain",
            "monograph_date": None,
            "retrieved_at": date.today().isoformat(),
        }
        req = urllib.request.Request(
            f"{base}/rest/v1/herb_monograph_sources?on_conflict=herb_slug,source",
            data=json.dumps(row).encode(),
            headers={**H, "Prefer": "resolution=merge-duplicates,return=minimal"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                ok = resp.status in (200, 201, 204)
        except Exception as exc:
            print(f"  x {r['herb_slug']}: {exc}")
            continue
        if ok:
            print(f"  + {r['herb_slug']} ({r['likelihood'] or '-'})")
        # One writer: the Nano does not need a burst of 125 upserts.
        time.sleep(0.15)
    print("[livertox] done")


if __name__ == "__main__":
    main()
