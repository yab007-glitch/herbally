#!/usr/bin/env python3
"""Work through the 83 same-species duplicate groups left by the cleanup report.

Two rows for the same plant are duplicate content: Google indexes one and ignores
the other, and every link pointing at the loser is half-wasted. The earlier passes
merged the easy 108 (one side was an empty stub). These 83 are the hard ones — both
sides carry content — so the rules below decide a survivor instead of an eyeball.

Guards that refuse rather than guess:
  * a different plant part on each side (leaf vs root) — those are different drugs
  * a species against its own variety/subspecies where the variety is the richer
    row — collapsing a species into a variety points the wrong way
  * two genuinely rich rows whose names differ beyond variety/form markers
  * preparations that are not the same product (oil, extract, tea, powder)

Usage:
  python3 scripts/merge-near-duplicates.py            # plan only
  python3 scripts/merge-near-duplicates.py --apply    # unpublish + 308
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPLY = "--apply" in sys.argv

env = {}
for line in open(os.path.join(ROOT, ".env.local")):
    m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
    if m:
        env[m.group(1)] = m.group(2).strip("\"'")
BASE = env["NEXT_PUBLIC_SUPABASE_URL"]
KEY = env["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


def get(path):
    req = urllib.request.Request(f"{BASE}/rest/v1/{path}", headers=H)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def patch(path, body):
    req = urllib.request.Request(
        f"{BASE}/rest/v1/{path}",
        data=json.dumps(body).encode(),
        headers=H,
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.status


PART = re.compile(
    r"\b(leaf|leaves|root|roots|bark|flower|flowers|seed|seeds|fruit|fruits|"
    r"rhizome|peel|rind|pollen|stem|stems|wood|twig|bud|bulb|tuber|sap|resin|"
    r"xin|heart|plumule|embryo|kernel|stone|pit)\b",
    re.I,
)
FORM = re.compile(r"\b(var\.|subsp\.|ssp\.|f\.|cv\.|forma)\b", re.I)
PREP = re.compile(r"\b(oil|extract|tincture|powder|tea|juice|syrup|capsule)\b", re.I)


PART_SYNONYMS = {
    "leaves": "leaf", "roots": "root", "flowers": "flower", "seeds": "seed",
    "fruits": "fruit", "stems": "stem", "twigs": "twig",
    # the lotus embryo is sold as "xin", "heart" or "plumule" — one part
    "heart": "xin", "plumule": "xin", "embryo": "xin",
    "kernel": "seed", "stone": "seed", "pit": "seed",
}


def parts(name):
    return {PART_SYNONYMS.get(p.lower(), p.lower()) for p in PART.findall(name or "")}


def preps(name):
    return {p.lower() for p in PREP.findall(name or "")}


def score(row):
    s = 0.5 * len(row.get("sources") or [])
    s += 6 if row["monograph"] else 0
    s += 4 if row["regulatory"] else 0
    s += 3 if row["image_url"] else 0
    s += min(3, len(row["uses"] or []) / 2)
    s += 2 if (row["dosage"] or "").strip() else 0
    s += 2 if len(row["description"] or "") > 200 else 0
    s += min(2, row["faqs"] / 3)
    return s


def main():
    groups = json.load(open(os.path.join(ROOT, "artifacts/cleanup-report.json")))["duplicates"]
    herbs = get("herbs?select=id,slug,name,scientific_name,description,traditional_uses,dosage_adult,image_url,is_published,category_id,provenance&limit=5000")
    by_slug = {h["slug"]: h for h in herbs}
    mono = {m["herb_slug"] for m in get("herb_monographs?select=herb_slug&status=eq.published&limit=5000")}
    reg = {r["herb_slug"] for r in get("herb_regulatory_evidence?select=herb_slug&limit=5000")}
    faqs = {}
    for f in get("herb_faqs?select=herb_id&limit=20000"):
        faqs[f["herb_id"]] = faqs.get(f["herb_id"], 0) + 1

    plan, refused = [], []
    for g in groups:
        rows = []
        for r in g["rows"]:
            h = by_slug.get(r["slug"])
            if not h or not h["is_published"]:
                continue
            rows.append(
                {
                    "slug": h["slug"],
                    "name": h["name"],
                    "sci": h["scientific_name"] or "",
                    "description": h["description"] or "",
                    "uses": h["traditional_uses"] or [],
                    "dosage": h["dosage_adult"] or "",
                    "image_url": h["image_url"],
                    "monograph": h["slug"] in mono,
                    "regulatory": h["slug"] in reg,
                    "faqs": faqs.get(h.get("id"), 0),
                    "sources": (h.get("provenance") or {}).get("verified_sources")
                    or (h.get("provenance") or {}).get("sources")
                    or [],
                }
            )
        if len(rows) < 2:
            continue
        for r in rows:
            r["score"] = score(r)

        # Plant parts partition the group: seed, leaf and root are different
        # drugs that happen to share a binomial, so only rows with the same part
        # signature are candidates against each other.
        by_part: dict[tuple, list] = {}
        for r in rows:
            by_part.setdefault(tuple(sorted(parts(r["name"]))), []).append(r)

        if len(by_part) > 1:
            # Different parts of one plant are different drugs; record the split
            # so a later pass does not "discover" them as duplicates again.
            refused.append(
                {
                    "group": g["species"],
                    "why": "different plant parts",
                    "rows": [r["slug"] for r in rows],
                    "parts": {",".join(k) or "(none)": [r["slug"] for r in v] for k, v in by_part.items()},
                }
            )

        for part_key, partition in by_part.items():
            if len(partition) < 2:
                continue
            all_prep = [preps(r["name"]) for r in partition]
            if any(p and p != all_prep[0] for p in all_prep[1:]):
                refused.append({"group": g["species"], "why": "different preparations", "rows": [r["slug"] for r in partition]})
                continue
            ranked = sorted(partition, key=lambda r: r["score"], reverse=True)
            if ranked[0]["slug"] == ranked[1]["slug"]:
                continue
            keep, drop = ranked[0], ranked[1]
            if FORM.search(keep["sci"]) and not FORM.search(drop["sci"]):
                keep, drop = drop, keep
            if keep["score"] - drop["score"] < 2 and keep["score"] > 8 and keep["monograph"] and drop["monograph"]:
                refused.append({"group": g["species"], "why": "both rows rich", "rows": [r["slug"] for r in partition]})
                continue

            plan.append(
                {
                    "species": g["species"],
                    "keep": keep["slug"],
                    "drop": drop["slug"],
                    "keep_score": round(keep["score"], 1),
                    "drop_score": round(drop["score"], 1),
                    "reason": "richer entry survives",
                }
            )

    print(f"groups: {len(groups)} | merges: {len(plan)} | refused: {len(refused)}")
    for p in plan[:15]:
        print(f"  {p['drop']:34} -> {p['keep']:30} ({p['keep_score']} vs {p['drop_score']})")
    for r in refused[:8]:
        print(f"  REFUSED {r['group'][:30]:32} {r['why']}")

    json.dump({"plan": plan, "refused": refused}, open(os.path.join(ROOT, "artifacts/duplicate-merge-plan.json"), "w"), indent=1)
    if not APPLY:
        print("dry run — pass --apply to merge")
        return

    done = 0
    for p in plan:
        slug = urllib.parse.quote(p["drop"])
        patch(f"herbs?slug=eq.{slug}", {"is_published": False})
        # read back: PostgREST returns 204 whether or not a row matched
        back = get(f"herbs?select=is_published&slug=eq.{slug}")
        if back and back[0]["is_published"] is False:
            done += 1
        else:
            print(f"  READ-BACK MISMATCH {p['drop']}")
        time.sleep(0.15)

    merges_path = os.path.join(ROOT, "data/herb-merges.json")
    redirects_path = os.path.join(ROOT, "data/herb-merge-redirects.json")
    merges = json.load(open(merges_path))
    redirects = json.load(open(redirects_path))
    have = {m["from"] for m in merges["merges"]}
    red_have = {r["from"] for r in redirects}
    added = 0
    for p in plan:
        src = f"/herbs/{p['drop']}"
        if src in have:
            continue
        merges["merges"].append({"from": src, "to": f"/herbs/{p['keep']}", "carry_note": "Same species; the richer entry survives."})
        added += 1
        if src not in red_have:
            redirects.append({"from": src, "to": f"/herbs/{p['keep']}"})
    json.dump(merges, open(merges_path, "w"), indent=1)
    json.dump(redirects, open(redirects_path, "w"), indent=1)
    print(f"applied {done}/{len(plan)} unpublishes; manifest +{added} merges, redirects now {len(redirects)}")


if __name__ == "__main__":
    main()
