#!/usr/bin/env node
// Builds the human-evidence snippets file for the HerbAlly source licence
// audit (round 3 task D).
//
// For every saved text or HTML body in pages/, pages-round2/, pages-round3/
// and rendered-round3/, grep the raw file for licence-signalling phrases and
// emit a section per file with up to six matching sentences.
//
// Sentences are raw substrings of the saved files: HTML tags, entities and
// wording are left exactly as the server sent them. The only normalisation is
// collapsing whitespace runs to single spaces so a sentence can sit on its own
// line, and wrapping long lines at 400 characters.
//
// Usage: node scripts/probe-source-snippets.mjs

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROBE_DIR = join(REPO_ROOT, "artifacts/source-probes/2026-11-03");
const OUTPUT_PATH = join(PROBE_DIR, "snippets.md");

const SOURCE_DIRS = [
  "pages",
  "pages-round2",
  "pages-round3",
  "rendered-round3",
];

const PHRASES = [
  "public domain",
  "copyright",
  "licence",
  "license",
  "creative commons",
  "non-commercial",
  "all rights reserved",
  "terms of use",
  "attribution",
];
const PHRASE_RE = new RegExp(
  `\\b(?:${PHRASES.map((phrase) =>
    phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|")})\\b`,
  "i"
);

const MAX_SENTENCES = 6;
const WRAP_WIDTH = 400;
// A fragment longer than this is minified code/markup, not a sentence; skip it
// rather than pour megabytes of bundle into the evidence file.
const MAX_SENTENCE_CHARS = 4_000;

function isEvidenceFile(name) {
  return name.endsWith(".txt") || name.endsWith(".html");
}

async function collectFiles() {
  const files = [];
  for (const dirName of SOURCE_DIRS) {
    const dirPath = join(PROBE_DIR, dirName);
    let entries;
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }
    const inDir = [];
    for (const entry of entries) {
      if (!entry.isFile() || !isEvidenceFile(entry.name)) continue;
      inDir.push({
        label: `${dirName}/${entry.name}`,
        path: join(dirPath, entry.name),
      });
    }
    inDir.sort((a, b) => a.label.localeCompare(b.label));
    files.push(...inDir);
  }
  return files;
}

function collapseWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function matchingSentences(raw) {
  const matched = [];
  const seen = new Set();

  // Split on sentence-ending punctuation followed by whitespace. This is
  // deliberately mechanical: it is a grep, not a parser.
  for (const chunk of raw.split(/(?<=[.!?])\s+/)) {
    if (!PHRASE_RE.test(chunk)) continue;
    if (chunk.length > MAX_SENTENCE_CHARS) continue;
    const sentence = collapseWhitespace(chunk);
    if (!sentence || seen.has(sentence)) continue;
    seen.add(sentence);
    matched.push(sentence);
    if (matched.length >= MAX_SENTENCES) break;
  }

  return matched;
}

function wrap(text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (!line) {
      line = word;
    } else if (line.length + 1 + word.length <= width) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

async function main() {
  const files = await collectFiles();
  const sections = [
    "# Licence-signalling snippets",
    "",
    `Generated ${new Date().toISOString()} from the saved raw bodies under`,
    "`artifacts/source-probes/2026-11-03/`.",
    "",
    `Phrases matched (case-insensitive): ${PHRASES.join(", ")}.`,
    "Each sentence below is a raw substring of the saved file. Only runs of",
    "whitespace were collapsed and long lines wrapped at 400 characters; no",
    "text was reworded, decoded, or removed.",
    "",
  ];

  for (const file of files) {
    const raw = await readFile(file.path, "utf8");
    const sentences = matchingSentences(raw);

    sections.push(`## ${file.label}`, "");
    if (sentences.length === 0) {
      sections.push("_(no matching sentences)_", "");
      continue;
    }
    for (const sentence of sentences) {
      sections.push(wrap(sentence, WRAP_WIDTH), "");
    }
  }

  await writeFile(OUTPUT_PATH, `${sections.join("\n").trimEnd()}\n`);
  process.stdout.write(
    `Wrote ${relative(REPO_ROOT, OUTPUT_PATH)} (${files.length} files, ${sections.length} lines)\n`
  );
}

await main();
