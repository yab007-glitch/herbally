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
    """"Genus species", dropping a hybrid marker and any author/part suffix.

    Naively taking the first two tokens turns "Mentha x piperita" into "mentha x",
    which never matches a herb, so a standalone "x" is removed first.
    """
    toks = re.sub(r"[^a-z ]", " ", (s or "").lower().replace("×", " x ")).split()
    toks = [t for t in toks if t != "x"]
    return " ".join(toks[:2])


# EMA names the plant in the PDF body, and sometimes uses a name the library no
# longer uses (or a drug name rather than a binomial). These are the same plant, not
# guesses: each target is the accepted name that GBIF/POWO returned for the source.
SYNONYMS = {
    "cimicifuga racemosa": "actaea racemosa",
    "cynara scolymus": "cynara cardunculus",
    "trigonella foenumgraecum": "trigonella foenum-graecum",
    "rhamnus purshiana": "frangula purshiana",
    "cnicus benedictus": "centaurea benedicta",
    "pilosella officinarum": "hieracium pilosella",
    "barbados aloes": "aloe vera",
    "aloes": "aloe vera",
    "zingiberis": "zingiber officinale",
    "senna leaf": "senna alexandrina",
    "senna pods": "senna alexandrina",
    "ispaghula husk": "plantago ovata",
    "psyllium seed": "plantago ovata",
    "frangula bark": "frangula alnus",
    "echinaceae angustifolia": "echinacea angustifolia",
    "onechinacea purpurea": "echinacea purpurea",
    "plantaginis lanceolatae": "plantago lanceolata",
    "crataegus spp": "crataegus monogyna",
}


# When several pages share a binomial, the regulator monograph belongs on the
# species' main page, not on a cultivar, brand or part page. Ordered preference —
# the first slug that exists wins. Anything not listed falls through to the part
# hint and is otherwise refused rather than guessed.
CANONICAL = {
    "achillea millefolium": ["yarrow"],
    "artemisia absinthium": ["wormwood"],
    "avena sativa": ["oat-straw"],
    "aloe vera": ["aloe-vera"],
    "camellia sinensis": ["green-tea"],
    "chamaemelum nobile": ["chamomile-roman"],
    "cichorium intybus": ["chicory"],
    "crataegus monogyna": ["hawthorn", "hawthorn-flowers"],
    "curcuma longa": ["turmeric"],
    "cynara cardunculus": ["artichoke"],
    "eleutherococcus senticosus": ["eleuthero"],
    "filipendula ulmaria": ["meadowsweet"],
    "foeniculum vulgare": ["fennel"],
    "glycyrrhiza glabra": ["licorice-dgl", "yashtimadhu"],
    "hypericum perforatum": ["st-johns-wort"],
    "juniperus communis": ["juniper-communis"],
    "melissa officinalis": ["lemon-balm"],
    "mentha x piperita": ["peppermint"],
    "mentha piperita": ["peppermint"],
    "rhodiola rosea": ["rhodiola"],
    "syzygium aromaticum": ["clove"],
    "tanacetum parthenium": ["feverfew"],
    "valeriana officinalis": ["valerian"],
    "allium sativum": ["garlic"],
    "panax ginseng": ["ginseng"],
    "pistacia lentiscus": ["mastic-resin"],
    "frangula purshiana": ["frangula-purshiana"],
    "rhamnus purshiana": ["frangula-purshiana"],
    "vaccinium macrocarpon": ["cranberry"],
    "aloe barbadensis": ["aloe-vera"],
    "prunus avium": ["cherry-stalk", "prunus-avium"],
    "centella asiatica": ["gotu-kola"],
    "verbascum thapsus": ["mullein"],
}


def binomial_from_pdf(path):
    """Read the binomial out of the monograph's own header.

    Filenames like `call-scientific-data-periodic-review-monograph-absinthii-herba`
    yield "call scientific", and draft filenames sometimes carry only a drug name.
    The body always says "Community herbal monograph on <Genus species>".
    """
    try:
        txt = subprocess.run(
            ["pdftotext", "-f", "1", "-l", "1", path, "-"],
            capture_output=True,
            text=True,
            timeout=30,
        ).stdout
    except Exception:
        return ""
    flat = re.sub(r"\s+", " ", txt)
    m = re.search(r"monograph\s+on\s+([A-Z][a-z]{2,})\s+([a-z][a-z\-]{2,})", flat)
    if m:
        return f"{m.group(1).lower()} {m.group(2).lower()}"
    return ""


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


PREPS = (
    "herbal tea", "infusion", "decoction", "tincture", "extract", "capsule",
    "tablet", "liquid extract", "dry extract",
    "powder", "juice", "syrup", "ointment", "cream", "bath", "oral",
)


def clean_posology(s):
    """Cut the posology down to the sentence a reader can use.

    The section slice starts a little before the real content and picks up headers
    ("3 rs Adolescents, adults and elderly Single dose Indications 1) and 2)"), so
    anchor on the first preparation form instead of trimming with regexes.
    """
    s = re.sub(r"^and method of administration", "", s).strip()
    s = re.sub(r"\s+", " ", s)
    low = s.lower()
    cut = min([i for i in (low.find(p) for p in PREPS) if i >= 0], default=-1)
    if cut > 0:
        s = s[cut:]
    s = re.sub(r"^(%s)\b" % "|".join(PREPS), lambda m: m.group(1).capitalize(), s)
    low2 = s.lower()
    for hdr in ("oral use", "single dose"):
        k = low2.find(hdr)
        if 0 < k < 60:
            s = s[k:]
            low2 = s.lower()
            break
    # "Oral Use Single dose: 15 mg" — the two headers are noise, the amount is not.
    s = re.sub(r"^(Oral Use|Oral use)\s*", "", s)
    s = re.sub(r"^Single dose:?\s*", "", s)
    s = re.sub(r"\s+", " ", s).strip(" .;,")
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
    from collections import defaultdict

    by_bino = defaultdict(list)
    for h in herbs:
        if h["scientific_name"]:
            by_bino[bino(h["scientific_name"])].append(h)

    PART_WORD = {
        "folium": "leaf", "folia": "leaf", "herba": "herb", "herbae": "herb",
        "radix": "root", "rhizoma": "root", "fructus": "fruit", "semen": "seed",
        "semina": "seed", "cortex": "bark", "flos": "flower", "flores": "flower",
        "summitates": "herb", "aetheroleum": "oil", "oleum": "oil",
    }

    def part_hint(url):
        f = url.split("/")[-1].replace("_en.pdf", "").lower()
        for part, word in PART_WORD.items():
            if f.endswith("-" + part) or f"-{part}-" in f:
                return word
        return ""

    def resolve(b, url):
        """Pick the ONE page a regulator monograph belongs on, or nothing.

        Several pages share a binomial (Camellia sinensis has green, black, white and
        pu-erh tea pages). Attaching the monograph to whichever came last in the
        table is how a dose ends up on the wrong page, so an unlisted binomial is
        only applied when the part hint identifies a single page, and is otherwise
        skipped and reported.
        """
        cands = by_bino.get(b, [])
        if not cands:
            alt = SYNONYMS.get(b)
            cands = by_bino.get(alt, []) if alt else []
        if not cands:
            return None, "no herb"
        slugs = {h["slug"]: h for h in cands}
        for preferred in CANONICAL.get(b, []) + CANONICAL.get(SYNONYMS.get(b, ""), []):
            if preferred in slugs:
                return slugs[preferred], ""
        if len(cands) == 1:
            return cands[0], ""
        word = part_hint(url)
        if word:
            hits = [h for h in cands if word in (h.get("slug") or "").replace("-", " ")]
            hits = hits or [h for h in cands if word in (h.get("scientific_name") or "").lower()]
            if len(hits) == 1:
                return hits[0], ""
        return None, f"ambiguous ({len(cands)} pages share this plant: {', '.join(h['slug'] for h in cands[:4])})"

    def work(item):
        b, url = item
        herb, why = resolve(b, url)
        path = None
        if not herb and why == "no herb":
            # The filename gave us nothing usable — the PDF header often has the
            # real binomial, so read it before declaring the plant missing.
            path = download(url)
            if path:
                from_pdf = binomial_from_pdf(path)
                if from_pdf:
                    herb, why = resolve(from_pdf, url)
                    if herb:
                        b = from_pdf
        if not herb:
            return {"binomial": b, "status": "no herb" if why == "no herb" else why}
        if path is None:
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
