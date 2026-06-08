import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

describe("Dialog Components", () => {
  it("renders Dialog with trigger", () => {
    render(
      <Dialog>
        <DialogTrigger data-testid="trigger">Open Dialog</DialogTrigger>
      </Dialog>
    );
    expect(screen.getByTestId("trigger")).toBeInTheDocument();
    expect(screen.getByText("Open Dialog")).toBeInTheDocument();
  });

  it("renders DialogTrigger as button", () => {
    render(
      <Dialog>
        <DialogTrigger data-testid="trigger-btn">Open</DialogTrigger>
      </Dialog>
    );
    const trigger = screen.getByTestId("trigger-btn");
    expect(trigger.tagName).toBe("BUTTON");
  });

  it("applies custom className to DialogTrigger", () => {
    render(
      <Dialog>
        <DialogTrigger className="custom-trigger" data-testid="styled-trigger">
          Open
        </DialogTrigger>
      </Dialog>
    );
    expect(screen.getByTestId("styled-trigger")).toHaveClass("custom-trigger");
  });

  it("forwards HTML attributes to DialogTrigger", () => {
    render(
      <Dialog>
        <DialogTrigger data-testid="attr-trigger" disabled>
          Disabled Trigger
        </DialogTrigger>
      </Dialog>
    );
    expect(screen.getByTestId("attr-trigger")).toBeDisabled();
  });

  it("supports data attributes on DialogTrigger", () => {
    render(
      <Dialog>
        <DialogTrigger data-testid="data-trigger" data-state="open">
          Trigger
        </DialogTrigger>
      </Dialog>
    );
    expect(screen.getByTestId("data-trigger")).toHaveAttribute(
      "data-state",
      "open"
    );
  });

  it("renders multiple dialog triggers", () => {
    render(
      <>
        <Dialog>
          <DialogTrigger data-testid="trigger-1">First</DialogTrigger>
        </Dialog>
        <Dialog>
          <DialogTrigger data-testid="trigger-2">Second</DialogTrigger>
        </Dialog>
      </>
    );
    expect(screen.getByTestId("trigger-1")).toBeInTheDocument();
    expect(screen.getByTestId("trigger-2")).toBeInTheDocument();
  });
});
