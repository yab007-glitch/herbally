import { describe, expect, it } from "vitest";
import { decideDocumentNavigation } from "@/lib/ads/navigation";

const CURRENT = "https://herbally.app/herbs/ginger";

describe("decideDocumentNavigation", () => {
  it("never interferes while no ad script is active", () => {
    expect(
      decideDocumentNavigation({
        adActive: false,
        currentUrl: CURRENT,
        targetUrl: "https://herbally.app/herbalist",
      })
    ).toEqual({ force: false, reason: "inactive" });
  });

  it("forces a full document load for an internal route change", () => {
    const decision = decideDocumentNavigation({
      adActive: true,
      currentUrl: CURRENT,
      targetUrl: "https://herbally.app/herbalist",
    });
    expect(decision).toEqual({
      force: true,
      reason: "internal",
      href: "https://herbally.app/herbalist",
    });
  });

  it("forces the load for a relative href too", () => {
    const decision = decideDocumentNavigation({
      adActive: true,
      currentUrl: CURRENT,
      targetUrl: "/calculator",
    });
    expect(decision.force).toBe(true);
    expect(decision.href).toBe("https://herbally.app/calculator");
  });

  it("forces the load on a client link to another ad-eligible herb page", () => {
    // Even ad→ad must be a real document: the provider script was initialised
    // against one document and must not be re-pushed into another.
    expect(
      decideDocumentNavigation({
        adActive: true,
        currentUrl: CURRENT,
        targetUrl: "https://herbally.app/herbs/turmeric",
      }).force
    ).toBe(true);
  });

  it("leaves external links to the browser", () => {
    expect(
      decideDocumentNavigation({
        adActive: true,
        currentUrl: CURRENT,
        targetUrl: "https://pubmed.ncbi.nlm.nih.gov/1234/",
      })
    ).toEqual({
      force: false,
      reason: "external",
      href: "https://pubmed.ncbi.nlm.nih.gov/1234/",
    });
  });

  it("leaves in-page anchors alone", () => {
    expect(
      decideDocumentNavigation({
        adActive: true,
        currentUrl: CURRENT,
        targetUrl: "https://herbally.app/herbs/ginger#safety",
      })
    ).toEqual({
      force: false,
      reason: "same-document-hash",
      href: "https://herbally.app/herbs/ginger#safety",
    });
  });

  it("leaves a click on the current URL alone", () => {
    expect(
      decideDocumentNavigation({
        adActive: true,
        currentUrl: CURRENT,
        targetUrl: CURRENT,
      })
    ).toEqual({ force: false, reason: "same-url", href: CURRENT });
  });

  it("fails open on an unparseable target rather than trapping the click", () => {
    expect(
      decideDocumentNavigation({
        adActive: true,
        currentUrl: "not a url",
        targetUrl: "%%%",
      })
    ).toEqual({ force: false, reason: "external" });
  });
});
