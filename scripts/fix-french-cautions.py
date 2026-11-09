#!/usr/bin/env python3
"""Remove French label text from the English `contraindications` field.

LNHPD returns French label text for some products even when queried with
lang=en. The importers stored it verbatim, so 100+ English herb pages rendered
"Consultez un praticien de la santé..." under "Cautions and Warnings".

`translations.fr.contraindications` already holds the French version for these
herbs (localizeHerb overlays it on /fr pages), so the correct fix is to drop the
French strings from the English array rather than translate or duplicate them.
French pages keep their cautions; English pages stop showing French.

Usage:
  python3 scripts/fix-french-cautions.py            # dry run
  python3 scripts/fix-french-cautions.py --apply
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT_DIR = __file__.rsplit("/scripts/", 1)[0]
APPLY = "--apply" in sys.argv

# French-only markers. "dose" is deliberately absent: it is also an English word
# and misclassified "Long-term high-dose use" on the first pass.
FR_ACCENT = re.compile(r"[àâçéèêëîïôûùüÿœ]", re.I)
FR_WORD = re.compile(
    r"\b(consulter|consultez|praticien|santé|sante|médecin|medecin|enceinte|"
    r"allaitement|allait|contre-indication|ne pas|utiliser|symptômes|symptomes|"
    r"effets|produit|femmes|enfants|tenir|éviter|grossesse|vous|votre)\b",
    re.I,
)


def load_env():
    env = {}
    for line in open(f"{ROOT_DIR}/.env.local"):
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m:
            env[m.group(1)] = m.group(2).strip("\"'")
    return env


def is_french(s):
    return bool(FR_ACCENT.search(s) or FR_WORD.search(s))


def fetch_all(base, key):
    rows, off = [], 0
    while True:
        url = (
            f"{base}/rest/v1/herbs?select=slug,contraindications"
            f"&is_published=eq.true&limit=1000&offset={off}&order=slug"
        )
        req = urllib.request.Request(
            url, headers={"apikey": key, "Authorization": f"Bearer {key}"}
        )
        with urllib.request.urlopen(req, timeout=90) as r:
            page = json.load(r)
        rows += page
        if len(page) < 1000:
            return rows
        off += 1000


def main():
    env = load_env()
    base = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    H = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    rows = fetch_all(base, key)
    print(f"[fr-cautions] {len(rows)} published herbs")

    moves = []
    for r in rows:
        cs = [c for c in (r.get("contraindications") or []) if c]
        fr = [c for c in cs if is_french(c)]
        if not fr:
            continue
        en = [c for c in cs if not is_french(c)]
        moves.append((r["slug"], fr, en))
    print(
        f"[fr-cautions] {len(moves)} herbs carry French text; "
        f"{sum(len(f) for _, f, _ in moves)} entries to remove, "
        f"{sum(len(e) for _, _, e in moves)} English entries kept"
    )
    if not APPLY:
        for slug, fr, en in moves[:5]:
            print(f"  - {slug}: -{len(fr)} fr, keep {len(en)}")
        return

    ok = failed = consecutive = 0
    for slug, fr, en in moves:
        req = urllib.request.Request(
            f"{base}/rest/v1/herbs?slug=eq.{urllib.parse.quote(slug)}",
            data=json.dumps({"contraindications": en}).encode(),
            headers={**H, "Prefer": "return=minimal"},
            method="PATCH",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                ok += r.status in (200, 204)
            consecutive = 0
        except Exception as exc:
            failed += 1
            consecutive += 1
            print(f"  x {slug}: {exc}")
            # The Free-tier Nano must not be hammered: three consecutive write
            # failures means the database is unwell, not that this row is odd.
            if consecutive >= 3:
                print("[fr-cautions] halting after 3 consecutive failures")
                break
        time.sleep(0.2)
    print(f"[fr-cautions] patched {ok}, failed {failed}")


if __name__ == "__main__":
    main()
