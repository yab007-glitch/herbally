#!/usr/bin/env python3
"""Crawl every published herb page the way a visitor would, and record what renders.

For each page it captures: HTTP status, response time, HTML size, whether the key
sections are present (description, uses, dose, safety, sources), the external links
it emits, and any visible placeholders ("undefined", "NaN", "null", "TODO").

Then it resolves every distinct external link so a dead source URL is caught once
rather than 3,000 times.

Usage: python3 scripts/audit-pages.py [--limit N] [--concurrency 8]
Output: artifacts/page-audit.json
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
OUT = os.path.join(ROOT, "artifacts", "page-audit.json")
BASE_SITE = "https://herbally.app"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"
LIMIT = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 0
CONC = int(sys.argv[sys.argv.index("--concurrency") + 1]) if "--concurrency" in sys.argv else 2
SKIP_LINKS = "--skip-links" in sys.argv


def load_env():
    env = {}
    for line in open(os.path.join(ROOT, ".env.local")):
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m:
            env[m.group(1)] = m.group(2).strip("\"'")
    return env


def slugs(env):
    base, key = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
    out = []
    for off in range(0, 6000, 1000):
        req = urllib.request.Request(
            f"{base}/rest/v1/herbs?select=slug&is_published=eq.true&order=slug&limit=1000&offset={off}",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            page = json.load(r)
        out += [x["slug"] for x in page]
        if len(page) < 1000:
            break
    return out


def text_of(html):
    t = re.sub(r"<script.*?</script>", " ", html, flags=re.S)
    t = re.sub(r"<style.*?</style>", " ", t, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"&nbsp;?", " ", t)
    t = re.sub(r"&amp;", "&", t)
    return re.sub(r"\s+", " ", t).strip()


def check(slug):
    url = f"{BASE_SITE}/herbs/{slug}"
    started = time.time()
    rec = {"slug": slug, "url": url}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=45) as r:
            html = r.read().decode("utf-8", "replace")
            rec["status"] = r.status
    except urllib.error.HTTPError as exc:
        rec.update(status=exc.code, error="http")
        return rec
    except Exception as exc:
        rec.update(status=0, error=str(exc)[:80])
        return rec
    rec["ms"] = int((time.time() - started) * 1000)
    rec["bytes"] = len(html)
    t = text_of(html).lower()
    rec.update(
        has_uses=("used for" in t or "traditionally used" in t or "indication" in t),
        has_dose=("dose" in t or "dosage" in t),
        has_safety=("avoid" in t or "caution" in t or "pregnancy" in t),
        has_sources=("health canada" in t or "european medicines" in t or "source" in t),
        placeholder=bool(re.search(r"\b(undefined|nan|null)\b|\[object object\]|todo:|lorem ipsum", t)),
        empty_uses=("no specific therapeutic indication" in t),
        words=len(t.split()),
    )
    links = set(re.findall(r'href="(https?://[^"]+)"', html))
    rec["links"] = sorted(l for l in links if "herbally.app" not in l)
    return rec


def resolve(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
        with urllib.request.urlopen(req, timeout=25) as r:
            return {"url": url, "status": r.status}
    except urllib.error.HTTPError as exc:
        return {"url": url, "status": exc.code}
    except Exception as exc:
        return {"url": url, "status": 0, "error": str(exc)[:60]}


def main():
    env = load_env()
    all_slugs = slugs(env)
    work = all_slugs[:LIMIT] if LIMIT else all_slugs
    print(f"[audit] {len(work)} pages, concurrency {CONC}")

    results = []
    with ThreadPoolExecutor(max_workers=CONC) as ex:
        for i, rec in enumerate(ex.map(check, work), 1):
            results.append(rec)
            if i % 200 == 0:
                print(f"[audit] {i}/{len(work)}")

    if SKIP_LINKS:
        link_results = []
        print("[audit] link resolution skipped")
    else:
        links = sorted({l for r in results for l in r.get("links", [])})
        print(f"[audit] {len(links)} distinct external links to resolve")
        with ThreadPoolExecutor(max_workers=4) as ex:
            link_results = list(ex.map(resolve, links))

    summary = {
        "pages": len(results),
        "non_200": [r for r in results if r.get("status") != 200],
        "placeholders": [r["slug"] for r in results if r.get("placeholder")],
        "no_uses": [r["slug"] for r in results if not r.get("has_uses")],
        "no_dose": [r["slug"] for r in results if not r.get("has_dose")],
        "no_sources": [r["slug"] for r in results if not r.get("has_sources")],
        "dead_links": [l for l in link_results if l["status"] not in (200, 301, 302)],
        "slowest": sorted([r for r in results if r.get("ms")], key=lambda r: -r["ms"])[:10],
        "median_ms": sorted([r["ms"] for r in results if r.get("ms")])[len(results) // 2] if results else None,
    }
    json.dump({"generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "summary": summary, "pages": results, "links": link_results}, open(OUT, "w"), indent=1)
    print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in summary.items()}, indent=1))
    for l in summary["dead_links"][:20]:
        print("  DEAD", l["status"], l["url"][:120])


if __name__ == "__main__":
    main()
