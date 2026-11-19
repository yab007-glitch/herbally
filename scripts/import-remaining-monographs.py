#!/usr/bin/env python3
"""Harvest remaining real official monographs (Health Canada, EU EMA HMPC, NIH LiverTox)
into an idempotent SQL migration (`supabase/migrations/00080_real_monographs_import.sql`).

Zero fabrication: every row comes directly from official HTML files cached in
`artifacts/hc-cache/`, official EMA HMPC PDFs listed in `artifacts/ema-final-mapping.json`,
or public-domain NIH LiverTox extracts in `artifacts/livertox-extracts.json`.
"""
import html as html_lib
import json
import os
import re
import subprocess
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"
HC_CACHE = ARTIFACTS / "hc-cache"
EMA_CACHE = Path("/tmp/ema_pdfs_20261118")
OUT_SQL = ROOT / "supabase" / "migrations" / "00080_real_monographs_import.sql"
TODAY = date.today().isoformat()

HC_ATTRIBUTION = "Contains information licensed under the Open Government Licence – Canada."
EMA_ATTRIBUTION = "European Medicines Agency (EMA), Committee on Herbal Medicinal Products (HMPC)"
LIVERTOX_ATTRIBUTION = "NIDDK LiverTox (National Institutes of Health) — Public Domain."

# Exact Health Canada cached html filename (atid) -> verified published herb_slug
HC_EXTRA_MAP = {
    "turmeric.oral.curcuma.orale2": "turmeric",
    "aloe.oral.orale2": "aloe-vera",
    "bilberry.myrtille.oral": "bilberry",
    "crataegus.monogyna": "hawthorn",
    "fenugreek.oral2": "fenugreek",
    "ephedra2": "ephedra-sinica",
    "gentian2": "yellow-gentian-root",
    "mugwort": "mugwort-european",
    "white.wil.saule.bla": "white-willow",
    "alfalfa2": "medicago-sativa",
    "caraway.carvi2": "carum-carvi-herb",
    "cascara.sagrada2": "frangula-purshiana",
    "cham.germ.oral.orale2": "chamomile",
    "chaste.tree.vitex": "vitex",
    "coenzyme.q10": "coq10-antioxidant",
    "deg.lic.reg.oral.orale2": "licorice-dgl",
    "echinacea.purpurea2": "echinacea",
    "pennyroyal2": "lamiaceae-pennyroyal",
    "primrose.onagre2": "evening-primrose",
    "fennel.fenouil.sweet.doux2": "fennel",
    "globe.artichoke.artichaut2": "artichoke",
    "ginseng.panax2": "ginseng",
    "ginseng.american2": "american-ginseng",
    "phaseolus.vulgaris2": "phaseolus-vulgaris",
    "horseradish.raifort2": "armoracia-rusticana-herb",
    "ground.ivy.oral2": "glechoma-hederacea",
    "figwort.scrofulaire": "scrophularia",
    "greencoffeebean.ext.fevescafevert2": "coffee-green-extract",
    "glucomannan": "amorphophallus",
    "stinging.nettle2": "nettle",
    "avens2": "wood-avens",
    "bovine.colostrum.bovin2": "colostrum-bovine",
    "alpha.lipoic.acid2": "alpha-lipoic-source",
    "5htp": "griffonia-simplicifolia",
    "lycopodium": "lycopodium-clavatum",
}

# LiverTox remaining record name -> verified published herb_slug
LT_EXTRA_MAP = {
    "Quercetin": "sophora-japonica-quercetin-phosphatidylcholine-complex",
    "Resveratrol": "resveratrol-source",
    "Stinging Nettle": "nettle",
    "Alfalfa": "medicago-sativa",
    "American Ginseng": "american-ginseng",
    "Asian Ginseng": "ginseng",
    "Ginseng": "ginseng",
    "Cascara": "frangula-purshiana",
}

HC_STOP_RES = [
    re.compile(r"^Use\(s\) or Purpose\(s\)$", re.I),
    re.compile(r"^Dose\(s\)$", re.I),
    re.compile(r"^Direction\(s\) for use", re.I),
    re.compile(r"^Duration\(s\) of Use", re.I),
    re.compile(r"^Risk Information$", re.I),
    re.compile(r"^Caution\(s\) and warning\(s\)$", re.I),
    re.compile(r"^Contraindication\(s\)$", re.I),
    re.compile(r"^Known adverse reaction\(s\)$", re.I),
    re.compile(r"^References?$", re.I),
    re.compile(r"^Route of Administration$", re.I),
    re.compile(r"^Dosage Form\(s\)$", re.I),
    re.compile(r"^Monograph combination guide$", re.I),
    re.compile(r"^Non-medicinal ingredients$", re.I),
    re.compile(r"^Storage conditions?$", re.I),
    re.compile(r"^Specifications?$", re.I),
    re.compile(r"^Example product", re.I),
    re.compile(r"^Date$", re.I),
    re.compile(r"^Subpopulation\(s\)$", re.I),
    re.compile(r"^Quantity\(ies\)$", re.I),
    re.compile(r"^Notes?$", re.I),
]

HC_CLEAN_DROP = re.compile(
    r"^(?:\(PDF Version|This monograph is intended to serve as a guide|Table \d+|Notes?$|Must |Non-medicinal|Storage conditions?|Specifications?|Example product|Products making|All products$|All uses$|For multi-ingredient|To prevent the product|When ALL of|Subpopulation\(s\)$|Quantity\(ies\)$|Methods of preparation)",
    re.I,
)


def parse_hc_html(raw_html: str):
    m = re.search(r"<main[\s\S]*?</main>", raw_html, re.I)
    body = m.group(0) if m else raw_html
    for tag in ("script", "style", "select", "option", "nav", "footer", "form", "svg"):
        body = re.sub(rf"<{tag}[\s\S]*?</{tag}>", " ", body, flags=re.I)
    text = html_lib.unescape(re.sub(r"<[^>]+>", "\n", body))
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]

    def section(start_pat: str, end_pats, ignore_stops=()):
        start_re = re.compile(start_pat, re.I)
        start = next((i for i, l in enumerate(lines) if start_re.search(l)), -1)
        if start < 0:
            return []
        end = len(lines)
        stops = [re.compile(p, re.I) for p in end_pats] + [
            r for r in HC_STOP_RES if r.pattern not in ignore_stops
        ]
        for r in stops:
            idx = next((i for i in range(start + 1, len(lines)) if r.search(lines[i])), -1)
            if 0 <= idx < end:
                end = idx
        out = []
        for l in lines[start + 1 : end]:
            l = re.sub(r"^[-•*]\s*", "", l).strip()
            if l and not HC_CLEAN_DROP.search(l):
                out.append(l)
        return out

    uses = section(r"^Use\(s\) or Purpose\(s\)$", [r"^Dose\(s\)$", r"^Note"])
    doses = section(
        r"^Dose\(s\)$",
        [r"^Direction\(s\) for use", r"^Duration\(s\) of Use", r"^Risk Information$"],
        ignore_stops={r"^Subpopulation\(s\)$", r"^Quantity\(ies\)$", r"^Notes?$"},
    )
    cautions = section(r"^Caution\(s\) and warning\(s\)$", [r"^Contraindication\(s\)$"])
    contraindications = section(
        r"^Contraindication\(s\)$", [r"^Known adverse reaction\(s\)$", r"^References?$"]
    )
    adverse = section(r"^Known adverse reaction\(s\)$", [r"^References?$"])
    safety = list(dict.fromkeys([*cautions, *contraindications, *adverse]))
    return uses, doses, safety


def parse_ema_pdf(slug: str, url: str):
    EMA_CACHE.mkdir(parents=True, exist_ok=True)
    fname = url.split("/")[-1]
    if not fname.endswith(".pdf"):
        fname = f"{slug}.pdf"
    pdf_path = EMA_CACHE / fname
    if not pdf_path.exists() or pdf_path.stat().st_size < 10_000:
        import time

        last_err = None
        data = None
        for attempt in range(3):
            try:
                req = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": "HerbAlly/1.0 (+https://herbally.app)",
                        "Accept": "application/pdf",
                    },
                )
                with urllib.request.urlopen(req, timeout=25) as r:
                    data = r.read()
                if len(data) >= 10_000:
                    break
            except Exception as exc:
                last_err = exc
                time.sleep(1.5 * (attempt + 1))
        if not data or len(data) < 10_000:
            raise RuntimeError(str(last_err or "PDF too small"))
        pdf_path.write_bytes(data)

    res = subprocess.run(
        ["/opt/homebrew/bin/pdftotext", str(pdf_path), "-"],
        capture_output=True,
        text=True,
        timeout=25,
        check=True,
    )
    text = res.stdout
    if len(text.strip()) < 400:
        raise RuntimeError("Scanned or empty PDF text")

    def extract_sec(start_pat: str, end_pats):
        m = re.search(start_pat, text, re.I)
        if not m:
            return ""
        i = m.end()
        ends = []
        for ep in end_pats:
            em = re.search(ep, text[i:], re.I)
            if em:
                ends.append(i + em.start())
        j = min(ends) if ends else min(i + 2500, len(text))
        return re.sub(r"\s+", " ", text[i:j]).strip()

    ind_raw = extract_sec(r"4\.1\.?\s*Therapeutic indications", [r"4\.2\.?\s*Posology"])
    pos_raw = extract_sec(r"4\.2\.?\s*Posology(?:\s+and\s+method\s+of\s+administration)?", [r"4\.3\.?\s*Contraindications"])
    contra_raw = extract_sec(r"4\.3\.?\s*Contraindications", [r"4\.4\.?\s*Special warnings"])
    warn_raw = extract_sec(r"4\.4\.?\s*Special warnings(?:\s+and\s+precautions)?", [r"4\.5\.?\s*Interactions"])
    ix_raw = extract_sec(r"4\.5\.?\s*Interactions", [r"4\.6\.?\s*(?:Fertility|Pregnancy)"])
    preg_raw = extract_sec(r"4\.6\.?\s*(?:Fertility,\s*)?Pregnancy(?:\s+and\s+lactation)?", [r"4\.7\.?\s*Effects"])

    claims = []
    if ind_raw:
        ind_clean = re.sub(r"\b(Well-established use|Traditional use|Indication \d\))\b", " ", ind_raw)
        ind_clean = re.sub(r"\s+", " ", ind_clean).strip()
        if len(ind_clean) > 20:
            claims.append({"section": "4.1 Therapeutic indications", "text": ind_clean[:1200]})

    doses = []
    if pos_raw and len(pos_raw) > 20:
        doses.append(pos_raw[:1000])

    safety = []
    for label, chunk in [
        ("Contraindications (4.3)", contra_raw),
        ("Warnings & precautions (4.4)", warn_raw),
        ("Interactions (4.5)", ix_raw),
        ("Fertility, pregnancy & lactation (4.6)", preg_raw),
    ]:
        if chunk and len(chunk) > 15:
            safety.append(f"{label}: {chunk[:650]}")

    if not claims and not safety and not doses:
        raise RuntimeError("No structured sections extracted")

    return {
        "herb_slug": slug,
        "source": "European Medicines Agency (HMPC)",
        "licence": "EMA public document — reproduced with attribution",
        "attribution": EMA_ATTRIBUTION,
        "url": url,
        "claims": claims,
        "safety": safety,
        "doses": doses,
        "generation_method": "imported-ema-hmpc",
    }


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main():
    rows = []

    # 1. Health Canada cached HTMLs
    hc_count = 0
    for atid, slug in sorted(HC_EXTRA_MAP.items()):
        f = HC_CACHE / f"{atid}.html"
        if not f.exists():
            continue
        uses, doses, safety = parse_hc_html(f.read_text(encoding="utf-8", errors="ignore"))
        if not uses and not safety and not doses:
            continue
        rows.append(
            {
                "herb_slug": slug,
                "source": "Health Canada",
                "licence": "ogl-canada",
                "attribution": HC_ATTRIBUTION,
                "url": f"https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid={atid}&lang=eng",
                "claims": [{"section": "Use(s) or Purpose(s)", "text": u} for u in uses[:25]],
                "safety": safety[:30],
                "doses": doses[:25],
                "generation_method": "imported-ogl-canada",
            }
        )
        hc_count += 1

    # 2. EU EMA HMPC PDFs (sequential with gentle pause to avoid EMA 429s)
    ema_pairs = json.loads((ARTIFACTS / "ema-final-mapping.json").read_text(encoding="utf-8"))
    ema_count = 0
    ema_failures = []
    with ThreadPoolExecutor(max_workers=1) as pool:
        futs = {pool.submit(parse_ema_pdf, slug, url): (slug, url) for slug, url in ema_pairs}
        for fut in as_completed(futs):
            slug, url = futs[fut]
            try:
                rows.append(fut.result())
                ema_count += 1
            except Exception as exc:
                ema_failures.append((slug, str(exc)))

    # 3. Remaining NIH LiverTox records
    lt_data = json.loads((ARTIFACTS / "livertox-extracts.json").read_text(encoding="utf-8"))
    lt_count = 0
    by_name = {r.get("name"): r for r in lt_data["records"]}
    for lt_name, slug in LT_EXTRA_MAP.items():
        rec = by_name.get(lt_name)
        if not rec:
            continue
        hep = rec.get("hepatotoxicity") or []
        outc = rec.get("outcome") or []
        ltext = rec.get("likelihood_text")
        safety = []
        if ltext:
            safety.append(ltext)
        safety.extend(hep[:4])
        safety.extend(outc[:2])
        if not safety:
            continue
        slug_url = rec.get("url") or f"https://www.ncbi.nlm.nih.gov/books/n/livertox/{lt_name.replace(' ', '')}/"
        rows.append(
            {
                "herb_slug": slug,
                "source": "LiverTox",
                "licence": "public-domain-us-gov",
                "attribution": LIVERTOX_ATTRIBUTION,
                "url": slug_url,
                "claims": [],
                "safety": safety,
                "doses": [],
                "generation_method": "imported-livertox-nxml",
            }
        )
        lt_count += 1

    # Deduplicate (herb_slug, source) keeping richest
    dedup = {}
    for r in rows:
        k = (r["herb_slug"], r["source"])
        if k not in dedup:
            dedup[k] = r

    sql_lines = [
        "-- 2026-11-18 Real Official Monographs Import (Health Canada NHP, EU EMA HMPC, NIH LiverTox)",
        "-- Generated by scripts/import-remaining-monographs.py",
        "",
        "WITH src (herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method) AS (",
        "  VALUES",
    ]

    val_rows = []
    for r in dedup.values():
        val_rows.append(
            "  ("
            + ", ".join(
                [
                    sql_str(r["herb_slug"]),
                    sql_str(r["source"]),
                    sql_str(r["licence"]),
                    sql_str(r["attribution"]),
                    sql_str(r["url"]),
                    sql_str(json.dumps(r["claims"], ensure_ascii=False)) + "::jsonb",
                    sql_str(json.dumps(r["safety"], ensure_ascii=False)) + "::jsonb",
                    sql_str(json.dumps(r["doses"], ensure_ascii=False)) + "::jsonb",
                    sql_str(r["generation_method"]),
                ]
            )
            + ")"
        )

    sql_lines.append(",\n".join(val_rows))
    sql_lines.extend(
        [
            ")",
            "INSERT INTO public.herb_monograph_sources (",
            "  herb_slug, source, licence, attribution, url, claims, safety, doses, generation_method, retrieved_at",
            ")",
            "SELECT",
            "  s.herb_slug, s.source, s.licence, s.attribution, s.url, s.claims, s.safety, s.doses, s.generation_method, CURRENT_DATE",
            "FROM src s",
            "JOIN public.herbs h ON h.slug = s.herb_slug AND h.is_published = true",
            "ON CONFLICT (herb_slug, source) DO NOTHING;",
            "",
        ]
    )

    OUT_SQL.write_text("\n".join(sql_lines), encoding="utf-8")
    print(f"Health Canada parsed: {hc_count}")
    print(f"EMA HMPC PDFs parsed: {ema_count} (failures: {len(ema_failures)})")
    if ema_failures:
        print("EMA sample failures:", ema_failures[:10])
    print(f"LiverTox mapped: {lt_count}")
    print(f"Total unique (herb_slug, source) rows written to {OUT_SQL.name}: {len(dedup)}")


if __name__ == "__main__":
    main()
