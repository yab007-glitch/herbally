import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const DICT_ROOT = path.join(process.cwd(), "src/lib/i18n/dictionaries");

const BANNED_COPY_PATTERNS: RegExp[] = [
  /\bCalculate safe dosages\b/i,
  /\bCalculez les posologies s[uû]rs\b/i,
  /\bposologie s[uû]re\b/i,
  /\bevidence-based formulas\b/i,
  /\bHow to calculate child dosage\b/i,
  /\bComment calculer le dosage pour enfant\b/i,
  /\bclinically reviewed\b/i,
  /\bHIPAA[- ]compliant\b/i,
  /\bweight-scaled estimates\b/i,
  /\bdose ajustée au poids\b/i,
  /\bsupports Clark's Rule\b/i,
  /\bpropose la R[eè]gle de Clark\b/i,
  /\bAdults, age-based reference\b/i,
  /\bAdults when height and weight are known\b/i,
  /\bAdultes, référence basée sur l'âge\b/i,
  /\bAdultes lorsque la taille et le poids sont connus\b/i,
  /\bAdult Reference Doses by Weight\b/i,
  /\bClark's, Young's & BSA reference scaling\b/i,
  /\bformules de Clark, Young et surface corporelle\b/i,
  /\bReference dose based on weight ratio\b/i,
  /\bReference dose based on age ratio\b/i,
  /\bDose de référence basée sur le rapport de poids\b/i,
  /\bDose de référence basée sur le rapport d'âge\b/i,
  /\boptional, for BSA\b/i,
  /\bfacultatif, pour BSA\b/i,
];

function collectJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJsonFiles(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

describe("EN/FR dictionary false-authority & pediatric copy gate", () => {
  it("contains zero banned unsafe dosing or false clinical/compliance phrasing", () => {
    const files = collectJsonFiles(DICT_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const re of BANNED_COPY_PATTERNS) {
        if (re.test(content)) {
          violations.push(
            `${path.relative(process.cwd(), file)} matched ${re}`
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
