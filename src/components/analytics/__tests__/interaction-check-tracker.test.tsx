import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { track } from "@vercel/analytics";
import { InteractionCheckTracker } from "../interaction-check-tracker";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

const trackMock = track as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  trackMock.mockReset();
  window.localStorage.clear();
});

describe("InteractionCheckTracker", () => {
  it("records the pair-page step without the herb or the drug", () => {
    render(<InteractionCheckTracker />);

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("interaction_checked", {
      trigger: "pair_page",
    });
  });

  it("records the expand-table trigger when asked", () => {
    render(<InteractionCheckTracker trigger="expand_table" />);

    expect(trackMock).toHaveBeenCalledWith("interaction_checked", {
      trigger: "expand_table",
    });
  });
});
