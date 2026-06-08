import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

describe("Tooltip Components", () => {
  it("renders TooltipProvider", () => {
    render(
      <TooltipProvider>
        <div data-testid="provider-content">Content</div>
      </TooltipProvider>
    );
    expect(screen.getByTestId("provider-content")).toBeInTheDocument();
  });

  it("renders Tooltip with trigger", () => {
    render(
      <Tooltip>
        <TooltipTrigger data-testid="trigger">Hover me</TooltipTrigger>
        <TooltipContent>Tooltip content</TooltipContent>
      </Tooltip>
    );
    expect(screen.getByTestId("trigger")).toBeInTheDocument();
    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });

  it("renders tooltip trigger as button", () => {
    render(
      <Tooltip>
        <TooltipTrigger data-testid="trigger-btn">Trigger</TooltipTrigger>
        <TooltipContent>Content</TooltipContent>
      </Tooltip>
    );
    const trigger = screen.getByTestId("trigger-btn");
    expect(trigger.tagName).toBe("BUTTON");
  });

  it("forwards HTML attributes to trigger", () => {
    render(
      <Tooltip>
        <TooltipTrigger data-testid="attr-trigger" title="Native tooltip">
          Trigger
        </TooltipTrigger>
        <TooltipContent>Content</TooltipContent>
      </Tooltip>
    );
    expect(screen.getByTestId("attr-trigger")).toHaveAttribute(
      "title",
      "Native tooltip"
    );
  });

  it("applies custom className to trigger", () => {
    render(
      <Tooltip>
        <TooltipTrigger className="custom-trigger" data-testid="styled-trigger">
          Trigger
        </TooltipTrigger>
        <TooltipContent>Content</TooltipContent>
      </Tooltip>
    );
    expect(screen.getByTestId("styled-trigger")).toHaveClass("custom-trigger");
  });

  it("supports disabled trigger with data attribute", () => {
    render(
      <Tooltip>
        <TooltipTrigger disabled data-testid="disabled-trigger">
          Trigger
        </TooltipTrigger>
        <TooltipContent>Content</TooltipContent>
      </Tooltip>
    );
    const trigger = screen.getByTestId("disabled-trigger");
    expect(trigger).toHaveAttribute("data-trigger-disabled");
  });

  it("renders multiple tooltips in provider", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger data-testid="trigger-1">First</TooltipTrigger>
          <TooltipContent>First tooltip</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger data-testid="trigger-2">Second</TooltipTrigger>
          <TooltipContent>Second tooltip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(screen.getByTestId("trigger-1")).toBeInTheDocument();
    expect(screen.getByTestId("trigger-2")).toBeInTheDocument();
  });
});
