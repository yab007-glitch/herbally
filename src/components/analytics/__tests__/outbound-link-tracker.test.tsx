import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { track } from "@vercel/analytics";
import { OutboundLinkTracker } from "../outbound-link-tracker";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

const trackMock = track as unknown as ReturnType<typeof vi.fn>;

function makeLink(href: string, dataset: Record<string, string> = {}) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.textContent = "link";
  for (const [key, value] of Object.entries(dataset)) {
    anchor.dataset[key] = value;
  }
  // Keep jsdom from attempting a real navigation before the default action.
  anchor.addEventListener("click", (event) => event.preventDefault());
  document.body.appendChild(anchor);
  return anchor;
}

beforeEach(() => {
  trackMock.mockReset();
  window.localStorage.clear();
  document.body.innerHTML = "";
});

describe("OutboundLinkTracker", () => {
  it("records an external click with the destination host only", () => {
    render(<OutboundLinkTracker />);
    const anchor = makeLink("https://example.org/some/page?ref=abc#frag");

    fireEvent.click(anchor);

    expect(trackMock).toHaveBeenCalledTimes(1);
    const [name, properties] = trackMock.mock.calls[0];
    expect(name).toBe("outbound_click");
    expect(properties).toEqual({ target: "external", host: "example.org" });
    // The path, query and fragment are deliberately absent.
    expect(JSON.stringify(properties)).not.toContain("ref=abc");
    expect(JSON.stringify(properties)).not.toContain("some/page");
  });

  it("ignores same-site links", () => {
    render(<OutboundLinkTracker />);
    const anchor = makeLink(`${window.location.origin}/herbs/berberine`);

    fireEvent.click(anchor);

    expect(trackMock).not.toHaveBeenCalled();
  });

  it("classifies a declared sponsor link as a sponsor click", () => {
    render(<OutboundLinkTracker />);
    const anchor = makeLink("https://sponsor.example/offer", {
      outboundTarget: "sponsor",
    });

    fireEvent.click(anchor);

    expect(trackMock).toHaveBeenCalledWith("outbound_click", {
      target: "sponsor",
      host: "sponsor.example",
    });
  });

  it("ignores modified clicks (new tab / download intent)", () => {
    render(<OutboundLinkTracker />);
    const anchor = makeLink("https://example.org/");

    fireEvent.click(anchor, { metaKey: true });

    expect(trackMock).not.toHaveBeenCalled();
  });

  it("sends nothing when analytics is denied", () => {
    Object.defineProperty(navigator, "globalPrivacyControl", {
      value: true,
      configurable: true,
    });
    render(<OutboundLinkTracker />);
    const anchor = makeLink("https://example.org/");

    fireEvent.click(anchor);

    expect(trackMock).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "globalPrivacyControl", {
      value: false,
      configurable: true,
    });
  });
});
