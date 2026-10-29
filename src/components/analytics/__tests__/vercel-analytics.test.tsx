import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { VercelAnalytics } from "../vercel-analytics";

/**
 * `VercelAnalytics` is the only place page views are gated. The SDK's
 * `beforeSend` is registered before the insights script is injected, so a
 * visitor who has signalled an opt-out sends neither page views nor events —
 * not merely "no custom events". This test pins that contract.
 */
const state = vi.hoisted(() => ({
  beforeSend: null as null | ((event: { type: string }) => unknown),
}));

vi.mock("@vercel/analytics/next", () => ({
  Analytics: ({
    beforeSend,
  }: {
    beforeSend: (event: { type: string }) => unknown;
  }) => {
    state.beforeSend = beforeSend;
    return null;
  },
}));

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
  window.localStorage.clear();
  state.beforeSend = null;
  setGpc(false);
  setDnt(null);
});

describe("VercelAnalytics consent wrapper", () => {
  it("passes page views through by default", () => {
    render(<VercelAnalytics />);
    const event = { type: "pageview" };
    expect(state.beforeSend?.(event)).toBe(event);
  });

  it("drops page views when Global Privacy Control is set", () => {
    setGpc(true);
    render(<VercelAnalytics />);
    expect(state.beforeSend?.({ type: "pageview" })).toBeNull();
  });

  it("drops page views when Do Not Track is set", () => {
    setDnt("1");
    render(<VercelAnalytics />);
    expect(state.beforeSend?.({ type: "pageview" })).toBeNull();
  });
});
