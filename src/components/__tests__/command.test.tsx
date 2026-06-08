import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

// Mock browser APIs for cmdk
beforeEach(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  Element.prototype.scrollIntoView = vi.fn();
});

describe("Command Components", () => {
  it("renders Command with children", () => {
    render(
      <Command data-testid="test-command">
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandEmpty>No results found</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>Calendar</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );
    expect(screen.getByTestId("test-command")).toBeInTheDocument();
  });

  it("renders CommandInput", () => {
    render(
      <Command>
        <CommandInput data-testid="test-input" placeholder="Search..." />
      </Command>
    );
    expect(screen.getByTestId("test-input")).toBeInTheDocument();
  });

  it("renders CommandList", () => {
    render(
      <Command>
        <CommandInput />
        <CommandList data-testid="test-list">
          <CommandItem>Item</CommandItem>
        </CommandList>
      </Command>
    );
    expect(screen.getByTestId("test-list")).toBeInTheDocument();
  });

  it("renders CommandEmpty", () => {
    render(
      <Command>
        <CommandList>
          <CommandEmpty data-testid="test-empty">No results</CommandEmpty>
        </CommandList>
      </Command>
    );
    expect(screen.getByTestId("test-empty")).toBeInTheDocument();
  });

  it("renders CommandGroup with heading", () => {
    render(
      <Command>
        <CommandList>
          <CommandGroup heading="Group Heading" data-testid="test-group">
            <CommandItem>Item</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );
    expect(screen.getByTestId("test-group")).toBeInTheDocument();
    expect(screen.getByText("Group Heading")).toBeInTheDocument();
  });

  it("renders CommandItem", () => {
    render(
      <Command>
        <CommandList>
          <CommandItem data-testid="test-item">Calendar</CommandItem>
        </CommandList>
      </Command>
    );
    expect(screen.getByTestId("test-item")).toBeInTheDocument();
  });

  it("applies custom className to Command", () => {
    render(
      <Command className="custom-command" data-testid="styled-command">
        <CommandInput />
      </Command>
    );
    expect(screen.getByTestId("styled-command")).toHaveClass("custom-command");
  });
});
