import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Mock browser APIs
beforeEach(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  Element.prototype.scrollIntoView = vi.fn();
});

describe("Dropdown Menu Components", () => {
  it("renders DropdownMenu with trigger", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger">
          Open Menu
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByTestId("trigger")).toBeInTheDocument();
  });

  it("renders DropdownMenuTrigger as button", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger-btn">
          Open
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const trigger = screen.getByTestId("trigger-btn");
    expect(trigger.tagName).toBe("BUTTON");
  });

  it("applies custom className to DropdownMenuTrigger", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger
          className="custom-trigger"
          data-testid="styled-trigger"
        >
          Open
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByTestId("styled-trigger")).toHaveClass("custom-trigger");
  });

  it("forwards HTML attributes to DropdownMenuTrigger", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="attr-trigger" disabled>
          Disabled Trigger
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByTestId("attr-trigger")).toBeDisabled();
  });

  it("supports data attributes on DropdownMenuTrigger", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="data-trigger" data-state="open">
          Trigger
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByTestId("data-trigger")).toHaveAttribute(
      "data-state",
      "open"
    );
  });

  it("renders multiple dropdown menus", () => {
    render(
      <>
        <DropdownMenu>
          <DropdownMenuTrigger data-testid="menu-1">Menu 1</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger data-testid="menu-2">Menu 2</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
    expect(screen.getByTestId("menu-1")).toBeInTheDocument();
    expect(screen.getByTestId("menu-2")).toBeInTheDocument();
  });
});
