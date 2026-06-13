import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import type {
  Root,
  Paragraph,
  Text,
  Link,
} from "mdast";
import { enrichTree } from "../enrichment";

/** Parse markdown to an mdast tree using the same remark-parse that ReactMarkdown uses internally. */
function parse(md: string): Root {
  return unified().use(remarkParse).parse(md) as Root;
}

/** Walk a tree and find every node whose `data.hProperties` carries the given key. */
function findByHProperty(
  tree: Root,
  key: string
): Array<{ value: unknown; node: unknown }> {
  const out: Array<{ value: unknown; node: unknown }> = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as {
      type?: string;
      data?: { hProperties?: Record<string, unknown> };
      children?: unknown[];
    };
    const v = node.data?.hProperties?.[key];
    if (v !== undefined) out.push({ value: v, node });
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(tree);
  return out;
}

/** Collect all link nodes in a tree. */
function collectLinks(tree: Root): Link[] {
  const out: Link[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; children?: unknown[] };
    if (node.type === "link") out.push(node as Link);
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(tree);
  return out;
}

/** Collect all paragraph nodes in a tree. */
function collectParagraphs(tree: Root): Paragraph[] {
  const out: Paragraph[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; children?: unknown[] };
    if (node.type === "paragraph") out.push(node as Paragraph);
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(tree);
  return out;
}

describe("remarkHerbAlly — PMID linkification", () => {
  it("rewrites PMID:12345 to a PubMed link node", () => {
    const tree = parse(
      "Curcumin may reduce inflammation. See PMID:32747204 for details."
    );
    enrichTree(tree);
    const links = collectLinks(tree);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe("https://pubmed.ncbi.nlm.nih.gov/32747204/");
    expect(links[0].title).toBe("PubMed ID 32747204");
    const text = (links[0].children[0] as Text).value;
    expect(text).toBe("PMID:32747204");
  });

  it("handles multiple PMIDs in the same paragraph", () => {
    const tree = parse("Evidence: PMID:12345 and PMID:67890, also PMID:11111.");
    enrichTree(tree);
    const links = collectLinks(tree);
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.url)).toEqual([
      "https://pubmed.ncbi.nlm.nih.gov/12345/",
      "https://pubmed.ncbi.nlm.nih.gov/67890/",
      "https://pubmed.ncbi.nlm.nih.gov/11111/",
    ]);
  });

  it("preserves surrounding text when splitting a text node", () => {
    const tree = parse("Before PMID:99999 after.");
    enrichTree(tree);
    const para = collectParagraphs(tree)[0];
    const types = para.children.map((c) => c.type);
    expect(types).toEqual(["text", "link", "text"]);
    const before = (para.children[0] as Text).value;
    const after = (para.children[2] as Text).value;
    expect(before).toBe("Before ");
    expect(after).toBe(" after.");
  });

  it("is a no-op when no PMID is present", () => {
    const tree = parse("Plain text with no citations here.");
    const before = JSON.stringify(tree);
    enrichTree(tree);
    expect(JSON.stringify(tree)).toBe(before);
  });

  it("matches PMIDs with 4-9 digits only (rejects 10+)", () => {
    const tree = parse("PMID:1234567890 should not match.");
    const _links = collectLinks(tree);
    enrichTree(tree);
    expect(collectLinks(tree)).toHaveLength(0);
    // Re-affirm original state by re-parsing.
    expect(tree).toBeTruthy();
  });

  it("matches the PMID with optional space after colon", () => {
    const tree = parse("PMID: 12345 works too.");
    enrichTree(tree);
    const links = collectLinks(tree);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe("https://pubmed.ncbi.nlm.nih.gov/12345/");
  });

  it("does NOT match when PMID is inside inline code", () => {
    const tree = parse("Use `PMID:12345` in code blocks.");
    enrichTree(tree);
    expect(collectLinks(tree)).toHaveLength(0);
  });
});

describe("remarkHerbAlly — evidence pill tagging", () => {
  it.each([
    ["Strong evidence", "strong"],
    ["Moderate evidence", "moderate"],
    ["Limited evidence", "limited"],
    ["Traditional use", "traditional"],
    ["Traditional use only", "traditional"],
  ])("tags '%s' strong as level '%s'", (phrase, expected) => {
    const tree = parse(`The claim is **${phrase}**.`);
    enrichTree(tree);
    const hits = findByHProperty(tree, "data-evidence-level");
    expect(hits).toHaveLength(1);
    expect(hits[0].value).toBe(expected);
  });

  it("ignores bolded phrases that are not evidence levels", () => {
    const tree = parse("This is **important** and **bold** but not evidence.");
    enrichTree(tree);
    expect(findByHProperty(tree, "data-evidence-level")).toHaveLength(0);
  });

  it("is case-insensitive on the evidence phrase", () => {
    const tree = parse("**STRONG EVIDENCE** supports this.");
    enrichTree(tree);
    const hits = findByHProperty(tree, "data-evidence-level");
    expect(hits).toHaveLength(1);
    expect(hits[0].value).toBe("strong");
  });

  it("does NOT tag strong inside code blocks", () => {
    const tree = parse("`**Strong evidence**` should be ignored.");
    enrichTree(tree);
    expect(findByHProperty(tree, "data-evidence-level")).toHaveLength(0);
  });
});

describe("remarkHerbAlly — interaction line detection", () => {
  it("tags a paragraph matching the interaction line shape", () => {
    const tree = parse("**St. John's Wort** + **Warfarin** → **Severe**");
    enrichTree(tree);
    const hits = findByHProperty(tree, "data-interaction");
    expect(hits).toHaveLength(1);
    const p = collectParagraphs(tree)[0];
    const props = (p.data?.hProperties ?? {}) as Record<string, string>;
    expect(props["data-interaction-herb"]).toBe("St. John's Wort");
    expect(props["data-interaction-drug"]).toBe("Warfarin");
    expect(props["data-interaction-severity"]).toBe("severe");
  });

  it.each(["Mild", "Moderate", "Severe", "Contraindicated"])(
    "recognises %s severity",
    (sev) => {
      const tree = parse(`**A** + **B** → **${sev}**`);
      enrichTree(tree);
      const props = (collectParagraphs(tree)[0].data?.hProperties ??
        {}) as Record<string, string>;
      expect(props["data-interaction-severity"]).toBe(sev.toLowerCase());
    }
  );

  it("ignores plain paragraphs that don't match", () => {
    const tree = parse("This is just a regular sentence about herbs.");
    enrichTree(tree);
    expect(findByHProperty(tree, "data-interaction")).toHaveLength(0);
  });

  it("ignores lines that look similar but lack the arrow", () => {
    const tree = parse("**A** + **B** together might be problematic.");
    enrichTree(tree);
    expect(findByHProperty(tree, "data-interaction")).toHaveLength(0);
  });
});

describe("remarkHerbAlly — identity transform on no-matches", () => {
  it("does not mutate a tree without any enriched patterns", () => {
    const tree = parse(
      "# Hello\n\nThis is a *regular* paragraph with **bold** and `code`."
    );
    const before = JSON.stringify(tree);
    enrichTree(tree);
    expect(JSON.stringify(tree)).toBe(before);
  });
});

describe("remarkHerbAlly — combined cases", () => {
  it("handles all three enrichments in one response", () => {
    const md = [
      "**St. John's Wort** + **Warfarin** → **Severe**",
      "",
      "Mechanism: induces CYP450 enzymes. Evidence: **Moderate evidence** from RCTs (PMID:12345).",
      "",
      "Avoid combination. **Strong evidence** for interaction risk (PMID:67890).",
    ].join("\n");
    const tree = parse(md);
    enrichTree(tree);
    expect(findByHProperty(tree, "data-interaction")).toHaveLength(1);
    expect(findByHProperty(tree, "data-evidence-level")).toHaveLength(2);
    expect(collectLinks(tree)).toHaveLength(2);
  });
});
