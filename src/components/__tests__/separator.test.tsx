import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Separator } from "@/components/ui/separator";

describe("Separator Component", () => {
  it("renders horizontal separator", () => {
    render(<Separator data-testid="h-separator" />);
    expect(screen.getByTestId("h-separator")).toBeInTheDocument();
  });

  it("renders vertical separator", () => {
    render(<Separator orientation="vertical" data-testid="v-separator" />);
    const separator = screen.getByTestId("v-separator");
    expect(separator).toHaveAttribute("data-orientation", "vertical");
  });

  it("applies custom className", () => {
    render(
      <Separator className="custom-separator" data-testid="styled-separator" />
    );
    expect(screen.getByTestId("styled-separator")).toHaveClass(
      "custom-separator"
    );
  });

  it("renders as div element", () => {
    render(<Separator data-testid="element-separator" />);
    const separator = screen.getByTestId("element-separator");
    expect(separator.tagName).toBe("DIV");
  });

  it("renders as div when vertical", () => {
    render(
      <Separator orientation="vertical" data-testid="vertical-separator" />
    );
    const separator = screen.getByTestId("vertical-separator");
    expect(separator.tagName).toBe("DIV");
  });

  it("has separator role", () => {
    render(<Separator data-testid="role-separator" />);
    expect(screen.getByTestId("role-separator")).toHaveAttribute(
      "role",
      "separator"
    );
  });

  it("forwards HTML attributes", () => {
    render(
      <Separator
        data-testid="attr-separator"
        title="Section Divider"
        aria-label="Divider"
      />
    );
    const separator = screen.getByTestId("attr-separator");
    expect(separator).toHaveAttribute("aria-label", "Divider");
  });

  it("supports data attributes", () => {
    render(<Separator data-state="expanded" data-testid="data-separator" />);
    expect(screen.getByTestId("data-separator")).toHaveAttribute(
      "data-state",
      "expanded"
    );
  });
});
