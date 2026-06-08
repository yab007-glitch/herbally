import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";

// Mock browser APIs
beforeEach(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  Element.prototype.scrollIntoView = vi.fn();
});

describe("Sheet Components", () => {
  it("renders Sheet with trigger", () => {
    render(
      <Sheet>
        <SheetTrigger data-testid="trigger">Open Sheet</SheetTrigger>
        <SheetContent>Sheet content</SheetContent>
      </Sheet>
    );
    expect(screen.getByTestId("trigger")).toBeInTheDocument();
  });

  it("renders SheetTrigger as button", () => {
    render(
      <Sheet>
        <SheetTrigger data-testid="trigger-btn">Open</SheetTrigger>
        <SheetContent>Content</SheetContent>
      </Sheet>
    );
    const trigger = screen.getByTestId("trigger-btn");
    expect(trigger.tagName).toBe("BUTTON");
  });

  it("applies custom className to SheetTrigger", () => {
    render(
      <Sheet>
        <SheetTrigger className="custom-trigger" data-testid="styled-trigger">
          Open
        </SheetTrigger>
        <SheetContent>Content</SheetContent>
      </Sheet>
    );
    expect(screen.getByTestId("styled-trigger")).toHaveClass("custom-trigger");
  });

  it("forwards HTML attributes to SheetTrigger", () => {
    render(
      <Sheet>
        <SheetTrigger data-testid="attr-trigger" disabled>
          Disabled Trigger
        </SheetTrigger>
        <SheetContent>Content</SheetContent>
      </Sheet>
    );
    expect(screen.getByTestId("attr-trigger")).toBeDisabled();
  });

  it("supports data attributes on SheetTrigger", () => {
    render(
      <Sheet>
        <SheetTrigger data-testid="data-trigger" data-state="open">
          Trigger
        </SheetTrigger>
        <SheetContent>Content</SheetContent>
      </Sheet>
    );
    expect(screen.getByTestId("data-trigger")).toHaveAttribute(
      "data-state",
      "open"
    );
  });

  it("renders multiple sheet triggers", () => {
    render(
      <>
        <Sheet>
          <SheetTrigger data-testid="trigger-1">First</SheetTrigger>
          <SheetContent>First sheet</SheetContent>
        </Sheet>
        <Sheet>
          <SheetTrigger data-testid="trigger-2">Second</SheetTrigger>
          <SheetContent>Second sheet</SheetContent>
        </Sheet>
      </>
    );
    expect(screen.getByTestId("trigger-1")).toBeInTheDocument();
    expect(screen.getByTestId("trigger-2")).toBeInTheDocument();
  });
});
