/**
 * Apply the staged herb slug renames in data/herb-slug-renames.json.
 *
 * A slug rename and its permanent redirect cannot both be live at once. While
 * the old row still exists, the old and new URLs both resolve; once the row
 * moves, the redirect must already point at a destination that exists. The
 * redirects are therefore activated only after this script has made every
 * destination row exist.
 *
 * The foreign key is the trap. herb_pubmed_monographs.slug references
 * herbs.slug with ON UPDATE NO ACTION, so Postgres rejects an update of the
 * parent slug while a child row still points at the old slug. This script
 * snapshots those child rows, deletes them, renames the parent, and re-inserts
 * them under the new slug. The snapshot is appended to
 * artifacts/slug-rename-pubmed-backup.json before anything is deleted.
 *
 * Dry run by default: the plan is read from the live database and nothing is
 * written. `--apply` is the only mode that writes. `--only` accepts a comma
 * separated list of source slugs, with or without the /herbs/ prefix. A second
 * run reports already-renamed and writes nothing.
 *
 * Usage:
 *   node scripts/apply-herb-slug-renames.mjs
 *   node scripts/apply-herb-slug-renames.mjs --only anthonota-macrophylla
 *   node scripts/apply-herb-slug-renames.mjs --apply
 *
 * Exit 1 = a guard failed, a write failed, or a post-write read-back disagreed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MANIFEST = join(ROOT, "data", "herb-slug-renames.json");
const BACKUP = join(ROOT, "artifacts", "slug-rename-pubmed-backup.json");
const APPLY = process.argv.includes("--apply");
const PUBMED = "herb_pubmed_monographs";
const IDENT = /^[a-z_][a-z0-9_]*$/;

/**
 * Every table that stores a herb slug. A rename must account for all of them,
 * even if the manifest entry forgets one, or the move leaves rows behind.
 */
const DEFAULT_DEPENDENTS = [
  { table: "herb_monographs", column: "herb_slug" },
  { table: PUBMED, column: "slug" },
  { table: "herb_regulatory_evidence", column: "herb_slug" },
  { table: "garden_herbs", column: "herb_slug" },
  { table: "herb_ratings", column: "herb_slug" },
];

const argVal = (f) => {
  const i = process.argv.indexOf(f);
  return i >= 0 ? process.argv[i + 1] : null;
};

const slugOf = (path) => String(path ?? "").replace(/^\/herbs\//, "");

const onlyArg = argVal("--only");
const ONLY = onlyArg
  ? new Set(
      onlyArg
        .split(",")
        .map((value) => slugOf(value.trim()))
        .filter(Boolean)
    )
  : null;

function env() {
  const out = {};
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split(
    "\n"
  )) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const e = env();
const HEAD = {
  apikey: e.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
};
const REST = `${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;

function assertEnv() {
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      ".env.local is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
}

function checkIdent(name) {
  if (!IDENT.test(name))
    throw new Error(`unsafe table or column name: ${name}`);
}

async function request(path, { label, ...options } = {}) {
  const res = await fetch(`${REST}${path}`, {
    ...options,
    headers: { ...HEAD, ...(options.headers || {}) },
  });
  if (!res.ok)
    throw new Error(`${label} failed: ${res.status} ${await res.text()}`);
  return res;
}

async function rowsOf(path, label) {
  const res = await request(path, { label });
  const rows = await res.json();
  if (!Array.isArray(rows))
    throw new Error(`${label} returned a non-array body`);
  return rows;
}

async function getHerbs(slug) {
  return rowsOf(
    `/herbs?slug=eq.${encodeURIComponent(slug)}&select=slug,scientific_name,name,is_published,updated_at`,
    `read ${slug}`
  );
}

async function countRows(table, column, slug) {
  checkIdent(table);
  checkIdent(column);
  const label = `count ${table}.${column}=${slug}`;
  const res = await request(
    `/${table}?select=${column}&${column}=eq.${encodeURIComponent(slug)}`,
    {
      label,
      headers: { Prefer: "count=exact", Range: "0-0" },
    }
  );
  const contentRange = res.headers.get("content-range") ?? "";
  const match = /\/(\d+)\s*$/.exec(contentRange);
  const total = match ? Number(match[1]) : NaN;
  if (!Number.isFinite(total)) {
    throw new Error(
      `${label} returned an invalid content-range header: ${JSON.stringify(contentRange)}`
    );
  }
  return total;
}

async function getFullRows(table, column, slug) {
  checkIdent(table);
  checkIdent(column);
  return rowsOf(
    `/${table}?${column}=eq.${encodeURIComponent(slug)}&select=*`,
    `snapshot ${table}.${column}=${slug}`
  );
}

async function deleteRows(table, column, slug) {
  const res = await request(
    `/${table}?${column}=eq.${encodeURIComponent(slug)}`,
    {
      method: "DELETE",
      label: `delete ${table}.${column}=${slug}`,
      headers: { Prefer: "return=representation" },
    }
  );
  const rows = await res.json();
  if (!Array.isArray(rows))
    throw new Error(
      `delete ${table}.${column}=${slug} returned a non-array body`
    );
  return rows;
}

async function renameHerb(fromSlug, toSlug) {
  const res = await request(`/herbs?slug=eq.${encodeURIComponent(fromSlug)}`, {
    method: "PATCH",
    label: `rename ${fromSlug}`,
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      slug: toSlug,
      updated_at: new Date().toISOString(),
    }),
  });
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].slug !== toSlug) {
    throw new Error(
      `rename ${fromSlug}: expected exactly 1 row carrying ${toSlug}, got ${JSON.stringify(rows)}`
    );
  }
  return rows[0];
}

async function moveDependents(table, deps, fromSlug, toSlug) {
  checkIdent(table);
  const patch = {};
  for (const dep of deps) {
    checkIdent(dep.column);
    patch[dep.column] = toSlug;
  }
  const filter =
    deps.length === 1
      ? `${deps[0].column}=eq.${encodeURIComponent(fromSlug)}`
      : `or=(${deps
          .map((dep) => `${dep.column}.eq.${encodeURIComponent(fromSlug)}`)
          .join(",")})`;
  const res = await request(`/${table}?${filter}`, {
    method: "PATCH",
    label: `move ${table} for ${fromSlug}`,
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });
  const rows = await res.json();
  if (!Array.isArray(rows))
    throw new Error(`move ${table} for ${fromSlug} returned a non-array body`);
  return rows;
}

async function insertRows(table, rows) {
  const res = await request(`/${table}`, {
    method: "POST",
    label: `re-insert ${table}`,
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });
  const out = await res.json();
  if (!Array.isArray(out))
    throw new Error(`re-insert ${table} returned a non-array body`);
  return out;
}

/** Fields whose JSON.stringify value differs, ignoring the named columns. */
function differingFields(snapshotRow, destRow, ignored) {
  const fields = new Set([
    ...Object.keys(snapshotRow),
    ...Object.keys(destRow),
  ]);
  const diffs = [];
  for (const field of [...fields].sort()) {
    if (ignored.has(field)) continue;
    if (JSON.stringify(snapshotRow[field]) !== JSON.stringify(destRow[field])) {
      diffs.push(field);
    }
  }
  return diffs;
}

function appendBackup(record) {
  mkdirSync(dirname(BACKUP), { recursive: true });
  const previous = existsSync(BACKUP)
    ? JSON.parse(readFileSync(BACKUP, "utf8"))
    : [];
  const list = Array.isArray(previous) ? previous : [];
  list.push(record);
  writeFileSync(BACKUP, JSON.stringify(list, null, 1));
}

function manifestEntries(manifest) {
  const entries = Array.isArray(manifest) ? manifest : manifest?.renames;
  if (!Array.isArray(entries))
    throw new Error("manifest has no top-level array or renames array");
  return entries;
}

/** Union of a manifest entry's dependent updates and the canonical tables. */
function dependentsFor(rename) {
  const byTable = new Map();
  for (const dep of [
    ...(rename.dependent_updates ?? []),
    ...DEFAULT_DEPENDENTS,
  ]) {
    if (!byTable.has(dep.table)) byTable.set(dep.table, dep);
  }
  return [...byTable.values()];
}

/**
 * Rename one pending herb. The pubmed children are removed before the parent
 * because the FK forbids the parent update while they still point at the old
 * slug; they are re-inserted with every other column preserved.
 */
async function applyRename(item) {
  const { rename, sourceSlug, destSlug } = item;
  const deps = dependentsFor(rename);
  const pubmedDeps = deps.filter((dep) => dep.table === PUBMED);
  if (pubmedDeps.length > 1)
    throw new Error(`multiple ${PUBMED} dependent updates`);
  const pubmedColumn = pubmedDeps[0]?.column ?? "slug";

  const snapshot = pubmedDeps.length
    ? await getFullRows(PUBMED, pubmedColumn, sourceSlug)
    : [];

  let childRowsDeleted = false;
  let parentRenamed = false;
  // Declared outside the try: the return statement reads them, so declaring these
  // inside the try block made every rename throw ReferenceError after the work was
  // already committed — the rename landed but the run reported a guard failure.
  let dependentRowsMoved = 0;
  const moved = new Map();
  try {
    if (snapshot.length) {
      appendBackup({
        created_at: new Date().toISOString(),
        from: sourceSlug,
        to: destSlug,
        rows: snapshot,
      });
      console.log(
        `[slugs] backup ${snapshot.length} ${PUBMED} row(s) for ${sourceSlug} -> ${BACKUP}`
      );

      const deleted = await deleteRows(PUBMED, pubmedColumn, sourceSlug);
      childRowsDeleted = true;
      if (deleted.length !== snapshot.length) {
        throw new Error(
          `deleted ${deleted.length} ${PUBMED} row(s) for ${sourceSlug}, expected ${snapshot.length}`
        );
      }
    }

    await renameHerb(sourceSlug, destSlug);
    parentRenamed = true;

    const byTable = new Map();
    for (const dep of deps) {
      if (dep.table === PUBMED) continue;
      const tableDeps = byTable.get(dep.table) || [];
      tableDeps.push(dep);
      byTable.set(dep.table, tableDeps);
    }

    for (const [table, tableDeps] of byTable) {
      const rows = await moveDependents(table, tableDeps, sourceSlug, destSlug);
      dependentRowsMoved += rows.length;
      moved.set(table, { count: rows.length, column: tableDeps[0].column });
    }

    if (snapshot.length) {
      const inserted = await insertRows(
        PUBMED,
        snapshot.map((row) => ({ ...row, [pubmedColumn]: destSlug }))
      );
      if (inserted.length !== snapshot.length) {
        throw new Error(
          `re-inserted ${inserted.length} ${PUBMED} row(s) for ${destSlug}, expected ${snapshot.length}`
        );
      }
      const destCount = await countRows(PUBMED, pubmedColumn, destSlug);
      if (destCount !== snapshot.length) {
        throw new Error(
          `${PUBMED} count at ${destSlug} is ${destCount}, expected ${snapshot.length}`
        );
      }
    }
  } catch (err) {
    if (childRowsDeleted) {
      // If the parent rename already committed, the FK now points at the new
      // slug; restoring the children under the old slug would violate it.
      const restoreSlug = parentRenamed ? destSlug : sourceSlug;
      try {
        const restored = await insertRows(
          PUBMED,
          snapshot.map((row) => ({ ...row, [pubmedColumn]: restoreSlug }))
        );
        console.error(
          `[slugs] restore attempted: re-inserted ${restored.length}/${snapshot.length} ${PUBMED} row(s) under ${restoreSlug} (parent rename ${parentRenamed ? "completed" : "did not complete"})`
        );
      } catch (restoreErr) {
        console.error(
          `[slugs] restore attempted: re-insert FAILED for ${PUBMED} under ${restoreSlug} (parent rename ${parentRenamed ? "completed" : "did not complete"}): ${restoreErr.message}`
        );
      }
    }
    throw err;
  }

  console.log(
    `[slugs] ${sourceSlug} -> ${destSlug} (${snapshot.length} child rows)`
  );
  return {
    rename,
    sourceSlug,
    destSlug,
    childRowsMoved: snapshot.length,
    dependentRowsMoved,
    moved,
    pubmedColumn,
    pubmedCounted: pubmedDeps.length > 0,
    snapshotCount: snapshot.length,
    snapshot,
  };
}

async function main() {
  assertEnv();
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const all = manifestEntries(manifest);
  const renames = ONLY
    ? all.filter((rename) => ONLY.has(slugOf(rename.from)))
    : all;

  console.log(
    `[slugs] ${renames.length} selected renames from ${MANIFEST}${APPLY ? "" : " (dry run)"}`
  );

  const failures = [];
  const plan = [];
  const dependentTables = [];

  if (ONLY) {
    for (const slug of ONLY) {
      if (!all.some((rename) => slugOf(rename.from) === slug)) {
        failures.push(`--only ${slug}: no manifest entry`);
      }
    }
  }

  for (const rename of renames) {
    if (
      !rename?.from ||
      !rename?.to ||
      !Array.isArray(rename.dependent_updates)
    ) {
      failures.push(`${rename?.from || "(unknown)"}: malformed manifest entry`);
      continue;
    }

    const sourceSlug = slugOf(rename.from);
    const destSlug = slugOf(rename.to);
    const [sourceRows, destRows] = await Promise.all([
      getHerbs(sourceSlug),
      getHerbs(destSlug),
    ]);
    const source = sourceRows[0] ?? null;
    const dest = destRows[0] ?? null;
    let state;
    let guardFailed = false;

    if (sourceRows.length > 1 || destRows.length > 1) {
      state = "conflict";
      guardFailed = true;
      failures.push(
        `${rename.from}: slug is not unique (source rows ${sourceRows.length}, destination rows ${destRows.length})`
      );
    } else if (source && !dest) {
      state = "pending";
    } else if (!source && dest) {
      state = "already-renamed";
    } else {
      state = "conflict";
      guardFailed = true;
      failures.push(
        `${rename.from}: state is conflict (source ${source ? "present" : "absent"}, destination ${dest ? "present" : "absent"})`
      );
    }

    if (
      source &&
      source.scientific_name !== rename.scientific_name_before &&
      source.scientific_name !== rename.scientific_name_after
    ) {
      guardFailed = true;
      failures.push(
        `${rename.from}: scientific_name is ${JSON.stringify(source.scientific_name)}, expected ${JSON.stringify(rename.scientific_name_before)} or ${JSON.stringify(rename.scientific_name_after)}`
      );
    }

    const counts = {};
    const listed = new Set(rename.dependent_updates.map((dep) => dep.table));
    for (const dep of dependentsFor(rename)) {
      if (!dependentTables.includes(dep.table)) dependentTables.push(dep.table);
      const count = await countRows(dep.table, dep.column, sourceSlug);
      counts[dep.table] = count;
      if (!listed.has(dep.table) && count > 0) {
        guardFailed = true;
        failures.push(
          `${rename.from}: unlisted dependent rows: ${dep.table} holds ${count} row(s) that the manifest does not migrate, so the run stops instead of orphaning them`
        );
      }
    }

    plan.push({
      rename,
      sourceSlug,
      destSlug,
      state,
      source,
      dest,
      counts,
      guardFailed,
      pubmedCount: counts[PUBMED] ?? 0,
    });
  }

  const table = plan.map((item) => {
    const row = {
      from: item.rename.from,
      to: item.rename.to,
      state: item.state,
      scientific_name:
        item.source?.scientific_name ?? item.dest?.scientific_name ?? "(none)",
    };
    for (const depTable of dependentTables) {
      row[depTable] = item.counts[depTable] ?? "-";
    }
    row.pubmed_action =
      item.state !== "pending"
        ? "-"
        : item.pubmedCount > 0
          ? "snapshot-delete-reinsert"
          : "none";
    return row;
  });

  console.table(table);

  let applied = 0;
  let childRowsMoved = 0;
  let dependentRowsMoved = 0;
  const touched = [];

  if (APPLY) {
    for (const item of plan) {
      if (item.guardFailed || item.state !== "pending") continue;
      try {
        const result = await applyRename(item);
        applied++;
        childRowsMoved += result.childRowsMoved;
        dependentRowsMoved += result.dependentRowsMoved;
        touched.push(result);
      } catch (err) {
        failures.push(`${item.rename.from}: ${err.message}`);
        if (item.pubmedCount > 0) console.error(`[slugs] backup: ${BACKUP}`);
        // Stop before the next rename: a partial move must not be compounded.
        break;
      }
    }

    for (const t of touched) {
      const destRows = await getHerbs(t.destSlug);
      const sourceRows = await getHerbs(t.sourceSlug);

      if (destRows.length !== 1) {
        failures.push(
          `${t.rename.from}: destination row ${t.destSlug} is missing after write`
        );
      } else if (
        destRows[0].scientific_name !== t.rename.scientific_name_after
      ) {
        failures.push(
          `${t.rename.from}: read-back scientific_name is ${JSON.stringify(destRows[0].scientific_name)}, expected ${JSON.stringify(t.rename.scientific_name_after)}`
        );
      }
      if (sourceRows.length !== 0) {
        failures.push(
          `${t.rename.from}: source row ${t.sourceSlug} still exists after write`
        );
      }

      for (const [depTable, { count, column }] of t.moved) {
        const actual = await countRows(depTable, column, t.destSlug);
        if (actual !== count) {
          failures.push(
            `${t.rename.from}: ${depTable} count at ${t.destSlug} is ${actual}, expected ${count} moved`
          );
        }
      }

      if (t.pubmedCounted) {
        const actual = await countRows(PUBMED, t.pubmedColumn, t.destSlug);
        if (actual !== t.snapshotCount) {
          failures.push(
            `${t.rename.from}: ${PUBMED} count at ${t.destSlug} is ${actual}, expected ${t.snapshotCount} unchanged`
          );
        }

        const destPubmed = await getFullRows(
          PUBMED,
          t.pubmedColumn,
          t.destSlug
        );
        const destById = new Map(destPubmed.map((row) => [row.id, row]));
        const ignored = new Set([t.pubmedColumn, "updated_at"]);
        t.snapshot.forEach((snapshotRow, index) => {
          const destRow = destById.get(snapshotRow.id) ?? destPubmed[index];
          if (!destRow) return;
          for (const field of differingFields(snapshotRow, destRow, ignored)) {
            failures.push(
              `${t.rename.from}: ${PUBMED}.${field} at ${t.destSlug} is ${JSON.stringify(destRow[field])}, expected snapshot ${JSON.stringify(snapshotRow[field])}`
            );
          }
        });
      }
    }
  }

  const mode = APPLY ? "applied" : "dry run";
  console.log(
    `[slugs] ${mode}: ${applied} applied renames, ${childRowsMoved} child rows moved, ${dependentRowsMoved} dependent rows moved, ${failures.length} guard failures`
  );

  if (failures.length) {
    console.error(`\n[slugs] FAIL - ${failures.length} guard failure(s)`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(
    `[slugs] OK - every touched row ${APPLY ? "re-read and matched" : "is safe to write"}`
  );
}

main().catch((err) => {
  console.error("[slugs] fatal:", err.message);
  process.exit(1);
});
