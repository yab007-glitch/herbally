import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

let currentLocale = "en";

vi.mock("next-intl", () => ({
  useLocale: () => currentLocale,
  useTranslations: () => (key: string) => key,
}));

import { EmbedChecker } from "../embed-checker";

describe("EmbedChecker", () => {
  const openSpy = vi.fn();

  beforeEach(() => {
    currentLocale = "en";
    vi.clearAllMocks();
    vi.stubGlobal("open", openSpy);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows emptyError when both inputs are blank and uses explicit type='button'", () => {
    render(<EmbedChecker />);
    const submitBtn = screen.getByRole("button", { name: "checkButton" });
    expect(submitBtn).toHaveAttribute("type", "button");

    fireEvent.click(submitBtn);
    expect(screen.getByRole("alert")).toHaveTextContent("emptyError");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("shows sameError when herb and medication match case-insensitively", () => {
    render(<EmbedChecker />);
    fireEvent.change(screen.getByLabelText("herbPlaceholder"), {
      target: { value: "Turmeric" },
    });
    fireEvent.change(screen.getByLabelText("medPlaceholder"), {
      target: { value: "turmeric" },
    });
    fireEvent.click(screen.getByRole("button", { name: "checkButton" }));
    expect(screen.getByRole("alert")).toHaveTextContent("sameError");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("opens localized EN and FR /herbalist URLs and attribution links", () => {
    const { unmount } = render(<EmbedChecker />);
    expect(screen.getByRole("link", { name: "poweredBy" })).toHaveAttribute(
      "href",
      "https://herbally.app/"
    );
    fireEvent.change(screen.getByLabelText("herbPlaceholder"), {
      target: { value: "Ginger" },
    });
    fireEvent.change(screen.getByLabelText("medPlaceholder"), {
      target: { value: "Warfarin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "checkButton" }));
    expect(openSpy).toHaveBeenCalledWith(
      "https://herbally.app/herbalist?q=Is%20Ginger%20safe%20to%20take%20with%20Warfarin%3F",
      "_blank",
      "noopener"
    );
    unmount();

    currentLocale = "fr";
    openSpy.mockReset();
    render(<EmbedChecker />);
    expect(screen.getByRole("link", { name: "poweredBy" })).toHaveAttribute(
      "href",
      "https://herbally.app/fr"
    );
    fireEvent.change(screen.getByLabelText("herbPlaceholder"), {
      target: { value: "Gingembre" },
    });
    fireEvent.change(screen.getByLabelText("medPlaceholder"), {
      target: { value: "Warfarine" },
    });
    fireEvent.click(screen.getByRole("button", { name: "checkButton" }));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/herbally\.app\/fr\/herbalist\?q=/),
      "_blank",
      "noopener"
    );
  });

  it("renders ARIA combobox autocomplete, handles non-OK fetch gracefully, and aborts on unmount", async () => {
    const fetchMock = vi.fn();
    let capturedSignal: AbortSignal | undefined;
    fetchMock
      .mockResolvedValueOnce(new Response("Upstream down", { status: 503 }))
      .mockImplementationOnce((_url: string, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined;
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: "1",
                name: "Ginger",
                slug: "ginger",
                scientific_name: "Zingiber officinale",
              },
            ]),
            { status: 200 }
          )
        );
      });
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<EmbedChecker />);
    const input = screen.getByRole("combobox", { name: "herbPlaceholder" });
    expect(input).toHaveAttribute("aria-expanded", "false");

    // First search returns 503 — must clear safely without throwing
    fireEvent.change(input, { target: { value: "gin" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("listbox")).toBeNull();

    // Second search succeeds — option gets type="button" and fills input
    fireEvent.change(input, { target: { value: "ging" } });
    const option = await screen.findByRole("option");
    expect(option).toHaveAttribute("type", "button");
    expect(input).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(option);
    expect(input).toHaveValue("Ginger");

    // Pending/last AbortController signal is aborted on unmount
    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });
});
