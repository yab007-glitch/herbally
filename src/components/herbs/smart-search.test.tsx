import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const searchState = vi.hoisted(() => ({ q: "" }));

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useSearchParams: () => ({
    get: (key: string) => (key === "q" ? searchState.q : null),
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/herbs/recent-searches", () => ({
  RecentSearches: () => null,
  useSaveSearch: () => () => {},
}));

vi.mock("@/lib/hooks/use-debounce", () => ({
  useDebounce: (value: string) => value,
}));

vi.mock("@/lib/search/herb-list-url", () => ({
  buildHerbListUrl: () => "/herbs",
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: { error: vi.fn() },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { SmartSearch } from "./smart-search";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("SmartSearch URL sync", () => {
  beforeEach(() => {
    searchState.q = "";
    replaceMock.mockClear();
  });

  it("mirrors an externally driven URL change into the input without re-navigating", () => {
    // Guards the URL -> input direction: the value is adjusted during render
    // now, and the last-navigated ref stays in step so the debounced effect
    // does not bounce a redundant router.replace.
    const { rerender } = render(<SmartSearch defaultValue="" />);
    const input = screen.getByLabelText(
      "search.placeholder"
    ) as HTMLInputElement;
    expect(input.value).toBe("");

    searchState.q = "ginger";
    rerender(<SmartSearch defaultValue="" />);
    expect(input.value).toBe("ginger");

    searchState.q = "";
    rerender(<SmartSearch defaultValue="" />);
    expect(input.value).toBe("");

    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe("SmartSearch Surprise Me failure", () => {
  it("shows a visible error and retry on a non-OK random response, and retry navigates on success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ slug: "valerian" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<SmartSearch />);

    fireEvent.click(screen.getByRole("button", { name: "search.surpriseMe" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("search.randomError")
    );
    expect(pushMock).not.toHaveBeenCalledWith("/herbs/valerian");

    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/herbs/valerian")
    );
  });

  it("navigates directly when the random response is OK with a slug", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ slug: "turmeric" }),
      })
    );

    render(<SmartSearch />);
    fireEvent.click(screen.getByRole("button", { name: "search.surpriseMe" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/herbs/turmeric")
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
