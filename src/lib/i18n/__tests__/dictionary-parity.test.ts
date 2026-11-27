import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const EN_DIR = path.join(ROOT, "src/lib/i18n/dictionaries/en");
const FR_DIR = path.join(ROOT, "src/lib/i18n/dictionaries/fr");

function flattenKeys(
  node: unknown,
  prefix: string = ""
): Array<{ key: string; value: unknown }> {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return [{ key: prefix, value: node }];
  }
  const out: Array<{ key: string; value: unknown }> = [];
  for (const [k, v] of Object.entries(node)) {
    const nextKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flattenKeys(v, nextKey));
    } else {
      out.push({ key: nextKey, value: v });
    }
  }
  return out;
}

describe("A2: Complete EN/FR i18n dictionary key parity", () => {
  it("keeps identical namespace filenames across en and fr directories", () => {
    const enFiles = fs
      .readdirSync(EN_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort();
    const frFiles = fs
      .readdirSync(FR_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort();
    expect(enFiles).toEqual(frFiles);
    expect(enFiles.length).toBe(6);
  });

  it("maintains exact recursive leaf-key parity and non-empty strings across all 6 EN/FR dictionaries", () => {
    const files = fs
      .readdirSync(EN_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort();

    for (const file of files) {
      const enObj = JSON.parse(
        fs.readFileSync(path.join(EN_DIR, file), "utf8")
      ) as unknown;
      const frObj = JSON.parse(
        fs.readFileSync(path.join(FR_DIR, file), "utf8")
      ) as unknown;

      const enEntries = flattenKeys(enObj);
      const frEntries = flattenKeys(frObj);

      const enKeys = enEntries.map((e) => e.key).sort();
      const frKeys = frEntries.map((e) => e.key).sort();

      expect(frKeys, `Key mismatch in ${file}`).toEqual(enKeys);

      for (const entry of [...enEntries, ...frEntries]) {
        if (typeof entry.value === "string") {
          expect(
            entry.value.trim().length,
            `Empty string in ${file}: ${entry.key}`
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});
