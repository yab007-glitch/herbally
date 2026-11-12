#!/usr/bin/env python3
"""Import pre-1930 herbal materia medica into herb_monograph_sources.

Every text used here was published before 1930, so it is in the public domain in
the United States; the authors died more than seventy years ago, so it is also
public domain in Canada. Nothing is paraphrased: each entry is cut from the book
and reproduced with its source, edition and year.

Two rules govern what gets cut out.

  * Posology is never imported. These books dose aconite in grains and recommend
    strychnine for stomach complaints; a 1918 dose is not advice anyone should
    follow in 2026. Any sentence carrying a dose or an apothecary measure is
    dropped, and every entry is cut at the book's own "Dose" heading.
  * Only real entries are imported. A plant's name appears inside other plants'
    monographs and in the index, so an entry has to be a unit of the book (its
    own heading, its own body) before its name counts.

Plant names are the other half of the job. These books use the taxonomy of their
day (Leontodon taraxacum, Anthemis nobilis) while the library uses current names
(Taraxacum officinale, Chamaemelum nobile). GBIF's backbone maps the first to the
second; every lookup is cached so a re-run costs nothing.

Usage:
  python3 scripts/harvest-pd-herbals.py --book=usdisp1918 --dry-run
  python3 scripts/harvest-pd-herbals.py --book=usdisp1918 --apply
  python3 scripts/harvest-pd-herbals.py --book=fernie1897  --dry-run
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "artifacts", "gbif-name-cache.json")
PREVIEW = os.path.join(ROOT, "artifacts", "pd-herbals-preview.json")

BOOKS = {
    "usdisp1918": {
        "path": "/tmp/pd-sources/usdisp1918.txt",
        "source": "US Dispensatory 1918",
        "url": "https://archive.org/details/dispensatoryofun0000unse",
        "date": "1918-01-01",
        "attribution": (
            "The United States Dispensatory, 20th edition, by Joseph P. Remington "
            "and Horatio C. Wood (J. B. Lippincott, 1918). Public domain."
        ),
        "generation_method": "imported-public-domain-ocr",
    },
    "fernie1897": {
        "path": "/tmp/pd-sources/fernie1897.txt",
        "source": "Fernie's Herbal Simples 1897",
        "url": "https://www.gutenberg.org/ebooks/19352",
        "date": "1897-01-01",
        "attribution": (
            "Herbal Simples Approved for Modern Uses of Cure, by William Thomas "
            "Fernie (1897). Public domain; text from Project Gutenberg."
        ),
        "generation_method": "imported-public-domain-text",
    },
}

# Sentences that carry a dose, an apothecary measure or a preparation method are
# dropped wholesale. The vault note of 2026-11-11 sets this rule; the reason is
# that aconite and nux vomica appear throughout these books.
DOSEY = re.compile(
    r"\b(dose[ds]?|grain|grains|drachm|drachms|minim|minims|fluidounce|fluidounces|"
    r"teaspoon|teaspoons|tablespoon|tablespoons|gramme|grammes|grm?\.|"
    r"fluidrachm|scruple|scruples|ounce|ounces|quart|quarts|gallon|gallons)\b",
    re.I,
)

# A sentence starts with a real word or a quotation, so "U. S." and "Br." do not
# end one. Splitting there cut citations in half and left fragments like "S. "
# at the front of the next paragraph, which then survived as a sentence of its own.
SENTENCE = re.compile(r'(?<=[.!?])\s+(?=[A-Z][a-z]|["“])')

# Words that can stand in front of a plant's name without naming a different
# plant. Fernie's digressions open with a modifier instead: "The Hemp Agrimony",
# "The Black Bryony". Anything else in that slot is another species.
NOT_A_NAME = {
    "the", "a", "an", "this", "that", "these", "those", "its", "his", "her",
    "their", "our", "my", "your", "of", "for", "and", "or", "but", "if", "as",
    "in", "on", "at", "to", "by", "with", "from", "it", "they", "he", "she",
    "we", "you", "when", "where", "which", "who", "what", "so", "then", "thus",
}

# Macroscopic descriptions of the drug as sold are kept; they are the part of a
# dispensatory that still reads as fact.
SECTION_KEEP = {
    "properties", "description", "constituents", "composition", "chemical composition",
    "chemical properties", "uses", "action and uses", "actions and uses",
    "medicinal uses", "medicinal properties and uses", "therapeutic uses",
    "history", "commercial history", "incompatibles", "varieties", "poisoning",
    "toxicology", "toxicological properties",
}
SECTION_STOP = re.compile(r"^(Dose|Off[.,] Prep|Preparation)\b", re.I)

HEAD_DISP = re.compile(
    r"^([A-Z][A-Z'’\-]+(?:\s+[A-Z][A-Z'’\-]+){0,4})\.\s*"
    r"((?:U\s*\.\s*S\.?|Br\.|N\s*\.\s*F\.|NN\s*\.\s*F\.|P\s*\.\s*I\.|Fr\.)[\s().,]*){0,3}$"
)
RUNNING_DISP = re.compile(r"^(PART\s+I+V?\.|PART\s+1[,.]?)$")
PAGEHEAD = re.compile(r"^[A-Z][A-Za-z'’\-]+\.\s*[—-]{1,2}\s*[A-Z][A-Za-z'’\-]+\.\s*\d{1,4}\s*$")
MARKER = re.compile(r"^([A-Z][A-Za-z ,'’\-]{1,45}?)\s*[.．]?\s*[—-]{1,2}\s*(.*)$")
# Drugs made from a plant are not the plant: tincture of aconite is not aconite.
PREP = re.compile(
    r"^(ACETUM|AQUA|CATAPLASMA|CERATUM|COLLODIUM|CONFECTIO|DECOCTUM|ELIXIR|EMPLASTRUM|"
    r"ENEMA|EXTRACTUM|FLUIDEXTRACTUM|GLYCERITUM|INFUSUM|INJECTIO|LINIMENTUM|LIQUOR|LOTIO|"
    r"MEL|MISTURA|MUCILAGO|OLEORESINA|OLEUM|PASTA|PIGMENTUM|PILULAE|PULVIS|SPIRITUS|"
    r"SUPPOSITORIUM|SYRUPUS|TINCTURA|TROCHISCI|UNGUENTUM|VINUM|VINEGAR|ALCOHOL)\b"
)

HEAD_FERNIE = re.compile(r"^([A-Z][A-Z'’ ,\-]{2,40})\.$")
SKIP_FERNIE = {
    "PREFACE TO THE FIRST EDITION", "PREFACE TO THE SECOND EDITION", "CONTENTS",
    "INDEX", "INTRODUCTION", "APPENDIX",
}

BINOM = re.compile(r"\b([A-Z][a-z]{2,})\s+([A-Za-z][a-z]{2,})\b")
LIGATURES = {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl"}
CURLY = {"“": '"', "”": '"', "‘": "'", "’": "'", "–": "-", "—": " - "}

TOTAL_CAP = 3600
SECTION_CAP = 1800


# --------------------------------------------------------------------------- text


def clean(block):
    """Undo the book's line wrapping and the OCR's punctuation."""
    text = "\n".join(block)
    text = re.sub(r"-\s*\n\s*", "", text)          # hyphenation across a line break
    text = re.sub(r"\s*\n\s*", " ", text)
    for a, b in LIGATURES.items():
        text = text.replace(a, b)
    for a, b in CURLY.items():
        text = text.replace(a, b)
    text = text.replace("@", "ae").replace("¢", "e")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([,.;:])", r"\1", text)
    # The scan reads the Pharmacopoeia's "U. S." as "U. 8.", "U. 9." or "JU. 8.".
    # The abbreviation recurs in the definition of nearly every drug.
    text = re.sub(r"\b(?:JU|U)\.\s*[89]S?\s*\.", "U. S.", text)
    # A stray space inside an opening quote: as " Bikh" or "Bish" aconite.
    text = re.sub(r'(?<![\w.,;:!?])"\s+(?=[A-Z])', '"', text)
    # A hyphen the OCR split in the middle of a line, not a real compound:
    # "hygro- scopic". Left alone where the next word is capitalised or a number,
    # because "7- to 12-veined" is a range and must keep its hyphen.
    text = re.sub(r"([a-z]{3,})-\s+([a-z]{3,})", r"\1\2", text)
    return text.strip()


def scrub(text):
    """Drop every sentence that carries a dose, and any that prescribe a preparation."""
    kept = []
    for sentence in SENTENCE.split(text):
        if DOSEY.search(sentence):
            continue
        if re.search(r"\b(should be given|may be given|is given in|administered in)\b", sentence, re.I):
            continue
        kept.append(sentence)
    return " ".join(kept).strip()


def trim(text, limit):
    """Cut at a sentence boundary so a paragraph never ends mid-clause."""
    if len(text) <= limit:
        return text
    cut = text.rfind(". ", 0, limit)
    return text[: cut + 1] if cut > limit * 0.6 else text[:limit].rsplit(" ", 1)[0] + "."


# "Aconiti Radix, Br.; Aconite Root, Monkshood ... Fr.; ... G.; ... Sp." — the
# list of foreign names that follows the definition. It is not prose, it spans
# several printed lines, and on a plant page it reads as line noise.
SYNONYM = re.compile(
    r"\b(Fr|G|Ger|It|Ital|Sp|Span|P|Br|Port|Dutch|Dan|Swed|Russ)\.(?:[^.;]{0,15})?[,;]"
)


def is_synonym_list(text):
    return len(SYNONYM.findall(text)) >= 2 and text.count(";") >= 2


def about_the_plant(text, stem, allowed, genus):
    """True when a paragraph is about the entry's own plant.

    Fernie digresses. His Agrimony entry runs on into Hemp Agrimony for two
    paragraphs, and the paragraph never uses a binomial, so a name check on
    Agrimonia misses it. What it does say is "The Hemp Agrimony", where the word
    in front of the plant name is another plant. `allowed` holds the words the
    entry's own title uses ("black" in "Black Bryony") plus ordinary function
    words, so only a modifier the title does not carry marks a different plant.
    """
    if genus and genus in text.lower():
        return True
    # A name at the start of a sentence or clause has nothing in front of it.
    if re.search(r"(?:^|[.;:!?]\s+)" + re.escape(stem) + r"\b", text, re.I):
        return True
    for m in re.finditer(r"\b(\w+)\s+" + re.escape(stem) + r"\b", text, re.I):
        if m.group(1).lower() in allowed:
            return True
    return False


# ------------------------------------------------------------------------ parsing


def dispensary_entries(path):
    lines = open(path, encoding="utf-8", errors="replace").read().split("\n")
    start = next(i for i, ln in enumerate(lines)
                 if re.match(r"^ACACIA\.\s*U\.\s*S\.", ln.strip()))
    heads = []
    for i, ln in enumerate(lines):
        if i < start:
            continue
        s = ln.strip()
        if RUNNING_DISP.match(s):
            continue
        m = HEAD_DISP.match(s)
        if m:
            heads.append((i, m.group(1)))
    entries = []
    for k, (i, title) in enumerate(heads):
        end = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
        if PREP.match(title):
            continue
        entries.append({"title": title, "line": i + 1, "block": lines[i + 1:end]})
    return entries


def drop_furniture(lines):
    """Remove the entry's own second title, its phonetic respelling and its synonym list.

    A page of this book opens with

        ACONITUM. U. S. (Br.)            <- the heading, already removed
        ACONITB Aconit. [Monkshood ...] <- the second title, mostly capitals
        (Ac-9-ni'tim )                  <- the pronunciation
        Aconiti Radix, Br.; Aconite Root, Monkshood, ... Fr.; ... G.; ... Sp.
        "The dried tuberous roots of Aconitum Napellus ..."

    None of the first three is prose, and the fourth is a list of foreign names
    that reads as noise on a page about the plant.
    """
    out = []
    lead = True
    for i, ln in enumerate(lines):
        s = ln.strip()
        if lead:
            if not s:
                continue
            letters = [c for c in s if c.isalpha()]
            upper = sum(1 for c in letters if c.isupper()) / max(1, len(letters))
            nxt = next((x.strip() for x in lines[i + 1:] if x.strip()), "")
            # "ANISE Anis. [Aniseed]" is not mostly capitals, but the line under
            # it is the pronunciation in parentheses, and nothing else in the
            # entry is. The pair is the second title and its respelling.
            if (upper > 0.6 or re.fullmatch(r"\([^)]*\)", s) or len(s) < 12
                    or (len(s) < 55 and re.fullmatch(r"\([^)]*\)", nxt))):
                continue
            if len(re.findall(r"\b(Fr|G|It|Sp|P|Br)\.\s*;", s)) >= 3:
                continue
            lead = False
        out.append(ln)
    return out


def dispensary_sections(entry):
    """Cut the entry at its own section markers and after its last useful section."""
    block = drop_furniture(entry["block"])
    stop = next((k for k, ln in enumerate(block) if SECTION_STOP.match(ln.strip())), len(block))
    block = block[:stop]
    groups, buf, current = [], [], None
    for ln in block:
        s = ln.strip()
        if (not s or PAGEHEAD.match(s) or RUNNING_DISP.match(s)
                or re.fullmatch(r"\d{1,4}", s)):
            if buf:
                groups.append((current, buf))
                buf = []
            continue
        m = MARKER.match(s)
        if m and m.group(1).lower() in SECTION_KEEP:
            if buf:
                groups.append((current, buf))
                buf = []
            current = m.group(1).lower()
            if m.group(2):
                buf.append(m.group(2))
            continue
        buf.append(s)
    if buf:
        groups.append((current, buf))
    return groups


def fernie_sections(entry):
    """Fernie has no section markers; his entries are continuous prose."""
    out, buf = [], []
    for ln in entry["block"]:
        s = ln.strip()
        if not s:
            if buf:
                out.append((None, buf))
                buf = []
            continue
        if re.match(r"^\s*\[\d+\]\s*$", s):        # page number on its own line
            continue
        buf.append(s)
    if buf:
        out.append((None, buf))
    return out


# ------------------------------------------------------------------------ resolve


def load_library():
    env = {}
    for line in open(os.path.join(ROOT, ".env.local")):
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m:
            env[m.group(1)] = m.group(2).strip("\"'")
    base, key = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
    cols = "slug,name,scientific_name,description,traditional_uses,dosage_adult"
    out, page = [], 1000
    for offset in range(0, 10000, page):
        url = (f"{base}/rest/v1/herbs?select={cols}&is_published=eq.true"
               f"&order=slug&limit={page}&offset={offset}")
        req = urllib.request.Request(url, headers={"apikey": key,
                                                   "Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=60) as r:
            rows = json.load(r)
        out.extend(rows)
        if len(rows) < page:
            break
    return out, base, key


def normalise_name(name):
    name = re.sub(r"\s*\(.*?\)\s*", " ", name)
    name = re.split(r"\s+(?:var\.|subsp\.|f\.)\s*", name)[0]
    return re.sub(r"\s+", " ", name).strip()


def substance(herb):
    uses = herb.get("traditional_uses") or []
    if isinstance(uses, str):
        uses = [uses]
    return (len(herb.get("description") or "")
            + sum(len(u or "") for u in uses if isinstance(u, str))
            + len(herb.get("dosage_adult") or ""))


# Flushing only at the end means an interrupted run throws away every lookup it
# made; a full pass is a few thousand HTTP requests, so that is real time lost.
_flushed = 0


def _flush(cache):
    global _flushed
    json.dump(cache, open(CACHE, "w"), indent=0)
    _flushed = len(cache)


def gbif_lookup(name, cache):
    if name in cache:
        return cache[name]
    url = ("https://api.gbif.org/v1/species/match?"
           + urllib.parse.urlencode({"name": name, "kingdom": "Plantae"}))
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            d = json.load(r)
    except (urllib.error.URLError, TimeoutError, OSError):
        return None
    cache[name] = {
        "status": d.get("status"),
        "match": d.get("matchType"),
        "confidence": d.get("confidence"),
        "accepted": d.get("species") or d.get("canonicalName"),
    }
    if len(cache) - _flushed >= 200:
        _flush(cache)
    return cache[name]


WORD_GENERA = {"rosa", "viola", "iris", "pinus", "salvia", "mentha", "lavandula",
               "cannabis", "papaver", "citrus", "coffea", "thea", "cinnamomum"}


def main():
    args = dict(a.split("=", 1) if "=" in a else (a, True) for a in sys.argv[1:])
    book = args.get("--book", "usdisp1918")
    dry = "--apply" not in args
    cfg = BOOKS[book]
    if not os.path.exists(cfg["path"]):
        sys.exit(f"text not found: {cfg['path']}")

    herbs, base, key = load_library()
    by_name = {}
    for h in herbs:
        sn = normalise_name(h["scientific_name"])
        if re.match(r"^[A-Z][a-z]+ [a-z]+$", sn):
            by_name.setdefault(sn.lower(), []).append(h)

    english = set()
    if os.path.exists("/usr/share/dict/words"):
        english = {w.strip().lower() for w in
                   open("/usr/share/dict/words", encoding="utf-8", errors="replace")}

    global _flushed
    cache = {}
    if os.path.exists(CACHE):
        cache = json.load(open(CACHE))
    _flushed = len(cache)
    before = len(cache)

    entries = dispensary_entries(cfg["path"]) if book == "usdisp1918" \
        else fernie_entries(cfg["path"])
    print(f"[{book}] entries parsed: {len(entries)}")

    rows, skipped = [], []
    claimed = set()

    def resolve(entry, sections):
        """First binomial in the entry that names a plant the library has."""
        if book == "fernie1897":
            # Fernie introduces the plant in his first paragraph. Searching the
            # whole entry lets a plant mentioned in passing win, and his volume
            # carries poetry chapters that name half a hedgerow.
            text = "\n".join(sections[0][1])[:900]
        else:
            text = "\n".join("\n".join(b) for _, b in sections)[:6000]
        seen = set()
        for m in BINOM.finditer(text):
            key_ = f"{m.group(1)} {m.group(2)}"
            low = key_.lower()
            if low in seen:
                continue
            seen.add(low)
            if low in by_name:
                return by_name[low], key_, "direct"
            genus = m.group(1).lower()
            if len(m.group(2)) < 3:
                continue
            if genus not in WORD_GENERA and genus in english:
                continue
            info = gbif_lookup(key_, cache)
            if not info or info.get("match") != "EXACT" or (info.get("confidence") or 0) < 95:
                continue
            accepted = (info.get("accepted") or "").lower()
            if accepted in by_name:
                return by_name[accepted], key_, f"synonym:{accepted}"
        return None, None, None

    for entry in entries:
        sections = (dispensary_sections(entry) if book == "usdisp1918"
                    else fernie_sections(entry))
        if not sections:
            continue
        rows_for, binomial, how = resolve(entry, sections)
        if not rows_for:
            skipped.append(entry["title"])
            continue

        # Fernie wanders: the Agrimony entry digresses into Hemp Agrimony and
        # Pulsatilla for three paragraphs. A paragraph that is about a different
        # plant reads as filler on a page about Agrimony.
        title = entry["title"].lower()
        stem = title.split()[-1]
        allowed = set(re.findall(r"[a-z']+", title)) | NOT_A_NAME
        genus = (binomial or "").split()[0].lower()

        claims, used = [], 0
        for index, (marker, block) in enumerate(sections):
            text = scrub(clean(block))
            if len(text) < 120:
                continue
            if is_synonym_list(text):
                continue
            # The scan's paragraphing is uneven, so a block can begin mid-sentence.
            # "roots are from 5 to 10 cm. long" opening a paragraph reads as damage.
            if text[0].islower():
                continue
            if book == "fernie1897" and index > 0:
                if not about_the_plant(text, stem, allowed, genus):
                    continue
            label = (marker or "Description").capitalize()
            claims.append({"section": label, "text": trim(text, SECTION_CAP)})
            used += len(claims[-1]["text"])
            if used >= TOTAL_CAP:
                break
        body = sum(len(c["text"]) for c in claims)
        if body < 700:
            skipped.append(entry["title"])
            continue

        # One page per plant. Two library rows can carry the same binomial —
        # barley-grass and mai-ya-digestive are both Hordeum vulgare — and the
        # identical 1897 entry on both pages is duplicate content, which is the
        # problem this import exists to fix. Among thin rows prefer the one with
        # the most of its own text, so the entry lands on the plant's main page.
        thin = [h for h in rows_for if substance(h) < 400]
        herb = max(thin or rows_for, key=lambda h: (substance(h), h["slug"]))
        if herb["slug"] in claimed:
            skipped.append(f"{entry['title']} (duplicate of {herb['slug']})")
            continue
        claimed.add(herb["slug"])
        rows.append({
            "herb_slug": herb["slug"],
            "herb_name": herb["name"],
            "source": cfg["source"],
            "licence": "public-domain",
            "attribution": cfg["attribution"],
            "url": cfg["url"],
            "claims": claims,
            "safety": [],
            "doses": [],
            "generation_method": cfg["generation_method"],
            "monograph_date": cfg["date"],
            "_book_entry": entry["title"],
            "_binomial": binomial,
            "_how": how,
            "_chars": body,
        })

    _flush(cache)
    print(f"[{book}] names resolved this run: {len(cache) - before} "
          f"(cache now {len(cache)})")
    print(f"[{book}] entries imported: {len(rows)}, skipped: {len(skipped)}")
    print(f"[{book}] herbs covered: {len({r['herb_slug'] for r in rows})}")

    os.makedirs(os.path.dirname(PREVIEW), exist_ok=True)
    preview = PREVIEW.replace(".json", f"-{book}.json")
    json.dump(rows, open(preview, "w"), indent=1)
    print(f"[{book}] preview written to {preview}")

    if dry:
        for r in rows[:12]:
            print(f"  {r['herb_slug']:<34} <- {r['_book_entry']:<22} "
                  f"{r['_binomial']:<28} {r['_chars']}c  {r['_how']}")
        print("\nDry run: nothing written to the database. Re-run with --apply.")
        return

    apply(rows, base, key)


def fernie_entries(path):
    lines = open(path, encoding="utf-8", errors="replace").read().split("\n")
    heads = [(i, m.group(1)) for i, ln in enumerate(lines)
             if (m := HEAD_FERNIE.match(ln.strip())) and m.group(1) not in SKIP_FERNIE]
    out = []
    for k, (i, title) in enumerate(heads):
        end = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
        out.append({"title": title, "line": i + 1, "block": lines[i + 1:end]})
    return out


def apply(rows, base, key):
    """Write two rows at a time and stop after three failures in a row.

    Six concurrent upserts took the Free-tier Nano down for hours on 2026-11-08;
    the limit is two writers and a circuit breaker, not a retry loop.
    """
    url = f"{base}/rest/v1/herb_monograph_sources"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    done = 0
    consecutive = 0

    def write(row):
        payload = {
            k: v for k, v in row.items()
            if not k.startswith("_") and k != "herb_name"
        }
        req = urllib.request.Request(
            url + "?on_conflict=herb_slug,source",
            data=json.dumps(payload).encode(),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(write, r) for r in rows]
        for f in futures:
            try:
                f.result()
                done += 1
                consecutive = 0
            except Exception as e:                     # noqa: BLE001
                consecutive += 1
                print(f"  write failed: {e}")
                if consecutive >= 3:
                    print("three consecutive failures: stopping before the database notices")
                    break
    print(f"[apply] rows written: {done} of {len(rows)}")


if __name__ == "__main__":
    main()
