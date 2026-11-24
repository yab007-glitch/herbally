# Task brief — HerbAlly performance, third pass (2026-11-24)

Repo `/Users/yasser/herbally`; production `https://herbally.app`. Follows
`docs/agent-tasks/2026-11-23-page-load-performance-2.md` (deployed `007a66a..bc4f45f`).

## Problem introduced by pass 2

Pass 2 removed two client chunks (Sentry 119 KB br, dictionaries 80 KB br) and cut TBT, but it
did so by passing **scoped message subsets as props**, which serializes them into the RSC/flight
payload. The bytes moved from a cached JS chunk into the per-page HTML document.

Measured live on the origin (cache-busted), pass 1 → pass 2:

| Page | HTML | Inline JS |
| --- | --- | --- |
| `/herbs/turmeric` | 195 → **221 KB** | 77 → **103 KB** |
| `/fr/herbs/turmeric` | 188 → **217 KB** | 68 → **98 KB** |
| `/herbs` | 234 → **252 KB** | 66 → **84 KB** |
| `/` | 71 → **81 KB** | 35 → **45 KB** |

Lighthouse improved anyway (turmeric 56→73, TBT 360→210 ms, total transfer −107 KB) because a
cached compressed chunk is cheaper than inline bytes. But HTML is render-blocking, uncompressed
per response, and not shared between pages, so this is the wrong side of the trade.

## Task — keep the chunk win, remove the payload cost

Move the client-visible messages out of serialized props and into **one shared, cacheable client
module** (or a small number of per-route-group modules) that the client imports directly.

Requirements:

- Client components must still resolve every key they use, in both locales.
- The message data must live in a **JS chunk that is cached across pages**, not in the flight
  payload of each response.
- Do not duplicate messages: one source of truth. If server and client both need a namespace,
  the client should import it rather than receive it as a prop.
- Do not reintroduce the full dictionary into the client bundle. Only the namespaces client
  components actually read.
- Keep the Sentry deferral from pass 2 untouched.

## Targets

- `/herbs/turmeric` HTML **back to ≤ 200 KB** (pass-1 level or better), inline JS ≤ 80 KB.
- `/` HTML **≤ 75 KB**, inline JS ≤ 36 KB.
- `/herbs` HTML **≤ 240 KB**.
- Total JS transfer must not grow by more than **+20 KB br** versus pass 2 (i.e. the moved
  messages must stay small and shared); ideally it grows by ~0 because the chunk is reused.
- Total transfer on the herb page stays at or below pass-2 (`~708 KB`) and improves if possible.
- Lighthouse mobile score on `/herbs/turmeric` ≥ 73 (pass 2), TBT ≤ 210 ms.

## Verification

- Both locales on `/`, `/fr`, `/herbs/turmeric`, `/fr/herbs/turmeric`, `/herbs`, `/fr/herbs`,
  `/symptoms`, `/interactions`, `/garden`, a 404 — assert **no `MISSING_MESSAGE` / `IntlError`**
  in console and that visible translated strings still render.
- Confirm the message chunk is **not** present in the HTML as inline JSON: grep the document for
  a distinctive translated string from a client component and assert it is absent (it should
  arrive via the chunk).
- Re-measure HTML, inline JS, chunk list with br sizes, Lighthouse (mobile) before/after.
- Purge Cloudflare only through the documented manual dashboard step and say so.

## Guardrails

- No copy, medical content, robots, review line, ads, consent or analytics changes.
- Do not raise the payload budget test; tighten it if the HTML comes down.
- `tsc --noEmit`, full `vitest run`, `eslint` on changed files, `prettier --check` before each
  commit. Small commits, push, verify live after deploy.
- Report exact before/after per page, where the messages now live, what it cost in JS, and the
  new residual bottleneck.
