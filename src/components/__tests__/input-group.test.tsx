import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

describe("Input Group Components", () => {
  it("renders InputGroup with children", () => {
    render(
      <InputGroup data-testid="test-group">
        <InputGroupAddon>$</InputGroupAddon>
        <InputGroupInput placeholder="Amount" />
      </InputGroup>
    );
    expect(screen.getByTestId("test-group")).toBeInTheDocument();
  });

  it("renders InputGroupAddon", () => {
    render(
      <InputGroup>
        <InputGroupAddon data-testid="test-addon">$</InputGroupAddon>
        <InputGroupInput />
      </InputGroup>
    );
    expect(screen.getByTestId("test-addon")).toBeInTheDocument();
  });

  it("renders InputGroupInput", () => {
    render(
      <InputGroup>
        <InputGroupAddon>$</InputGroupAddon>
        <InputGroupInput data-testid="test-input" placeholder="Amount" />
      </InputGroup>
    );
    expect(screen.getByTestId("test-input")).toBeInTheDocument();
  });

  it("applies custom className to InputGroup", () => {
    render(
      <InputGroup className="custom-group" data-testid="styled-group">
        <InputGroupAddon>$</InputGroupAddon>
        <InputGroupInput />
      </InputGroup>
    );
    expect(screen.getByTestId("styled-group")).toHaveClass("custom-group");
  });

  it("applies custom className to InputGroupAddon", () => {
    render(
      <InputGroup>
        <InputGroupAddon className="custom-addon" data-testid="styled-addon">
          $
        </InputGroupAddon>
        <InputGroupInput />
      </InputGroup>
    );
    expect(screen.getByTestId("styled-addon")).toHaveClass("custom-addon");
  });

  it("applies custom className to InputGroupInput", () => {
    render(
      <InputGroup>
        <InputGroupAddon>$</InputGroupAddon>
        <InputGroupInput className="custom-input" data-testid="styled-input" />
      </InputGroup>
    );
    expect(screen.getByTestId("styled-input")).toHaveClass("custom-input");
  });

  it("renders with left addon", () => {
    render(
      <InputGroup data-testid="left-addon-group">
        <InputGroupAddon>$</InputGroupAddon>
        <InputGroupInput placeholder="Amount" />
      </InputGroup>
    );
    expect(screen.getByTestId("left-addon-group")).toBeInTheDocument();
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("renders with right addon", () => {
    render(
      <InputGroup data-testid="right-addon-group">
        <InputGroupInput placeholder="Amount" />
        <InputGroupAddon>USD</InputGroupAddon>
      </InputGroup>
    );
    expect(screen.getByTestId("right-addon-group")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
  });
});
