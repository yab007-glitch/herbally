import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const push = vi.fn();
const replace = vi.fn();
const prefetch = vi.fn();
let locale = "en";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace,
    prefetch,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next-intl", () => ({
  useLocale: () => locale,
}));

import { useLocalizedRouter } from "../use-localized-router";

describe("useLocalizedRouter", () => {
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    prefetch.mockClear();
    locale = "en";
  });

  it("leaves English navigation unprefixed", () => {
    const { result } = renderHook(() => useLocalizedRouter());
    result.current.push("/herbs?q=turmeric");
    expect(push).toHaveBeenCalledWith("/herbs?q=turmeric");
  });

  it("prefixes a French push so searching on /fr/herbs stays French", () => {
    locale = "fr";
    const { result } = renderHook(() => useLocalizedRouter());
    result.current.push("/herbs?q=curcuma");
    expect(push).toHaveBeenCalledWith("/fr/herbs?q=curcuma");
  });

  it("does not double-prefix a path that already carries the locale", () => {
    locale = "fr";
    const { result } = renderHook(() => useLocalizedRouter());
    result.current.replace("/fr/symptoms");
    expect(replace).toHaveBeenCalledWith("/fr/symptoms");
  });

  it("leaves external URLs alone", () => {
    locale = "fr";
    const { result } = renderHook(() => useLocalizedRouter());
    result.current.push("https://pubmed.ncbi.nlm.nih.gov/");
    expect(push).toHaveBeenCalledWith("https://pubmed.ncbi.nlm.nih.gov/");
  });

  it("forwards scroll options without dropping the prefix", () => {
    locale = "fr";
    const { result } = renderHook(() => useLocalizedRouter());
    result.current.push("/herbs?page=2", { scroll: false });
    expect(push).toHaveBeenCalledWith("/fr/herbs?page=2", { scroll: false });
  });
});
