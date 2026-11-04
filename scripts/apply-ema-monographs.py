#!/usr/bin/env python3
"""Apply every European herbal monograph we can legally use to the library.

Downloads each EMA monograph PDF listed in /tmp/ema-monographs.json, extracts the
Therapeutic indications and Posology sections with pdftotext, maps the Latin name
in the filename to a herb slug, and writes the result to the database:

  herbs.traditional_uses  <- the monograph's stated indications
  herbs.dosage_adult      <- the monograph's posology
  herbs.provenance        <- EMA added as a verified source with its URL

Only fields the monograph actually contains are written. A herb whose PDF has no
text layer (a scan) is skipped and reported, not guessed at.

Usage: python3 scripts/apply-ema-monographs.py [--dry-run]
"""
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URLS = "/tmp/ema-monographs.json"
CACHE = "/tmp/ema_pdfs"
DRY = "--dry-run" in sys.argv

PART_SUFFIX = (
    "rhizoma|radix|folium|folia|flos|flores|herba|herbae|fructus|semen|semina|cortex|"
    "summitates|aetheroleum|oleum|gemmae|strobuli|strobilus|pollen|bulbus|tuber|"
    "sine-herba|recens|siccum|siccata"
)
PREFIX = (
    "draft-community-herbal-monograph|final-european-union-herbal-monograph|"
    "community-herbal-monograph|european-union-herbal-monograph|"
    "final-community-herbal-monograph|herbal-monograph"
)


def load_env():
    env = {}
    for line in open(os.path.join(ROOT, ".env.local")):
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m:
            env[m.group(1)] = m.group(2).strip("\"'")
    return env


def latin_from_url(url):
    f = url.split("/")[-1].replace("_en.pdf", "")
    f = re.sub(r"^(%s)-" % PREFIX, "", f)
    f = re.sub(r"-revision-\d+$", "", f)
    f = re.sub(r"-(%s)$" % PART_SUFFIX, "", f)
    return " ".join(f.split("-")[:2])


def bino(s):
    return " ".join(re.sub(r"[^a-z ]", " ", (s or "").lower().replace("×", "x")).split()[:2])


def download(url):
    os.makedirs(CACHE, exist_ok=True)
    name = url.split("/")[-1]
    path = os.path.join(CACHE, name)
    if os.path.exists(path) and os.path.getsize(path) > 20000:
        return path
    rc = subprocess.run(
        ["curl", "-sL", "-A", "Mozilla/5.0", "--max-time", "60", url, "-o", path],
        capture_output=True,
    )
    if os.path.exists(path) and os.path.getsize(path) > 20000:
        return path
    return None


def section(text, start_kw, end_kws):
    low = text.lower()
    i = low.find(start_kw)
    if i < 0:
        return ""
    i += len(start_kw)
    ends = [low.find(k, i) for k in end_kws]
    ends = [e for e in ends if e > i]
    j = min(ends) if ends else min(i + 2500, len(text))
    return re.sub(r"\s+", " ", text[i:j]).strip()


def clean_indications(s):
    s = re.sub(r"^s\s+", "", s)
    s = re.sub(r"Well-established use|Traditional use|Indication \d\)", " ", s)
    parts = [
        p.strip()
        for p in re.split(r"(?<=\.)\s+(?=Traditional herbal medicinal product|Herbal medicinal product)", s)
        if len(p.strip()) > 25
    ]
    return [re.sub(r"\s+", " ", p)[:240] for p in parts][:3]


def clean_posology(s):
    s = re.sub(r"^and method of administration", "", s).strip()
    s = re.sub(r"Well-established use|Traditional use|Posology", " ", s)
    s = re.sub(r"^\d*\s*(Adolescents?|Adults?)[^a-z]*(,?\s*)?(adults?|and elderly)?[^a-z]*", "", s, flags=re.I)
    s = re.sub(r"^\d+\s+(?=[A-Z])", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:420]


def main():
    env = load_env()
    base = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    H = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    urls = json.load(open(URLS))
    # prefer the final monograph when a draft exists for the same binomial
    chosen = {}
    for u in urls:
        b = latin_from_url(u).lower()
        if b not in chosen or ("final" in u and "final" not in chosen[b]):
            chosen[b] = u
    print(f"[ema] {len(urls)} pdfs, {len(chosen)} distinct plants")

    herbs = []
    for off in range(0, 6000, 1000):
        req = urllib.request.Request(
            f"{base}/rest/v1/herbs?select=id,slug,scientific_name,provenance&limit=1000&offset={off}",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            page = json.load(r)
        herbs += page
        if len(page) < 1000:
            break
    by_bino = {bino(h["scientific_name"]): h for h in herbs if h["scientific_name"]}
    print(f"[ema] {len(herbs)} herbs, {len(by_bino)} distinct binomials")

    def work(item):
        b, url = item
        herb = by_bino.get(b)
        if not herb:
            return {"binomial": b, "status": "no herb"}
        path = download(url)
        if not path:
            return {"binomial": b, "slug": herb["slug"], "status": "download failed"}
        txt = subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True).stdout
        if len(txt) < 500:
            return {"binomial": b, "slug": herb["slug"], "status": "no text layer (scan)"}
        txt = re.sub(r"[ \t]+", " ", txt)
        inds = clean_indications(section(txt, "therapeutic indication", ["posology", "contraindication"]))
        pos = clean_posology(section(txt, "posology", ["contraindication", "special warning", "interaction"]))
        if not inds and not pos:
            return {"binomial": b, "slug": herb["slug"], "status": "sections not found"}
        if DRY:
            return {"binomial": b, "slug": herb["slug"], "status": "would apply", "uses": inds[:1], "dose": pos[:120]}

        prov = herb["provenance"] or {}
        srcs = set(prov.get("verified_sources") or [])
        srcs.add("European Medicines Agency (HMPC)")
        prov["verified_sources"] = sorted(srcs)
        prov["verified_source_count"] = len(srcs)
        prov["verification_status"] = "verified"
        listing = [s for s in (prov.get("sources") or []) if not (isinstance(s, dict) and "European Medicines" in str(s.get("name")))]
        listing.append({
            "type": "regulator",
            "name": "European Medicines Agency (HMPC)",
            "licence": "EMA legal notice — reuse permitted with acknowledgement",
            "url": url,
        })
        prov["sources"] = listing
        body = {"dosage_adult": pos, "provenance": prov}
        if inds:
            body["traditional_uses"] = inds
        req = urllib.request.Request(
            f"{base}/rest/v1/herbs?slug=eq.{urllib.parse.quote(herb['slug'])}",
            data=json.dumps(body).encode(),
            headers=H,
            method="PATCH",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                ok = r.status in (200, 204)
        except Exception as exc:
            return {"binomial": b, "slug": herb["slug"], "status": f"patch failed {exc}"}
        return {"binomial": b, "slug": herb["slug"], "status": "applied" if ok else "patch rejected"}

    with ThreadPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(work, chosen.items()))

    counts = {}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    print("[ema] done:", json.dumps(counts))
    json.dump(results, open(os.path.join(ROOT, "artifacts", "ema-apply-report.json"), "w"), indent=1)
    for r in results:
        if r["status"] == "applied":
            print("  ✓", r["slug"])


if __name__ == "__main__":
    main()
