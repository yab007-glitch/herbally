import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge Component", () => {
  it("renders children correctly", () => {
    render(<Badge>Status</Badge>);
    expect(screen.getByText(/status/i)).toBeInTheDocument();
  });

  it("applies variant styles", () => {
    const { container: defaultContainer } = render(<Badge>Default</Badge>);
    const { container: secondaryContainer } = render(
      <Badge variant="secondary">Secondary</Badge>
    );
    const { container: outlineContainer } = render(
      <Badge variant="outline">Outline</Badge>
    );
    const { container: destructiveContainer } = render(
      <Badge variant="destructive">Destructive</Badge>
    );

    // Default badge has primary colors
    expect(defaultContainer.firstChild).toHaveClass("bg-primary");
    // Secondary variant
    expect(secondaryContainer.firstChild).toHaveClass("bg-secondary");
    // Outline has border
    expect(outlineContainer.firstChild).toHaveClass("border");
    // Destructive has destructive color
    expect(destructiveContainer.firstChild).toHaveClass("text-destructive");
  });

  it("applies size variants", () => {
    // Badge has fixed size by default (h-5)
    const { container } = render(<Badge>Default</Badge>);
    expect(container.firstChild).toHaveClass("h-5");
  });

  it("forwards ref correctly", () => {
    const ref = { current: null as HTMLSpanElement | null };
    render(<Badge ref={ref}>Test</Badge>);
    // Badge renders as span by default
    expect(ref.current).toBeTruthy();
    expect(ref.current).toHaveAttribute("data-slot", "badge");
  });

  it("applies custom className", () => {
    render(<Badge className="custom-class">Custom</Badge>);
    expect(screen.getByText(/custom/i)).toHaveClass("custom-class");
  });

  it("supports custom data attributes", () => {
    render(<Badge data-testid="test-badge">Test</Badge>);
    expect(screen.getByTestId("test-badge")).toBeInTheDocument();
  });
});
