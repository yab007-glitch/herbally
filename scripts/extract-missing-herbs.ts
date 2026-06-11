import * as fs from "fs";

const seedContent = fs.readFileSync("supabase/migrations/00015_seed_herbs.sql", "utf-8");

const MISSING_SLUGS = new Set([
  "turmeric", "echinacea", "st-johns-wort", "ginkgo-biloba", "garlic",
  "valerian", "peppermint", "aloe-vera", "ginseng", "green-tea",
  "black-cohosh", "saw-palmetto", "licorice-root", "passionflower",
  "rhodiola", "holy-basil", "dong-quai", "dandelion", "red-clover",
  "cranberry", "oregano", "rosemary", "thyme", "sage", "fenugreek",
  "neem", "spirulina", "chlorella", "tribulus", "cordyceps",
  "turkey-tail", "kava", "marshmallow-root", "mullein", "boswellia",
  "devils-claw", "willow-bark", "butterbur", "yarrow", "eleuthero",
  "american-ginseng", "schisandra", "bacopa", "calendula", "tea-tree",
  "witch-hazel", "horse-chestnut", "gymnema", "meadowsweet", "plantain",
  "milk-vetch", "white-willow", "uva-ursi", "andrographis", "coleus",
  "clove", "artichoke", "black-walnut", "tongkat-ali", "wormwood",
  "sambucol", "nettle-root",
]);

// Split on INSERT INTO public.herbs
const parts = seedContent.split(/INSERT INTO public\.herbs\s*\(/);

let output = `-- ============================================================================
-- MIGRATION 00029: Add 62 missing key medicinal herbs to production DB
-- ============================================================================
-- These herbs are from the original seed file (00015) but were never applied
-- to the production database. The production DB was populated by AI bulk
-- generation which used botanical Latin names, missing these common-name herbs.
--
-- Each INSERT uses ON CONFLICT (slug) DO NOTHING so it's safe to re-run.
-- ============================================================================

`;

let totalAdded = 0;

for (let i = 1; i < parts.length; i++) {
  const block = parts[i];
  
  const columnsEnd = block.indexOf(') VALUES');
  if (columnsEnd < 0) continue;
  const columns = block.substring(0, columnsEnd).trim();
  
  const valuesStart = block.indexOf('VALUES\n');
  if (valuesStart < 0) continue;
  
  let valuesSection = block.substring(valuesStart + 7);
  valuesSection = valuesSection.replace(/;\s*$/, '').trim();
  
  // Parse rows using parenthesis depth tracking
  const rows: string[] = [];
  let depth = 0;
  let currentRow = '';
  let inString = false;
  
  for (let j = 0; j < valuesSection.length; j++) {
    const ch = valuesSection[j];
    
    if (ch === "'" && (j === 0 || valuesSection[j-1] !== '\\')) {
      inString = !inString;
      currentRow += ch;
      continue;
    }
    
    if (!inString) {
      if (ch === '(') {
        if (depth === 0 && currentRow.trim()) {
          rows.push(currentRow.trim());
          currentRow = '';
        }
        depth++;
        currentRow += ch;
      } else if (ch === ')') {
        depth--;
        currentRow += ch;
        if (depth === 0) {
          rows.push(currentRow.trim());
          currentRow = '';
          // Skip comma and whitespace
          while (j + 1 < valuesSection.length && /[\s,]/.test(valuesSection[j + 1])) {
            j++;
          }
        }
      } else {
        currentRow += ch;
      }
    } else {
      currentRow += ch;
    }
  }
  if (currentRow.trim()) rows.push(currentRow.trim());
  
  // Filter to missing herbs
  const missingRows: string[] = [];
  for (const row of rows) {
    // Slug is 3rd value: gen_random_uuid(), 'Name', 'slug',
    const slugMatch = row.match(/gen_random_uuid\(\),\s*'[^']*',\s*'([a-z0-9-]+)'/);
    if (slugMatch && MISSING_SLUGS.has(slugMatch[1])) {
      missingRows.push(row);
    }
  }
  
  if (missingRows.length > 0) {
    output += `INSERT INTO public.herbs (\n  ${columns}\n) VALUES\n`;
    output += missingRows.join(',\n');
    output += '\nON CONFLICT (slug) DO NOTHING;\n\n';
    totalAdded += missingRows.length;
    console.log(`Block ${i}: added ${missingRows.length} herbs`);
  }
}

console.log(`\nTotal herbs added: ${totalAdded}`);
fs.writeFileSync("supabase/migrations/00029_add_missing_seed_herbs.sql", output);
console.log("Written to supabase/migrations/00029_add_missing_seed_herbs.sql");
