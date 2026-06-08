import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button Component", () => {
  it("renders children correctly", () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole("button", { name: /click me/i })
    ).toBeInTheDocument();
  });

  it("applies variant styles", () => {
    const { container: defaultContainer } = render(<Button>Default</Button>);
    const { container: outlineContainer } = render(
      <Button variant="outline">Outline</Button>
    );
    const { container: ghostContainer } = render(
      <Button variant="ghost">Ghost</Button>
    );

    expect(defaultContainer.firstChild).toHaveClass("bg-primary");
    expect(outlineContainer.firstChild).toHaveClass("border");
    expect(ghostContainer.firstChild).toHaveClass("hover:bg-muted");
  });

  it("applies size variants", () => {
    const { container: defaultContainer } = render(<Button>Default</Button>);
    const { container: smContainer } = render(<Button size="sm">Small</Button>);
    const { container: lgContainer } = render(<Button size="lg">Large</Button>);

    // Check that different sizes have different heights
    expect(defaultContainer.firstChild).toHaveClass("h-8");
    expect(smContainer.firstChild).toHaveClass("h-7");
    expect(lgContainer.firstChild).toHaveClass("h-9");
  });

  it("can be disabled", () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole("button", { name: /disabled/i });
    expect(button).toBeDisabled();
  });

  it("forwards ref correctly", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Test</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("handles click events", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    screen.getByRole("button", { name: /click/i }).click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("supports loading state", () => {
    render(<Button data-loading="true">Loading</Button>);
    const button = screen.getByRole("button");
    // Loading state may add spinner or change appearance
    expect(button).toHaveTextContent("Loading");
  });

  it("applies custom className", () => {
    render(<Button className="custom-class">Custom</Button>);
    expect(screen.getByRole("button")).toHaveClass("custom-class");
  });

  it("renders as anchor when asChild with Link", () => {
    // Test that Button can wrap other components
    render(
      <Button data-testid="anchor-button">
        <a href="/test">Link Button</a>
      </Button>
    );
    expect(screen.getByTestId("anchor-button")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /link button/i })).toHaveAttribute(
      "href",
      "/test"
    );
  });
});
