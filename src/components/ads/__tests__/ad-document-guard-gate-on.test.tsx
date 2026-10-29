import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { AdDocumentGuard } from "../ad-document-guard";
import {
  markAdScriptActive,
  __setAdDocumentStateForTests,
} from "@/lib/ads/document-state";

const nav = vi.hoisted(() => ({ pathname: "/herbs/ginger" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

vi.mock("@/lib/ads/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ads/policy")>();
  return { ...actual, ADS_LAUNCH_GATE: true };
});

function stubLocation() {
  const assign = vi.fn();
  const reload = vi.fn();
  Object.defineProperty(window, "location", {
    value: {
      href: "https://herbally.app/herbs/ginger",
      pathname: "/herbs/ginger",
      assign,
      reload,
    },
    writable: true,
    configurable: true,
  });
  return { assign, reload };
}

async function clickLink(attributes: Record<string, string>, init?: MouseEventInit) {
  const link = document.createElement("a");
  for (const [key, value] of Object.entries(attributes)) {
    link.setAttribute(key, value);
  }
  document.body.appendChild(link);
  link.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, ...init })
  );
  link.remove();
}

function suppressJsdomNavigation() {
  // Registered AFTER render so the guard's capture listener runs first; the
  // default action is then swallowed because jsdom cannot navigate.
  const cancelled: boolean[] = [];
  const handler = (event: MouseEvent) => {
    cancelled.push(event.defaultPrevented);
    event.preventDefault();
  };
  document.addEventListener("click", handler, true);
  return {
    cancelled,
    stop: () => document.removeEventListener("click", handler, true),
  };
}

describe("AdDocumentGuard — launch gate on", () => {
  beforeEach(() => {
    nav.pathname = "/herbs/ginger";
    window.sessionStorage.clear();
    __setAdDocumentStateForTests({
      bootPathname: "/herbs/ginger",
      adScriptActive: false,
    });
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("upgrades an internal click to a real document navigation", () => {
    const { assign } = stubLocation();
    markAdScriptActive();
    render(<AdDocumentGuard />);

    clickLink({ href: "https://herbally.app/herbalist" });

    expect(assign).toHaveBeenCalledWith("https://herbally.app/herbalist");
  });

  it("upgrades a click to another herb page as well", () => {
    const { assign } = stubLocation();
    markAdScriptActive();
    render(<AdDocumentGuard />);

    clickLink({ href: "https://herbally.app/herbs/turmeric" });

    expect(assign).toHaveBeenCalledWith("https://herbally.app/herbs/turmeric");
  });

  it("leaves external and modified clicks to the browser", () => {
    const { assign } = stubLocation();
    markAdScriptActive();
    render(<AdDocumentGuard />);
    const spy = suppressJsdomNavigation();

    clickLink({ href: "https://pubmed.ncbi.nlm.nih.gov/1/" });
    clickLink({ href: "https://herbally.app/herbalist" }, { metaKey: true });
    clickLink({ href: "https://herbally.app/herbalist" }, { button: 1 });
    clickLink({
      href: "https://herbally.app/herbalist",
      target: "_blank",
    });
    clickLink({ href: "https://herbally.app/herbalist", download: "" });

    expect(assign).not.toHaveBeenCalled();
    expect(spy.cancelled).toEqual([false, false, false, false, false]);
    spy.stop();
  });

  it("does not intercept while no provider script is active", () => {
    const { assign } = stubLocation();
    render(<AdDocumentGuard />);
    const spy = suppressJsdomNavigation();

    clickLink({ href: "https://herbally.app/herbalist" });

    expect(assign).not.toHaveBeenCalled();
    // The guard stayed out of the way: the browser's default was untouched.
    expect(spy.cancelled).toEqual([false]);
    spy.stop();
  });

  it("reloads when a programmatic route change lands off the ad page", () => {
    const { reload } = stubLocation();
    markAdScriptActive();
    nav.pathname = "/herbalist";

    render(<AdDocumentGuard />);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload on a history return to the ad-eligible page", () => {
    const { reload } = stubLocation();
    markAdScriptActive();
    render(<AdDocumentGuard />);

    expect(reload).not.toHaveBeenCalled();
  });
});
