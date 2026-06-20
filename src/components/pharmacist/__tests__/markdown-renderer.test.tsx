import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMarkdown } from "../markdown-renderer";

// Mock next-intl so useTranslations is a passthrough.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("ChatMarkdown", () => {
  it("renders plain markdown without errors", () => {
    const { container } = render(
      <ChatMarkdown>{"Hello **world**."}</ChatMarkdown>
    );
    expect(container.textContent).toContain("Hello");
    expect(container.textContent).toContain("world");
  });

  it("renders PMID:NNN as a real PubMed link", () => {
    render(<ChatMarkdown>{"See PMID:32747204 for details."}</ChatMarkdown>);
    const link = screen.getByRole("link", { name: /PMID:32747204/ });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe(
      "https://pubmed.ncbi.nlm.nih.gov/32747204/"
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("renders the Strong evidence bold as a colored badge", () => {
    const { container } = render(
      <ChatMarkdown>{"The claim is **Strong evidence**."}</ChatMarkdown>
    );
    // The bolded phrase becomes a badge (renders as a span with the grade letter).
    // EvidenceGradeBadge renders the level letter ("A") inside a Badge.
    expect(container.textContent).toContain("A");
  });

  it("renders the interaction line as a styled card", () => {
    const { container } = render(
      <ChatMarkdown>
        {"**St. John's Wort** + **Warfarin** → **Severe**"}
      </ChatMarkdown>
    );
    // The interaction card should contain the herb, drug, and severity word.
    expect(container.textContent).toContain("St. John's Wort");
    expect(container.textContent).toContain("Warfarin");
    expect(container.textContent).toContain("interactions.severity.severe");
  });

  it("does not break on plain text without enrichments", () => {
    const { container } = render(
      <ChatMarkdown>{"Just a regular sentence."}</ChatMarkdown>
    );
    expect(container.textContent).toBe("Just a regular sentence.");
  });

  it("does not enrich a PMID inside inline code", () => {
    const { container } = render(
      <ChatMarkdown>{"Use `PMID:12345` in code."}</ChatMarkdown>
    );
    // Inside <code>PMID:12345</code>, no link should be produced.
    const codeEl = container.querySelector("code");
    expect(codeEl).toBeTruthy();
    expect(codeEl?.textContent).toContain("PMID:12345");
    const links = container.querySelectorAll(
      'a[href*="pubmed.ncbi.nlm.nih.gov"]'
    );
    expect(links).toHaveLength(0);
  });
});
