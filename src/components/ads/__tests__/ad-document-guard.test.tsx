import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { AdDocumentGuard } from "../ad-document-guard";
import { markAdScriptActive, __setAdDocumentStateForTests } from "@/lib/ads/document-state";

const nav = vi.hoisted(() => ({ pathname: "/herbs/ginger" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

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

/**
 * Production shape: gate closed. The guard must be completely inert.
 */
function suppressJsdomNavigation() {
  // Registered AFTER render, so the guard's capture listener runs first and
  // this one can observe whether it cancelled the click before swallowing the
  // default action (jsdom cannot navigate).
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

describe("AdDocumentGuard — launch gate off (production)", () => {
  beforeEach(() => {
    nav.pathname = "/herbs/ginger";
    __setAdDocumentStateForTests({ bootPathname: "/herbs/ginger", adScriptActive: false });
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("does not intercept internal navigation", () => {
    const { assign } = stubLocation();
    render(<AdDocumentGuard />);
    const spy = suppressJsdomNavigation();

    const link = document.createElement("a");
    link.href = "https://herbally.app/herbalist";
    document.body.appendChild(link);
    link.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );

    expect(spy.cancelled).toEqual([false]);
    expect(assign).not.toHaveBeenCalled();
    spy.stop();
    link.remove();
  });

  it("never reloads even if a provider script were somehow active", () => {
    const { reload } = stubLocation();
    markAdScriptActive();
    nav.pathname = "/herbalist";

    render(<AdDocumentGuard />);

    expect(reload).not.toHaveBeenCalled();
  });
});
