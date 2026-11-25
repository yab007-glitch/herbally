import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const toastErrorMock = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

import { DonationButtons } from "../donation-buttons";

describe("DonationButtons", () => {
  const assignMock = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: assignMock },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    vi.unstubAllGlobals();
  });

  it("redirects to checkout URL on preset tier click and blocks concurrent clicks while loading", async () => {
    let resolveFetch!: (res: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<DonationButtons />);
    const presetCard = screen.getByRole("button", {
      name: /donateButtons\.coffee — \$5/,
    });
    const customDonateBtn = screen.getByRole("button", {
      name: "donateButtons.donate",
    });

    fireEvent.click(presetCard);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(customDonateBtn).toBeDisabled();

    // Concurrent click while loading must be ignored
    fireEvent.click(presetCard);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(
      new Response(
        JSON.stringify({ url: "https://checkout.stripe.com/session_123" }),
        { status: 200 }
      )
    );
    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        "https://checkout.stripe.com/session_123"
      )
    );
  });

  it("renders inline alert and toast without window.alert when /api/donate returns non-OK", async () => {
    const alertSpy = vi.fn();
    vi.stubGlobal("alert", alertSpy);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
    );

    render(<DonationButtons />);
    fireEvent.click(
      screen.getByRole("button", { name: "donateButtons.donate" })
    );

    const alertEl = await screen.findByRole("alert");
    expect(alertEl).toHaveTextContent("donateButtons.errorMessage");
    expect(toastErrorMock).toHaveBeenCalledWith("donateButtons.errorMessage");
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("clamps finite custom amounts and never produces NaN", () => {
    render(<DonationButtons />);
    const input = screen.getByLabelText("donateButtons.customAmount");
    expect(input).toHaveValue(20);

    fireEvent.change(input, { target: { value: "5000" } });
    expect(input).toHaveValue(1000);

    fireEvent.change(input, { target: { value: "0" } });
    expect(input).toHaveValue(1);

    fireEvent.change(input, { target: { value: "abc" } });
    expect(input).toHaveValue(1);
  });
});
