import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Switch } from "@/components/ui/switch";

describe("Switch Component", () => {
  it("renders switch correctly", () => {
    render(<Switch data-testid="test-switch" />);
    expect(screen.getByTestId("test-switch")).toBeInTheDocument();
  });

  it("can be checked", () => {
    render(<Switch checked data-testid="checked-switch" />);
    const switchEl = screen.getByTestId("checked-switch");
    expect(switchEl).toHaveAttribute("aria-checked", "true");
    expect(switchEl).toHaveAttribute("data-checked");
  });

  it("can be unchecked", () => {
    render(<Switch data-testid="unchecked-switch" />);
    const switchEl = screen.getByTestId("unchecked-switch");
    expect(switchEl).toHaveAttribute("aria-checked", "false");
    expect(switchEl).toHaveAttribute("data-unchecked");
  });

  it("can be disabled", () => {
    render(<Switch disabled data-testid="disabled-switch" />);
    const switchEl = screen.getByTestId("disabled-switch");
    expect(switchEl).toHaveAttribute("aria-disabled", "true");
    expect(switchEl).toHaveAttribute("data-disabled");
  });

  it("applies custom className", () => {
    render(<Switch className="custom-switch" data-testid="styled-switch" />);
    expect(screen.getByTestId("styled-switch")).toHaveClass("custom-switch");
  });

  it("has proper accessibility attributes", () => {
    render(<Switch aria-label="Toggle setting" data-testid="a11y-switch" />);
    const switchEl = screen.getByTestId("a11y-switch");
    expect(switchEl).toHaveAttribute("aria-label", "Toggle setting");
    expect(switchEl).toHaveAttribute("role", "switch");
  });

  it("renders as span element", () => {
    render(<Switch data-testid="element-switch" />);
    const switchEl = screen.getByTestId("element-switch");
    expect(switchEl.tagName).toBe("SPAN");
  });

  it("supports data attributes", () => {
    render(<Switch data-state="checked" data-testid="data-switch" />);
    expect(screen.getByTestId("data-switch")).toHaveAttribute(
      "data-state",
      "checked"
    );
  });

  it("handles keyboard interaction", () => {
    render(<Switch data-testid="keyboard-switch" />);
    const switchEl = screen.getByTestId("keyboard-switch");
    // Switch should be focusable and respond to space key
    expect(switchEl).toHaveAttribute("tabindex");
  });

  it("supports size variants", () => {
    render(<Switch data-size="sm" data-testid="size-switch" />);
    expect(screen.getByTestId("size-switch")).toHaveAttribute(
      "data-size",
      "sm"
    );
  });
});
