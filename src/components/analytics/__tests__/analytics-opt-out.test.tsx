import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AnalyticsOptOut } from "../analytics-opt-out";
import { ANALYTICS_OPT_OUT_KEY, analyticsAllowed } from "@/lib/analytics";

const labels = {
  label: "Your analytics choice",
  statusOn: "Analytics are on for this browser.",
  statusOff: "Analytics are off for this browser.",
  actionOn: "Turn analytics on",
  actionOff: "Turn analytics off",
  note: "This choice applies only to this browser.",
};

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("AnalyticsOptOut", () => {
  it("turns analytics off and makes the gate agree", () => {
    render(<AnalyticsOptOut labels={labels} />);

    expect(screen.getByText(labels.statusOn)).toBeDefined();
    expect(analyticsAllowed()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: labels.actionOff }));

    expect(window.localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBe("1");
    expect(screen.getByText(labels.statusOff)).toBeDefined();
    expect(analyticsAllowed()).toBe(false);
  });

  it("turns analytics back on and clears the stored preference", () => {
    window.localStorage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
    render(<AnalyticsOptOut labels={labels} />);

    expect(screen.getByText(labels.statusOff)).toBeDefined();
    expect(analyticsAllowed()).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: labels.actionOn }));

    expect(window.localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
    expect(screen.getByText(labels.statusOn)).toBeDefined();
    expect(analyticsAllowed()).toBe(true);
  });

  it("fails closed and disables the control when storage cannot be read", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    render(<AnalyticsOptOut labels={labels} />);

    expect(screen.getByText(labels.statusOff)).toBeDefined();
    const button = screen.getByRole("button", {
      name: labels.actionOn,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
