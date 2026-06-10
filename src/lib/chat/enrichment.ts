import type { Plugin } from "unified";
import type {
  Root,
  Text,
  Strong,
  Paragraph,
  Link,
  PhrasingContent,
  RootContent,
} from "mdast";
import type { Parent } from "unist";
import { visitParents, SKIP } from "unist-util-visit-parents";

/**
 * Evidence pill levels. Match the strings the system prompt instructs the model
 * to emit (system-prompt.ts:48-52).
 */
export type EvidenceLevel = "strong" | "moderate" | "limited" | "traditional";

const EVIDENCE_MAP: Record<string, EvidenceLevel> = {
  "strong evidence": "strong",
  "moderate evidence": "moderate",
  "limited evidence": "limited",
  "traditional use": "traditional",
  "traditional use only": "traditional",
};

const EVIDENCE_DATA_ATTR = "data-evidence-level";
const INTERACTION_DATA_ATTR = "data-interaction";
const PMID_DATA_ATTR = "data-pmid";

/**
 * Walk a paragraph's children. If the inline marks spell out
 *   **Herb** + **Drug** → **Severity**
 * then mark the paragraph so the ReactMarkdown `components` map renders it as
 * a styled interaction card.
 *
 * Positional groups (not named) so we stay compatible with the ES2017 target.
 */
const INTERACTION_LINE_RE =
  /^([^*]+?)\s*\+\s*([^*]+?)\s*→\s*(Mild|Moderate|Severe|Contraindicated)\b/i;

const SEVERITY_RE = /\b(Mild|Moderate|Severe|Contraindicated)\b/i;

type DataBag = { hProperties?: Record<string, unknown> };

function nodeData(node: { data?: DataBag }): DataBag {
  if (!node.data) {
    node.data = {};
  }
  return node.data;
}

function getText(node: PhrasingContent | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value;
  if (
    "children" in node &&
    Array.isArray((node as { children?: unknown[] }).children)
  ) {
    return (node as { children: PhrasingContent[] }).children
      .map((c) => getText(c))
      .join("");
  }
  return "";
}

function paragraphMatchesInteractionLine(p: Paragraph): boolean {
  if (p.children.length === 0) return false;
  // The interaction line shape is a whole-paragraph pattern. Concatenate all
  // inline children to get the plain text, then test against the regex.
  const fullText = p.children.map((c) => getText(c)).join("");
  return INTERACTION_LINE_RE.test(fullText.trimStart());
}

function markParagraphAsInteraction(p: Paragraph): void {
  const data = nodeData(p);
  const props = data.hProperties ?? (data.hProperties = {});
  props[INTERACTION_DATA_ATTR] = "true";
}

function extractInteractionParts(p: Paragraph): {
  herb: string;
  drug: string;
  severity: string;
} | null {
  const text = p.children.map((c) => getText(c)).join("");
  const m = INTERACTION_LINE_RE.exec(text);
  if (!m) return null;
  return {
    herb: m[1].trim(),
    drug: m[2].trim(),
    severity: m[3],
  };
}

function makePmidLink(pmid: string): Link {
  return {
    type: "link",
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    title: `PubMed ID ${pmid}`,
    data: {
      hProperties: {
        [PMID_DATA_ATTR]: pmid,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    },
    children: [{ type: "text", value: `PMID:${pmid}` }],
  };
}

const PMID_RE = /\bPMID:\s?(\d{4,9})\b/g;

/**
 * Replace `PMID:12345` substrings inside a text node with link nodes.
 * Splits a single text node into [textBefore, link, textAfter, link, ...] sequence.
 */
function splitTextOnPmid(text: Text): PhrasingContent[] {
  const value = text.value;
  PMID_RE.lastIndex = 0;
  if (!PMID_RE.test(value)) return [text];
  PMID_RE.lastIndex = 0;

  const out: PhrasingContent[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PMID_RE.exec(value)) !== null) {
    if (m.index > lastIndex) {
      out.push({ type: "text", value: value.slice(lastIndex, m.index) });
    }
    out.push(makePmidLink(m[1]));
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < value.length) {
    out.push({ type: "text", value: value.slice(lastIndex) });
  }
  return out;
}

function markStrongAsEvidence(s: Strong): void {
  const text = getText(s);
  const normalized = text.trim().toLowerCase();
  const level = EVIDENCE_MAP[normalized];
  if (!level) return;
  const data = nodeData(s);
  const props = data.hProperties ?? (data.hProperties = {});
  props[EVIDENCE_DATA_ATTR] = level;
}

function isInsideCode(ancestors: Parent[]): boolean {
  return ancestors.some(
    (p) => p && "type" in p && (p.type === "code" || p.type === "inlineCode")
  );
}

/**
 * remark plugin that walks the AST and:
 *   1. Splits text nodes containing `PMID:12345` into real link nodes.
 *   2. Marks `**Strong evidence**` / `**Moderate evidence**` / `**Limited evidence**` /
 *      `**Traditional use**` strong nodes with a data-attribute the renderer picks up.
 *   3. Marks paragraph nodes whose inline run is `**Herb** + **Drug** → **Severity**`
 *      with a data-attribute the renderer uses to emit a styled interaction card.
 *
 * Pure transform — no React, no DOM. Operates only on the mdast tree. Safe to run
 * on streaming output (idempotent on already-enriched trees: a second pass leaves
 * the markers alone because they live in data.hProperties, not in text values).
 */
export const remarkHerbAlly: Plugin<[], Root> = () => (tree) => {
  // 1) PMID linkification (and other text splits).
  visitParents(tree, "text", (node: Text, ancestors) => {
    if (isInsideCode(ancestors)) return;
    if (!/PMID:\s?\d/.test(node.value)) return;
    const parent = ancestors[ancestors.length - 1] as Parent & {
      children?: PhrasingContent[];
    };
    if (!parent || !Array.isArray(parent.children)) return;
    const idx = parent.children.indexOf(node as unknown as PhrasingContent);
    if (idx < 0) return;
    const replacement = splitTextOnPmid(node);
    parent.children.splice(idx, 1, ...replacement);
    return [SKIP, idx + replacement.length];
  });

  // 2) Evidence pill tagging.
  visitParents(tree, "strong", (node: Strong, ancestors) => {
    if (isInsideCode(ancestors)) return;
    const text = getText(node).trim().toLowerCase();
    if (EVIDENCE_MAP[text]) markStrongAsEvidence(node);
  });

  // 3) Interaction line detection on paragraphs.
  visitParents(tree, "paragraph", (node: Paragraph) => {
    if (!paragraphMatchesInteractionLine(node)) return;
    const text = node.children.map((c) => getText(c)).join("");
    if (!SEVERITY_RE.test(text)) return;
    const parts = extractInteractionParts(node);
    if (!parts) return;
    markParagraphAsInteraction(node);
    const data = nodeData(node);
    const props = data.hProperties!;
    props["data-interaction-herb"] = parts.herb;
    props["data-interaction-drug"] = parts.drug;
    props["data-interaction-severity"] = parts.severity.toLowerCase();
  });
};

/**
 * Test helper: run the plugin on a parsed mdast tree and return the new tree.
 * Kept separate from the plugin so unit tests can inspect intermediate states.
 */
export function enrichTree(tree: Root): Root {
  // The Plugin type expects the unified Transformer signature (tree, file, next).
  // Our body is sync and ignores file/next, so we cast to the loose shape.
  const factory = remarkHerbAlly as unknown as () => (t: Root) => void;
  factory()(tree);
  return tree;
}

export { remarkHerbAlly as default };
export type EnrichableRoot = Root;
export type EnrichableRootContent = RootContent;
