#!/usr/bin/env node
/**
 * HerbAlly weekly traffic + funnel report.
 *
 * Data sources
 *  - Vercel Web Analytics via `vercel api` (uses the local Vercel CLI session;
 *    no token is stored in this repo).
 *  - Google Search Console, optional, via `--gsc-json <file>`. GSC has no
 *    unattended credential on this machine, so the section is filled from an
 *    explicit export instead of being invented. When it is missing the report
 *    says so and repeats the last verified snapshot.
 *
 * What the report is for
 *  HerbAlly's recorded traffic is dominated by China and Singapore with a
 *  bot-like pages-per-visitor pattern, so the raw visitor count is not an
 *  audience. This report separates the countries that plausibly contain
 *  readers (CA, FR, plus the rest of the human-looking tail) from the
 *  countries that look automated, and reports the funnel steps the site now
 *  records: page view → calculator / interaction / chat → outbound click.
 *
 * Known limitation
 *  The Web Analytics query API does not expose bounce rate. Bounce is a
 *  dashboard-only figure; this report prints pages/visitor (derived from
 *  visitors and pageviews) and leaves the dashboard number to the human
 *  reading it. It is never estimated here.
 *
 * Usage
 *   node scripts/analytics-weekly-report.mjs
 *   node scripts/analytics-weekly-report.mjs --days 30 --out ~/report.md
 *   node scripts/analytics-weekly-report.mjs --since 2026-08-01 --until 2026-09-01
 *   node scripts/analytics-weekly-report.mjs --gsc-json ~/gsc-export.json
 *   node scripts/analytics-weekly-report.mjs --bounce 87 --bounce-source "Vercel dashboard, 29 Sep-28 Oct"
 *
 * Bounce rate is dashboard-only: the query API's allowed dimensions do not
 * include it. Pass the figure you read on the dashboard with `--bounce` and the
 * report prints it with that provenance; without the flag it prints "not
 * measured" rather than guessing.
 *
 * Exit codes: 0 report written, 1 Vercel query failed, 2 bad arguments.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const PROJECT_ID =
  process.env.HERBALLY_VERCEL_PROJECT_ID ?? "prj_aGIptlSsD7vwSUwppdWJrL8mIe59";
const DEFAULT_OUT_DIR = path.join(homedir(), "HerbAlly-Outreach", "analytics");
const LAST_GSC_FILE = path.join(DEFAULT_OUT_DIR, "data", "gsc-latest.json");

/** Countries whose traffic is dominated by datacenter crawlers. */
const LIKELY_NON_HUMAN = new Set(["CN", "SG", "HK"]);
/** Countries the owner's market actually is: Canada first, France for FR SEO. */
const PRIMARY_MARKETS = new Set(["CA", "FR"]);
/** Below this pages/visitor, a country's "visitors" look like one-shot fetches. */
const BOT_PAGES_PER_VISITOR = 1.25;

const FUNNEL_EVENTS = [
  "calculator_used",
  "interaction_checked",
  "chat_message_sent",
  "outbound_click",
];

/**
 * Events that exist to prove the pipeline, not to measure readers. They are
 * excluded from the funnel and from the product-event headline so a probe can
 * never be mistaken for a visitor action.
 */
const NON_PRODUCT_EVENTS = new Set(["hermes_pipeline_probe"]);

function parseArgs(argv) {
  const args = {
    days: 7,
    gsc: null,
    out: null,
    since: null,
    until: null,
    bounce: null,
    bounceSource: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = () => argv[++i];
    switch (flag) {
      case "--days":
        args.days = Number(next());
        break;
      case "--since":
        args.since = next();
        break;
      case "--until":
        args.until = next();
        break;
      case "--gsc-json":
        args.gsc = next();
        break;
      case "--bounce":
        args.bounce = Number(next());
        break;
      case "--bounce-source":
        args.bounceSource = next();
        break;
      case "--out":
        args.out = next();
        break;
      case "--help":
      case "-h":
        console.log(
          "node scripts/analytics-weekly-report.mjs [--days N] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--gsc-json FILE] [--bounce PCT] [--bounce-source TEXT] [--out FILE]"
        );
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${flag}`);
        process.exit(2);
    }
  }
  return args;
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

/** Window is expressed in whole UTC days so runs are reproducible. */
function resolveWindow(args) {
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const until = args.until
    ? new Date(`${args.until}T00:00:00.000Z`)
    : new Date(todayUtc);
  const since = args.since
    ? new Date(`${args.since}T00:00:00.000Z`)
    : new Date(until.getTime() - args.days * 86_400_000);
  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) {
    console.error("Invalid --since/--until; expected YYYY-MM-DD");
    process.exit(2);
  }
  if (since >= until) {
    console.error("--since must be before --until");
    process.exit(2);
  }
  return { since, until };
}

function vercelApi(endpoint, params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    // The query API validates each `by` item separately, so an array must be
    // repeated (`by=eventName&by=environment`), never comma-joined.
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }
  const url = `/v1/query/web-analytics/${endpoint}?${search.toString()}`;
  const raw = execFileSync("vercel", ["api", url], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024,
  });
  // The CLI may prefix a beta notice line; the JSON body starts at the first "{"
  const json = raw.slice(raw.indexOf("{"));
  return JSON.parse(json);
}

function safeAggregate(dataset, params) {
  try {
    return vercelApi(`${dataset}/aggregate`, params).data ?? [];
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
}

function pct(part, whole) {
  if (!whole) return "—";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function num(value) {
  return Number(value ?? 0).toLocaleString("en-CA");
}

function table(headers, rows) {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `|${headers.map(() => "---").join("|")}|`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return [head, sep, body].filter(Boolean).join("\n");
}

function readGsc(file) {
  if (!file || !existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const rows = parsed.rows ?? parsed;
    if (!Array.isArray(rows)) return null;
    const totals = rows.reduce(
      (acc, row) => {
        const [clicks = 0, impressions = 0, ctr = 0, position = 0] = row;
        acc.clicks += Number(clicks);
        acc.impressions += Number(impressions);
        acc.ctrWeighted += Number(ctr) * Number(impressions);
        acc.positionWeighted += Number(position) * Number(impressions);
        return acc;
      },
      { clicks: 0, impressions: 0, ctrWeighted: 0, positionWeighted: 0 }
    );
    return {
      rows,
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr: totals.impressions ? totals.ctrWeighted / totals.impressions : 0,
      position: totals.impressions
        ? totals.positionWeighted / totals.impressions
        : 0,
      capturedAt: parsed.capturedAt ?? null,
      window: parsed.window ?? null,
      note: parsed.note ?? null,
      source: file,
    };
  } catch {
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { since, until } = resolveWindow(args);
  const sinceIso = `${isoDay(since)}T00:00:00.000Z`;
  const untilIso = `${isoDay(until)}T00:00:00.000Z`;
  const days = Math.round((until - since) / 86_400_000);

  if (
    args.bounce !== null &&
    (!Number.isFinite(args.bounce) || args.bounce < 0 || args.bounce > 100)
  ) {
    console.error("--bounce must be a number between 0 and 100");
    process.exit(2);
  }

  let totals;
  try {
    totals = vercelApi("visits/count", {
      projectId: PROJECT_ID,
      since: sinceIso,
      until: untilIso,
    }).data;
  } catch (error) {
    console.error(
      "Vercel query failed. Is the CLI logged in (`vercel whoami`) and is Web Analytics enabled?\n" +
        String(error?.message ?? error)
    );
    process.exit(1);
  }

  const countries = safeAggregate("visits", {
    projectId: PROJECT_ID,
    since: sinceIso,
    until: untilIso,
    by: "country",
    limit: 100,
  });
  const paths = safeAggregate("visits", {
    projectId: PROJECT_ID,
    since: sinceIso,
    until: untilIso,
    by: "requestPath",
    limit: 25,
  });
  const referrers = safeAggregate("visits", {
    projectId: PROJECT_ID,
    since: sinceIso,
    until: untilIso,
    by: "referrerHostname",
    limit: 15,
  });
  const byDay = safeAggregate("visits", {
    projectId: PROJECT_ID,
    since: sinceIso,
    until: untilIso,
    by: "day",
    limit: 100,
  });
  const events = safeAggregate("events", {
    projectId: PROJECT_ID,
    since: sinceIso,
    until: untilIso,
    by: "eventName",
    limit: 25,
  });
  const caPaths = safeAggregate("visits", {
    projectId: PROJECT_ID,
    since: sinceIso,
    until: untilIso,
    by: "requestPath",
    filter: "country eq 'CA'",
    limit: 10,
  });

  const countryRows = Array.isArray(countries) ? countries : [];
  const eventRows = Array.isArray(events) ? events : [];
  const productEventRows = eventRows.filter(
    (row) => !NON_PRODUCT_EVENTS.has(row.eventName)
  );
  const probeRows = eventRows.filter((row) =>
    NON_PRODUCT_EVENTS.has(row.eventName)
  );
  const eventCount = (name) =>
    productEventRows
      .filter((row) => row.eventName === name)
      .reduce((sum, row) => sum + Number(row.count ?? row.visitors ?? 0), 0);

  const visitors = Number(totals?.visitors ?? 0);
  const pageviews = Number(totals?.pageviews ?? 0);

  const nonHuman = countryRows.filter((row) =>
    LIKELY_NON_HUMAN.has(row.country)
  );
  const nonHumanVisitors = nonHuman.reduce(
    (sum, row) => sum + Number(row.visitors ?? 0),
    0
  );
  const humanVisitors = visitors - nonHumanVisitors;
  const ca = countryRows.find((row) => row.country === "CA");
  const fr = countryRows.find((row) => row.country === "FR");

  const gsc = readGsc(args.gsc) ?? readGsc(LAST_GSC_FILE);

  const lines = [];
  lines.push(`# HerbAlly — ${days}-day traffic and funnel report`);
  lines.push("");
  lines.push(
    `Window: **${isoDay(since)} → ${isoDay(until)}** (${days} days, UTC). Generated ${new Date().toISOString()} by \`scripts/analytics-weekly-report.mjs\`.`
  );
  lines.push("");
  lines.push("## 1. Headline");
  lines.push("");
  lines.push(
    table(
      ["Metric", "Value"],
      [
        ["Page views", `**${num(pageviews)}**`],
        ["Visitors (recorded)", `**${num(visitors)}**`],
        [
          "Page views / visitor",
          visitors ? (pageviews / visitors).toFixed(2) : "—",
        ],
        [
          "Visitors in likely-bot countries (CN, SG, HK)",
          `${num(nonHumanVisitors)} (${pct(nonHumanVisitors, visitors)})`,
        ],
        [
          "Visitors outside those countries",
          `${num(humanVisitors)} (${pct(humanVisitors, visitors)})`,
        ],
        [
          "Canada visitors",
          ca ? `**${num(ca.visitors)}** (${pct(ca.visitors, visitors)})` : "0",
        ],
        [
          "France visitors",
          fr ? `**${num(fr.visitors)}** (${pct(fr.visitors, visitors)})` : "0",
        ],
        [
          "Custom events recorded",
          `**${num(productEventRows.reduce((sum, row) => sum + Number(row.count ?? 0), 0))}**`,
        ],
        [
          "Bounce rate",
          Number.isFinite(args.bounce) && args.bounce !== null
            ? `${args.bounce}% (dashboard)`
            : "not measured — dashboard-only field",
        ],
      ]
    )
  );
  lines.push("");
  if (Number.isFinite(args.bounce) && args.bounce !== null) {
    lines.push(
      `> Bounce read from the Vercel dashboard${args.bounceSource ? ` (${args.bounceSource})` : ""}. The query API does not expose bounce, so this figure is operator-supplied, not computed here.`
    );
  } else {
    lines.push(
      "> The Web Analytics query API does not expose bounce rate. Read it on the dashboard and re-run with `--bounce <pct>` to record it; this report never estimates it."
    );
  }
  lines.push("");
  lines.push("## 2. Which traffic looks human");
  lines.push("");
  lines.push(
    "Heuristic: a country is flagged **likely non-human** when it is a known datacenter/crawler origin (CN, SG, HK). Other countries are labelled **low engagement** when their pages/visitor is below " +
      `${BOT_PAGES_PER_VISITOR} — a crawler fetches one URL and leaves, a reader clicks something — and **possible readers** above it.`
  );
  lines.push("");
  const topCountries = [...countryRows]
    .sort((a, b) => Number(b.visitors) - Number(a.visitors))
    .slice(0, 12);
  lines.push(
    table(
      ["Country", "Visitors", "Page views", "Pages/visitor", "Reading"],
      topCountries.map((row) => {
        const pv = Number(row.pageviews ?? 0);
        const vs = Number(row.visitors ?? 0);
        const ratio = vs ? pv / vs : 0;
        let label;
        if (PRIMARY_MARKETS.has(row.country)) label = "**primary market**";
        else if (LIKELY_NON_HUMAN.has(row.country)) label = "likely non-human";
        else if (ratio < BOT_PAGES_PER_VISITOR) label = "low engagement";
        else label = "possible readers";
        return [row.country, num(vs), num(pv), ratio.toFixed(2), label];
      })
    )
  );
  lines.push("");
  if (ca) {
    lines.push(
      `**Canada in detail** — ${num(ca.visitors)} visitors, ${num(ca.pageviews)} page views, ${(Number(ca.pageviews) / Number(ca.visitors || 1)).toFixed(2)} pages/visitor. A visitor who reads several pages is the only signal here that a Quebec sponsor would accept.`
    );
    lines.push("");
    if (Array.isArray(caPaths) && caPaths.length) {
      lines.push(
        table(
          ["Page (Canada)", "Visitors", "Page views"],
          caPaths.map((row) => [
            row.requestPath,
            num(row.visitors),
            num(row.pageviews),
          ])
        )
      );
      lines.push("");
    }
  }
  if (fr) {
    lines.push(
      `**France** — ${num(fr.visitors)} visitors, ${num(fr.pageviews)} page views, ${(Number(fr.pageviews) / Number(fr.visitors || 1)).toFixed(2)} pages/visitor. French pages are the second market; a change in FR visitors is the fastest read on any FR SEO fix.`
    );
    lines.push("");
  }
  lines.push("## 3. Top pages");
  lines.push("");
  if (Array.isArray(paths) && paths.length) {
    const orderedPaths = [...paths].sort((a, b) => {
      if (a.requestPath === "Others") return 1;
      if (b.requestPath === "Others") return -1;
      return Number(b.pageviews) - Number(a.pageviews);
    });
    lines.push(
      table(
        ["Page", "Page views", "Visitors"],
        orderedPaths.map((row) => [
          row.requestPath === "Others"
            ? "All other pages"
            : `\`${row.requestPath}\``,
          num(row.pageviews),
          num(row.visitors),
        ])
      )
    );
  } else {
    lines.push("_No page data returned._");
  }
  lines.push("");
  lines.push("## 4. Referrers");
  lines.push("");
  if (Array.isArray(referrers) && referrers.length) {
    lines.push(
      table(
        ["Referrer", "Visitors", "Page views"],
        referrers.map((row) => [
          row.referrerHostname === ""
            ? "Direct / unknown"
            : row.referrerHostname,
          num(row.visitors),
          num(row.pageviews),
        ])
      )
    );
    const searches = referrers
      .filter((row) =>
        /google|bing|duckduckgo|yahoo|ecosia|yandex|baidu|brave/.test(
          row.referrerHostname ?? ""
        )
      )
      .reduce((sum, row) => sum + Number(row.pageviews ?? 0), 0);
    lines.push("");
    lines.push(
      `Search referrals: **${num(searches)} page views (${pct(searches, pageviews)})**.`
    );
  } else {
    lines.push("_No referrer data returned._");
  }
  lines.push("");
  lines.push("## 5. Funnel");
  lines.push("");
  if (!productEventRows.length) {
    lines.push(
      "**No custom events in this window.** Either the analytics build is not deployed yet, or every visitor has been below the event thresholds. Event counts only exist after the deploy that ships `src/lib/analytics.ts`."
    );
    lines.push("");
    lines.push(
      table(
        ["Step", "Event", "Count"],
        FUNNEL_EVENTS.map((name) => ["—", `\`${name}\``, "0"])
      )
    );
  } else {
    lines.push(
      table(
        ["Step", "Event", "Count", "Per 1,000 page views"],
        FUNNEL_EVENTS.map((name) => {
          const count = eventCount(name);
          return [
            name === "calculator_used"
              ? "Tool used"
              : name === "interaction_checked"
                ? "Interaction data read"
                : name === "chat_message_sent"
                  ? "Chat question asked"
                  : "Outbound / donation click",
            `\`${name}\``,
            num(count),
            pageviews ? ((count / pageviews) * 1000).toFixed(1) : "—",
          ];
        })
      )
    );
    const extra = productEventRows
      .map((row) => row.eventName)
      .filter((name) => name && !FUNNEL_EVENTS.includes(name));
    if (extra.length) {
      lines.push("");
      lines.push(
        `Other events recorded: ${extra.map((name) => `\`${name}\``).join(", ")}.`
      );
    }
  }
  if (probeRows.length) {
    const probeCount = probeRows.reduce(
      (sum, row) => sum + Number(row.count ?? 0),
      0
    );
    lines.push("");
    lines.push(
      `> Excluded from the counts above: ${probeRows
        .map((row) => `\`${row.eventName}\``)
        .join(", ")} (${num(probeCount)}). It is a synthetic pipeline probe, not a visitor action.`
    );
  }
  lines.push("");
  lines.push("## 6. Search Console");
  lines.push("");
  if (gsc) {
    lines.push(
      table(
        ["Metric", "Value"],
        [
          ["Clicks", num(gsc.clicks)],
          ["Impressions", num(gsc.impressions)],
          ["CTR", `${(gsc.ctr * 100).toFixed(1)}%`],
          ["Average position", gsc.position.toFixed(1)],
        ]
      )
    );
    if (gsc.capturedAt) {
      lines.push("");
      lines.push(
        `GSC snapshot captured ${gsc.capturedAt}${gsc.window ? `, covering ${gsc.window}` : ""}, from ${gsc.source}.`
      );
    }
    if (gsc.note) {
      lines.push("");
      lines.push(`> ${gsc.note}`);
    }
    lines.push("");
    lines.push(
      "> Search Console lags 2–3 days, so its window rarely matches the analytics window. Treat this section as context, not as a like-for-like comparison."
    );
  } else {
    lines.push(
      "No GSC export supplied. Search Console has no unattended credential on this machine; run with `--gsc-json <export>` (rows of `[clicks, impressions, ctr, position]` or an API response with a `rows` array) to fill this section. It is left blank rather than estimated."
    );
  }
  lines.push("");
  lines.push("## 7. Daily page views");
  lines.push("");
  if (Array.isArray(byDay) && byDay.length) {
    lines.push(
      table(
        ["Day", "Page views", "Visitors"],
        byDay.map((row) => [
          String(row.timestamp).slice(0, 10),
          num(row.pageviews),
          num(row.visitors),
        ])
      )
    );
  } else {
    lines.push("_No daily data returned._");
  }
  lines.push("");
  lines.push("---");
  lines.push(
    "Analytics are first-party Vercel Web Analytics only: no third-party trackers, pixels or sponsor tags. Custom events carry an allowlisted classification and never health details, search text, message content or free text. Global Privacy Control, Do Not Track and the local opt-out all suppress page views and events alike."
  );
  lines.push("");

  const markdown = lines.join("\n");
  const outPath = args.out
    ? path.resolve(args.out.replace(/^~/, homedir()))
    : path.join(DEFAULT_OUT_DIR, `${isoDay(until)}-analytics-${days}d.md`);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, markdown, "utf8");

  // Keep the machine-readable roll-up next to the report for trend diffs.
  const dataDir = path.join(path.dirname(outPath), "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    path.join(dataDir, `${isoDay(until)}-${days}d.json`),
    JSON.stringify(
      {
        window: { since: isoDay(since), until: isoDay(until), days },
        totals: { visitors, pageviews },
        bounce: {
          percent:
            Number.isFinite(args.bounce) && args.bounce !== null
              ? args.bounce
              : null,
          source: args.bounceSource ?? null,
          measuredBy: "operator (Vercel dashboard)",
        },
        countries: countryRows,
        paths,
        referrers,
        events: eventRows,
        gsc,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(outPath);
}

main();
