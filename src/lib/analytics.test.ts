import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { track } from "@vercel/analytics";
import {
  ANALYTICS_OPT_OUT_KEY,
  analyticsAllowed,
  trackEvent,
} from "./analytics";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

const trackMock = track as unknown as ReturnType<typeof vi.fn>;

function setGpc(value: boolean) {
  Object.defineProperty(navigator, "globalPrivacyControl", {
    value,
    configurable: true,
  });
}

function setDnt(value: string | null) {
  Object.defineProperty(navigator, "doNotTrack", {
    value,
    configurable: true,
  });
}

beforeEach(() => {
  trackMock.mockReset();
  window.localStorage.clear();
  setGpc(false);
  setDnt(null);
});

afterEach(() => {
  setGpc(false);
  setDnt(null);
  vi.restoreAllMocks();
});

describe("analytics consent gate", () => {
  it("allows analytics by default", () => {
    expect(analyticsAllowed()).toBe(true);
  });

  it("blocks everything when Global Privacy Control is on", () => {
    setGpc(true);
    expect(analyticsAllowed()).toBe(false);
    trackEvent("calculator_used", {
      formula: "clarks_rule",
      outcome: "computed",
    });
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("blocks everything when Do Not Track is 1", () => {
    setDnt("1");
    trackEvent("chat_message_sent", { hasHerbContext: false });
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("blocks everything when the visitor opted out", () => {
    window.localStorage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
    trackEvent("interaction_checked", { trigger: "pair_page" });
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("fails closed when storage access throws", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(analyticsAllowed()).toBe(false);
    trackEvent("chat_message_sent", { hasHerbContext: true });
    expect(trackMock).not.toHaveBeenCalled();
  });
});

describe("analytics event payloads", () => {
  it("sends the four funnel events with allowlisted properties only", () => {
    trackEvent("calculator_used", {
      formula: "bsa",
      outcome: "computed",
    });
    trackEvent("interaction_checked", { trigger: "pair_page" });
    trackEvent("chat_message_sent", { hasHerbContext: true });
    trackEvent("outbound_click", { target: "donation" });

    expect(trackMock.mock.calls).toEqual([
      ["calculator_used", { formula: "bsa", outcome: "computed" }],
      ["interaction_checked", { trigger: "pair_page" }],
      ["chat_message_sent", { hasHerbContext: true }],
      ["outbound_click", { target: "donation" }],
    ]);
  });

  it("strips properties that are not on the allowlist", () => {
    // Simulates a future caller drifting: the extra keys must not travel.
    trackEvent("chat_message_sent", {
      hasHerbContext: false,
      question: "is berberine safe with warfarin",
      age: 41,
      weightKg: 82,
    } as never);

    expect(trackMock).toHaveBeenCalledWith("chat_message_sent", {
      hasHerbContext: false,
    });
  });

  it("drops closed-domain values that are not in the allowlist", () => {
    // A herb slug is health-adjacent; it must never satisfy `formula`.
    trackEvent("calculator_used", {
      formula: "turmeric-curcumin",
      outcome: "computed",
    } as never);
    expect(trackMock).toHaveBeenCalledWith("calculator_used", {
      outcome: "computed",
    });

    trackMock.mockReset();
    trackEvent("outbound_click", { target: "health-forum" } as never);
    expect(trackMock).toHaveBeenCalledWith("outbound_click", {});
  });

  it("drops overlong strings and non-host strings in the host field", () => {
    trackEvent("outbound_click", {
      target: "external",
      host: "example.org".padEnd(41, "x"),
    });
    expect(trackMock).toHaveBeenCalledWith("outbound_click", {
      target: "external",
    });

    trackMock.mockReset();
    trackEvent("outbound_click", {
      target: "external",
      host: "example.org/?q=berberine+warfarin",
    });
    expect(trackMock).toHaveBeenCalledWith("outbound_click", {
      target: "external",
    });
  });

  it("keeps a plain hostname", () => {
    trackEvent("outbound_click", {
      target: "external",
      host: "checkout.stripe.com",
    });
    expect(trackMock).toHaveBeenCalledWith("outbound_click", {
      target: "external",
      host: "checkout.stripe.com",
    });
  });

  it("never throws when the SDK throws", () => {
    trackMock.mockImplementation(() => {
      throw new Error("blocked by extension");
    });
    expect(() =>
      trackEvent("interaction_checked", { trigger: "pair_page" })
    ).not.toThrow();
  });
});
