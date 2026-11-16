#!/usr/bin/env python3
"""Rewrite thin HerbAlly pages from public-domain herbals.

For every thin herb that has a real entry in one of the pre-1930 texts, this
script asks the configured Ollama Cloud model for an original description and a
short list of traditional uses, grounded only in that entry. It never copies a
run of source words, never imports a dose, and records the source in
`provenance`.

The copyrighted books in ~/Downloads (Duke, and the four trade ebooks) are
deliberately absent: paraphrasing a work that is in copyright still produces a
derivative work, so they are not a lawful input here. Everything in SOURCES was
published before 1930 and is public domain in the United States; the authors
died long enough ago for Canada as well.

Usage:
  python3 scripts/rewrite-thin-from-pd.py --generate --limit 5
  python3 scripts/rewrite-thin-from-pd.py --generate
  python3 scripts/rewrite-thin-from-pd.py --apply
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANDIDATES = "/tmp/thin-pd-candidates-v2.json"
OUT = os.path.join(ROOT, "artifacts", "thin-rewrite.jsonl")
BACKUP = os.path.join(ROOT, "artifacts", "thin-rewrite-backup.jsonl")

SOURCES = {
    "usdisp1918": ("US Dispensatory 1918", "1918",
                   "https://archive.org/details/dispensatoryofun0000unse"),
    "usdisp1894": ("US Dispensatory 1894", "1894",
                   "https://archive.org/details/101539506.nlm.nih.gov"),
    "kings1898": ("King's American Dispensatory 1898", "1898",
                  "https://archive.org/details/101515929.nlm.nih.gov"),
    "ellingwood1919": ("Ellingwood's American Materia Medica 1919", "1919",
                       "https://archive.org/details/b31352868"),
    "fernie1897": ("Fernie's Herbal Simples 1897", "1897",
                   "https://www.gutenberg.org/ebooks/19352"),
}
PREFERENCE = ["usdisp1918", "kings1898", "usdisp1894", "ellingwood1919", "fernie1897"]

# Drugs made from a plant are not the plant. Same list the importer uses.
PREP_ENTRY = re.compile(
    r"^(ACETUM|AQUA|CATAPLASMA|CERATUM|COLLODIUM|CONFECTIO|DECOCTUM|ELIXIR|"
    r"EMPLASTRUM|ENEMA|EXTRACTUM|FLUIDEXTRACTUM|GLYCERITUM|INFUSUM|INJECTIO|"
    r"LINIMENTUM|LIQUOR|LOTIO|MEL|MISTURA|MUCILAGO|OLEORESINA|OLEUM|PASTA|"
    r"PIGMENTUM|PILULAE|PULVIS|SPIRITUS|SUPPOSITORIUM|SYRUPUS|TINCTURA|"
    r"TROCHISCI|UNGUENTUM|VINUM|VINEGAR|ALCOHOL)\b")
# King's and Ellingwood run their headings inline: "Action and Medical Uses. - ..."
RAW_HEAD = re.compile(
    r"\b(Action and (?:Medical )?Uses|Action, Medical Uses|Medical Uses|"
    r"Therapeutic Uses|Properties and Uses|Action and Properties|"
    r"Specific Symptomatology|Physiological Action|Therapy|Indications)"
    r"\s*[.\-—:]*\s*", re.I)

# Product and preparation pages share a binomial with the plant but are not the
# plant; a monograph about the herb does not belong under them.
PRODUCT_SLUG = re.compile(
    r"(^|-)(cbd|oil|extract|tincture|powder|capsules?|tablets?|supplement|"
    r"analgesic|digestive|source|formula|blend|syrup|salve|cream|serum|tonic|"
    r"elixir|dig|supply)(-|$)")

DOSE = re.compile(
    r"\b(dose[ds]?|dosage|grain|grains|drachm|drachms|minim|minims|fluidounce|"
    r"fluidounces|teaspoon|teaspoons|tablespoon|tablespoons|gramme|grammes|"
    r"scruple|scruples|ounce|ounces|\d+\s*(?:mg|ml|g|grams?|drops?))\b", re.I)
OVERCLAIM = re.compile(r"\b(cures?|cancer|FDA)\b", re.I)
# A use that names no condition or effect is padding. The 2026-11-03 vault note
# is explicit: thin pages get real content or nothing, never filler.
VAGUE_USE = re.compile(
    r"^(medicinal (purposes?|uses?|properties)|therapeutic (agent|use|purposes?)|"
    r"native american uses?|indigenous (eclectic )?(remedy|remedies|use|uses)|"
    r"various (ailments|complaints|purposes)|used as (a )?medicine|"
    r"general (tonic|medicine)|folk medicine)$", re.I)
USE_SIGNAL = re.compile(
    r"\b(used|use[sd]?|employ\w*|indicated|indication|valuable in|useful in|"
    r"remedy|remedies|reliev\w*|cure[sd]?|action|effect|affection|complaint|"
    r"disease|disorder|inflammation|pain|fever|cough|diarrh|dysentery|"
    r"asthma|colic|rheumat\w*|tonic|stimulant|astringent|laxative|diuretic|"
    r"expectorant|antiseptic|sedative|narcotic|emmenagogue|diaphoretic|"
    r"cathartic|purgative|vermifuge|antispasmodic|demulcent|alterative)\b",
    re.I)
SYSTEM = (
    "You write reference entries for a herbal encyclopedia. You are given an "
    "excerpt from a public-domain herbal published before 1930. Write complete, "
    "original, modern English. Use only facts stated in the excerpt. Never reuse "
    "a run of words from it. Do not give doses, recipes, or instructions for use. "
    "Do not claim that the plant treats or cures disease; describe what the "
    "historical source recorded, using phrasing such as 'was traditionally used "
    "for'. No em dashes. Return JSON only."
)


def load_env():
    env = {}
    for line in open(os.path.join(ROOT, ".env.local"), encoding="utf-8"):
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m:
            env[m.group(1)] = m.group(2).strip("\"'")
    return env


ENV = load_env()
BASE = ENV["NEXT_PUBLIC_SUPABASE_URL"]
KEY = ENV["SUPABASE_SERVICE_ROLE_KEY"]
MODEL = ENV.get("OLLAMA_CLOUD_MODEL", "deepseek-v4.1-flash")
OLLAMA = ENV.get("OLLAMA_CLOUD_URL", "https://ollama.com/v1").rstrip("/")


def api(url, method="GET", body=None, headers=None, timeout=60):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        return r.status, (json.loads(raw) if raw else None)


def library():
    cols = ("slug,name,scientific_name,description,traditional_uses,"
            "dosage_adult,provenance,evidence_level")
    out, offset = [], 0
    while True:
        url = (f"{BASE}/rest/v1/herbs?select={cols}&is_published=eq.true"
               f"&order=slug&limit=1000&offset={offset}")
        _, rows = api(url)
        out.extend(rows)
        if len(rows) < 1000:
            break
        offset += 1000
    return {h["slug"]: h for h in out}


def tokens(text):
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def copied_run(output, source, n=7):
    """True when an n-word run of the output appears verbatim in the source."""
    a, b = tokens(output), tokens(source)
    if len(a) < n:
        return False
    src = {" ".join(b[i:i + n]) for i in range(len(b) - n + 1)}
    return any(" ".join(a[i:i + n]) in src for i in range(len(a) - n + 1))


ORDER = {
    "uses": 0, "action and uses": 0, "actions and uses": 0, "medicinal uses": 0,
    "medicinal properties and uses": 0, "therapeutic uses": 0,
    "action and medical uses": 0, "action, medical uses": 0, "medical uses": 0,
    "properties and uses": 0, "specific symptomatology": 0, "therapy": 0,
    "indications": 0,
    "properties": 1, "action and properties": 1, "physiological action": 1,
    "composition": 2, "constituents": 2,
    "description": 3, "history": 4, "toxicology": 5, "poisoning": 5,
}


def raw_sections(text):
    """Split a raw entry at its inline headings so uses can be read first."""
    parts = RAW_HEAD.split(text)
    out = []
    if parts[0].strip():
        out.append({"marker": "description", "text": parts[0].strip()})
    for k in range(1, len(parts) - 1, 2):
        head = parts[k].strip().lower()
        body = parts[k + 1].strip()
        if len(body) >= 120:
            out.append({"marker": head, "text": body})
    return out or [{"marker": "description", "text": text}]


def full_source(item):
    """Every character the prompt can draw on, for the copy check."""
    secs = item.get("sections") or []
    if not secs:
        return item["text"]
    return "\n\n".join((s.get("text") or "") for s in secs)


def build_excerpt(item):
    """Put the use-bearing sections first so the model does not drown in history."""
    secs = item.get("sections") or []
    if secs and all(not s.get("marker") for s in secs):
        secs = raw_sections("\n\n".join((s.get("text") or "") for s in secs))
    if not secs:
        secs = raw_sections(item["text"])
    ranked = sorted(
        enumerate(secs),
        key=lambda pair: (ORDER.get((pair[1].get("marker") or "").lower(), 6),
                          pair[0]))
    parts, total = [], 0
    for _, sec in ranked:
        text = (sec.get("text") or "").strip()
        if len(text) < 120:
            continue
        label = (sec.get("marker") or "Description").upper()
        chunk = f"{label}: {text}"
        room = 3000 - total
        if room <= 0:
            break
        parts.append(chunk[:room])
        total += len(parts[-1])
    return "\n\n".join(parts)


def call_model(herb, item, retry=0):
    label, year, _ = SOURCES[item["book"]]
    excerpt = build_excerpt(item)
    user = (
        f"Herb: {herb['name']}\nScientific name: {herb['scientific_name']}\n"
        f"Source: {label} ({year})\n\nExcerpt:\n\"\"\"\n{excerpt}\n\"\"\"\n\n"
        "Write JSON with exactly two keys:\n"
        "- description: 2 to 4 sentences, 300 to 700 characters, plain modern "
        "English. Describe the plant and the medicinal uses the excerpt records. "
        "Leave out synonym lists, foreign names, and publication details.\n"
        "- traditional_uses: 2 to 5 short noun phrases, each 2 to 10 words. Each "
        "must name a condition, symptom, or purpose the excerpt says the herb was "
        "used for, for example 'indigestion and flatulence' or 'coughs and "
        "bronchitis'. Do not list taxonomy, cultivation, or history as a use, and "
        "do not invent a use the excerpt does not record.\n"
        "In the description, do not reuse any run of five or more words from "
        "the excerpt; rewrite botanical and therapeutic descriptions in your own "
        "words. In the uses, keep each phrase short rather than copying a whole "
        "sentence. Write directly about the plant: do not say 'the source', "
        "'the excerpt', or 'a historical source'. No doses, no preparation "
        "instructions, no modern medical claims, no em dashes, and do not name "
        "the book."
    )
    if retry:
        user += (
            " Your previous attempt reused wording from the excerpt. Rewrite every "
            "sentence from scratch: change the sentence structure and the word "
            "order, not just a few words. Describe only what the plant is and what "
            "the excerpt says it was used for."
        )
    body = {
        "model": MODEL,
        "messages": [{"role": "system", "content": SYSTEM},
                     {"role": "user", "content": user}],
        "temperature": 0.7 if retry else 0.4,
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


def validate(obj, source):
    if not isinstance(obj, dict):
        return None, "not an object"
    desc = obj.get("description")
    uses = obj.get("traditional_uses")
    if not isinstance(desc, str) or not isinstance(uses, list):
        return None, "missing keys"
    desc = re.sub(r"\s+", " ", desc).strip()
    uses = [re.sub(r"\s+", " ", str(u)).strip().rstrip(".") for u in uses if str(u).strip()]
    uses = [u[:1].upper() + u[1:] if u else u for u in uses]
    if not (280 <= len(desc) <= 900):
        return None, f"description length {len(desc)}"
    if len(uses) > 5:
        uses = uses[:5]
    if len(uses) < 2:
        return None, f"uses count {len(uses)}"
    if any(not (4 <= len(u) <= 160) for u in uses):
        return None, "use length"
    if len(set(u.lower() for u in uses)) != len(uses):
        return None, "duplicate uses"
    if any(VAGUE_USE.match(u) for u in uses):
        return None, "vague use"
    joined = desc + " " + " ".join(uses)
    if DOSE.search(joined):
        return None, "dose language"
    if OVERCLAIM.search(joined):
        return None, "overclaim"
    if "—" in joined or "–" in joined:
        return None, "dash"
    if re.search(r"\b(the source|the excerpt|the book|this text|historical account)\b",
                 joined, re.I):
        return None, "mentions the source"
    # "used for medicinal purposes" and "various ailments" say nothing; a page
    # padded with them is still a thin page.
    if re.search(r"\b(medicinal purposes|various ailments|various complaints)\b",
                 joined, re.I):
        return None, "filler phrase"
    # Descriptions must be original prose. Uses are short technical labels
    # ("spasmodic stricture of the urethra"); the same words are the standard
    # name for the thing, so only a long verbatim run there is a problem.
    if copied_run(desc, source):
        return None, "copied run"
    if any(copied_run(u, source, n=10) for u in uses):
        return None, "copied use"
    return {"description": desc, "traditional_uses": uses}, None


def generate(limit=None, only_slug=None):
    data = json.load(open(CANDIDATES))
    union = data["union"]
    herbs = library()

    done = set()
    if os.path.exists(OUT) and not only_slug:
        for line in open(OUT, encoding="utf-8"):
            try:
                row = json.loads(line)
                if row.get("status") in ("ok", "skipped"):
                    done.add(row["slug"])
            except json.JSONDecodeError:
                continue

    slugs = [s for s in union if s not in done]
    if only_slug:
        slugs = [only_slug]
    slugs.sort(key=lambda s: (min(PREFERENCE.index(i["book"]) for i in union[s]), s))
    if limit:
        slugs = slugs[:limit]
    print(f"[generate] candidates {len(union)}, already done {len(done)}, "
          f"to do {len(slugs)}", flush=True)

    ok = failed = 0
    with open(OUT, "a", encoding="utf-8") as fh:
        def record_skip(row_slug, why, herb=None):
            row = {"slug": row_slug, "status": "skipped", "reason": why,
                   "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ",
                                                 time.gmtime())}
            if herb:
                row["name"] = herb.get("name")
                row["scientific_name"] = herb.get("scientific_name")
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            fh.flush()
            print(f"  skip {row_slug}: {why}", flush=True)

        for idx, slug in enumerate(slugs, 1):
            herb = herbs.get(slug)
            if not herb:
                record_skip(slug, "not in library")
                continue
            prov = herb.get("provenance") or {}
            if isinstance(prov, dict) and prov.get("verification_status") in (
                    "formula", "non_plant"):
                record_skip(slug, prov.get("verification_status"), herb)
                continue
            if PRODUCT_SLUG.search(slug):
                record_skip(slug, "product page", herb)
                continue
            items = sorted(union[slug],
                           key=lambda i: (PREFERENCE.index(i["book"]), -i["chars"]))
            items = [i for i in items
                     if not PREP_ENTRY.match(i["entry"].strip())
                     and "POULTICE" not in i["entry"].upper()]
            # A text-resolved item must name the plant, both words, in its
            # opening; otherwise the entry is a mixed group ("THISTLES") and the
            # uses may belong to another species mentioned later. Title-resolved
            # items are already the plant.
            def named_up_front(i):
                if str(i.get("how", "")).startswith("title:"):
                    return True
                words = (i.get("binomial") or "").split()
                if len(words) != 2:
                    return False
                pat = re.compile(rf"\b{re.escape(words[0])}\W+{re.escape(words[1])}\b",
                                 re.I)
                return bool(pat.search((i.get("text") or "")[:700]))

            items = [i for i in items if named_up_front(i)]
            if not items:
                record_skip(slug, "no plant-named entry", herb)
                continue
            item = items[0]
            # An entry that only describes the plant has nothing to say about
            # uses. Generating from it produces filler ("medicinal purposes"),
            # which is exactly what the thin-content work is trying to remove.
            if not USE_SIGNAL.search(build_excerpt(item)):
                record_skip(slug, "source records no uses", herb)
                continue
            last = None
            result = None
            for attempt in range(2):
                try:
                    obj = call_model(herb, item, retry=attempt)
                except Exception as e:                     # noqa: BLE001
                    last = f"api: {type(e).__name__}: {e}"
                    time.sleep(2 * (attempt + 1))
                    continue
                result, last = validate(obj, full_source(item))
                if result:
                    break
            row = {
                "slug": slug,
                "name": herb["name"],
                "scientific_name": herb["scientific_name"],
                "book": item["book"],
                "entry": item["entry"],
                "binomial": item["binomial"],
                "source_chars": item["chars"],
                "model": MODEL,
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            old_desc = (herb.get("description") or "").strip()
            # Keep an existing substantive description. The usual thin row is
            # either short or a regulator sentence about product counts; those
            # are the ones worth replacing.
            row["keep_description"] = (
                len(old_desc) >= 240
                and "licensed natural-health products" not in old_desc
            )
            if result:
                row.update(result)
                row["status"] = "ok"
                ok += 1
            else:
                row["status"] = "rejected"
                row["reason"] = last
                failed += 1
            # Keep the pre-write values so an apply can be reversed.
            row["old"] = {
                "description": herb.get("description"),
                "traditional_uses": herb.get("traditional_uses"),
                "provenance": herb.get("provenance"),
            }
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            fh.flush()
            print(f"  {idx}/{len(slugs)} {slug:<38} "
                  f"{'ok' if result else 'REJECT ' + str(last)}", flush=True)
    print(f"[generate] ok {ok}, rejected {failed}, file {OUT}", flush=True)


def provenance_for(old, item):
    prov = dict(old or {})
    label, _, url = SOURCES[item["book"]]
    sources = prov.get("sources")
    new = {"name": label, "type": "historical", "licence": "public-domain", "url": url}
    if isinstance(sources, list):
        names = {(s.get("name") if isinstance(s, dict) else s) for s in sources}
        if label not in names:
            sources.append(new)
        prov["sources"] = sources
    else:
        prov["sources"] = [new]
    # `verified_sources` feeds the identity/regulator cross-check badge and the
    # "N sources" count. A 19th-century text is neither, so it stays out of it.
    prov["verification_method"] = "ai_summarized"
    prov["rewrite"] = {
        "method": "paraphrased-from-public-domain",
        "model": MODEL,
        "source": label,
        "date": time.strftime("%Y-%m-%d", time.gmtime()),
    }
    return prov


def apply():
    if not os.path.exists(OUT):
        sys.exit(f"nothing to apply: {OUT} is missing")
    rows = [json.loads(l) for l in open(OUT, encoding="utf-8") if l.strip()]
    # A resumed or retried slug can appear more than once; keep the last write.
    latest = {}
    for r in rows:
        if r.get("status") == "ok":
            latest[r["slug"]] = r
    rows = list(latest.values())
    print(f"[apply] rows ready: {len(rows)}", flush=True)
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
            print(f"  {'ok' if ok else 'FAIL'} {row['slug']} "
                  f"({state['done']}/{len(rows)})", flush=True)

        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(write, rows))
    print(f"[apply] written {state['done']} of {len(rows)}; backup {BACKUP}", flush=True)
    print("[apply] purge the Vercel data cache tag 'herb-page-bundle' next.", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--generate", action="store_true")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--slug")
    args = ap.parse_args()
    if args.apply:
        apply()
    else:
        generate(limit=args.limit, only_slug=args.slug)


if __name__ == "__main__":
    main()
