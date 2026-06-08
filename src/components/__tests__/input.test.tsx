import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "@/components/ui/input";

describe("Input Component", () => {
  it("renders correctly", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("forwards ref correctly", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} data-testid="ref-input" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByTestId("ref-input")).toBe(ref.current);
  });

  it("handles value changes", () => {
    render(<Input data-testid="test-input" />);
    const input = screen.getByTestId("test-input");
    fireEvent.change(input, { target: { value: "Hello" } });
    expect(input).toHaveValue("Hello");
  });

  it("calls onChange callback", () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Test" },
    });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: "Test" }),
      })
    );
  });

  it("can be disabled", () => {
    render(<Input disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("supports readOnly mode", () => {
    render(<Input readOnly />);
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  });

  it("supports different types", () => {
    const { rerender } = render(
      <Input type="email" data-testid="type-input" />
    );
    expect(screen.getByTestId("type-input")).toHaveAttribute("type", "email");

    rerender(<Input type="password" data-testid="type-input" />);
    expect(screen.getByTestId("type-input")).toHaveAttribute(
      "type",
      "password"
    );

    rerender(<Input type="number" data-testid="type-input" />);
    expect(screen.getByTestId("type-input")).toHaveAttribute("type", "number");
  });

  it("supports required attribute", () => {
    render(<Input required />);
    expect(screen.getByRole("textbox")).toHaveAttribute("required");
  });

  it("applies custom className", () => {
    render(<Input className="custom-class" />);
    expect(screen.getByRole("textbox")).toHaveClass("custom-class");
  });

  it("forwards HTML input attributes", () => {
    render(
      <Input
        minLength={5}
        maxLength={100}
        pattern="[A-Za-z]+"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
      />
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("minLength", "5");
    expect(input).toHaveAttribute("maxLength", "100");
    expect(input).toHaveAttribute("pattern", "[A-Za-z]+");
    expect(input).toHaveAttribute("autoComplete", "off");
  });

  it("handles focus and blur events", () => {
    const handleFocus = vi.fn();
    const handleBlur = vi.fn();
    render(<Input onFocus={handleFocus} onBlur={handleBlur} />);
    const input = screen.getByRole("textbox");

    fireEvent.focus(input);
    expect(handleFocus).toHaveBeenCalledTimes(1);

    fireEvent.blur(input);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it("handles key events", () => {
    const handleKeyDown = vi.fn();
    const handleKeyUp = vi.fn();

    render(
      <Input
        data-testid="key-input"
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      />
    );

    const input = screen.getByTestId("key-input");
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyUp(input, { key: "Enter" });

    expect(handleKeyDown).toHaveBeenCalledTimes(1);
    expect(handleKeyUp).toHaveBeenCalledTimes(1);
  });
});
