import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Label } from "@/components/ui/label";

describe("Label Component", () => {
  it("renders label with text", () => {
    render(<Label>Label Text</Label>);
    expect(screen.getByText("Label Text")).toBeInTheDocument();
  });

  it("renders label for input", () => {
    render(<Label htmlFor="test-input">Input Label</Label>);
    const label = screen.getByText("Input Label");
    expect(label).toHaveAttribute("for", "test-input");
  });

  it("applies custom className", () => {
    render(<Label className="custom-label">Custom</Label>);
    expect(screen.getByText("Custom")).toHaveClass("custom-label");
  });

  it("applies data-disabled attribute when disabled", () => {
    render(<Label data-disabled>Disabled Label</Label>);
    expect(screen.getByText("Disabled Label")).toHaveAttribute("data-disabled");
  });

  it("renders as label element", () => {
    render(<Label data-testid="test-label">Test</Label>);
    const label = screen.getByTestId("test-label");
    expect(label.tagName).toBe("LABEL");
  });

  it("forwards HTML label attributes", () => {
    render(
      <Label htmlFor="email" data-testid="attr-label" title="Email Address">
        Email
      </Label>
    );
    const label = screen.getByTestId("attr-label");
    expect(label).toHaveAttribute("for", "email");
    expect(label).toHaveAttribute("title", "Email Address");
  });
});
