import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton } from "@/components/ui/skeleton";

describe("Skeleton Component", () => {
  it("renders Skeleton element", () => {
    render(<Skeleton data-testid="test-skeleton" />);
    expect(screen.getByTestId("test-skeleton")).toBeInTheDocument();
  });

  it("applies default styles", () => {
    render(<Skeleton data-testid="styled-skeleton" />);
    const skeleton = screen.getByTestId("styled-skeleton");
    expect(skeleton).toHaveClass("bg-muted");
    expect(skeleton).toHaveClass("animate-pulse");
  });

  it("applies custom className", () => {
    render(<Skeleton className="custom-skeleton" data-testid="custom" />);
    expect(screen.getByTestId("custom")).toHaveClass("custom-skeleton");
  });

  it("can have custom width", () => {
    render(<Skeleton className="w-48" data-testid="wide-skeleton" />);
    expect(screen.getByTestId("wide-skeleton")).toHaveClass("w-48");
  });

  it("can have custom height", () => {
    render(<Skeleton className="h-24" data-testid="tall-skeleton" />);
    expect(screen.getByTestId("tall-skeleton")).toHaveClass("h-24");
  });

  it("can have custom shape", () => {
    render(<Skeleton className="rounded-full" data-testid="round-skeleton" />);
    expect(screen.getByTestId("round-skeleton")).toHaveClass("rounded-full");
  });

  it("renders as div element", () => {
    render(<Skeleton data-testid="element-skeleton" />);
    const skeleton = screen.getByTestId("element-skeleton");
    expect(skeleton.tagName).toBe("DIV");
  });
});
