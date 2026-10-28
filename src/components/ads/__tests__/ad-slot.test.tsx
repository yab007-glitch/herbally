import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdSlot } from "../ad-slot";

describe("AdSlot", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete (window as { adsbygoogle?: unknown }).adsbygoogle;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders nothing when the publisher client is not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "");
    const { container } = render(<AdSlot slot="1234567890" />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByLabelText("Advertisement")).not.toBeInTheDocument();
  });

  it("renders nothing when no ad-unit slot is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-1901058826905247");
    const { container } = render(<AdSlot slot="" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("fails closed even if both ad identifiers are configured", () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-1901058826905247");
    const { container } = render(<AdSlot slot="1234567890" />);

    expect(container).toBeEmptyDOMElement();
    expect(
      document.querySelector('script[src*="googlesyndication"]')
    ).toBeNull();
    expect(window.adsbygoogle).toBeUndefined();
  });
});
