# SEO performance baseline — 2026-11-02

Measured from the local machine against production with the Chromium that the
e2e suite already installs (`scripts/seo-perf-baseline.mjs`, 1280×900,
`networkidle`). Not PageSpeed Insights — that needs a key and a queue, and these
numbers answer the same question for the pages the brief names.

| Page                              | Status | Load (networkidle) | FCP    | LCP    | CLS    | Bytes  | Text chars | "Loading…" first paint |
| --------------------------------- | ------ | ------------------ | ------ | ------ | ------ | ------ | ---------- | ---------------------- |
| `/`                               | 200    | 1118 ms            | 96 ms  | 120 ms | 0      | 218 KB | 2107       | no                     |
| `/herbs/turmeric`                 | 200    | 1020 ms            | 108 ms | 108 ms | 0      | 219 KB | 6403       | no                     |
| `/interactions/turmeric/warfarin` | 200    | 1047 ms            | 144 ms | 144 ms | 0      | 219 KB | 2984       | no                     |
| `/symptoms/anxiety`               | 200    | 1122 ms            | 148 ms | 148 ms | 0      | 219 KB | 11215      | no                     |
| `/fr/herbs/turmeric`              | 200    | 1634 ms            | 104 ms | 104 ms | 0.0325 | 217 KB | 6119       | no                     |

## What this says

- **Four of five pages are comfortably inside the "good" band** (LCP under
  1 s, CLS ≈ 0).
- **`/interactions/turmeric/warfarin` cold, before the warm-up, measured 2.8 s
  LCP with a 2.7 s FCP; the same page warm measures ~0.34 s.** That is the
  signature of a cold ISR render — the route prerenders nothing at build and
  pays the database on first request — not a front-end problem. The table above
  is warm state; the cold number is the one a first visitor (and Googlebot on
  its first fetch) sees, so it is worth watching in field data.
- **Server-rendered text is present on all five** (2,000–11,000 characters in
  `innerText` before any interaction), which is what "no Loading… for a
  crawler" actually requires. Nothing here first-renders as a spinner.
- The byte column counts only responses that advertise a `Content-Length`; it is
  a floor, not a total. Treat it as a relative size signal, not page weight.
- The "Load" column is wall time to `networkidle` from this machine, not
  server-side TTFB. It includes analytics and font requests, so it overstates
  server latency.

## Not measured here

- INP needs real interaction traces from field data; lab INP on a static read is
  not meaningful.
- Mobile (390×844) layout was checked separately during the design work
  (`scrollWidth === clientWidth` assertions), not re-run here.
