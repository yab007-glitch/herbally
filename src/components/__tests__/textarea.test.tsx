import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Textarea } from "@/components/ui/textarea";

describe("Textarea Component", () => {
  it("renders textarea correctly", () => {
    render(<Textarea placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("forwards ref correctly", () => {
    const ref = { current: null as HTMLTextAreaElement | null };
    render(<Textarea ref={ref} data-testid="ref-textarea" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByTestId("ref-textarea")).toBe(ref.current);
  });

  it("handles value changes", () => {
    render(<Textarea data-testid="test-textarea" />);
    const textarea = screen.getByTestId("test-textarea");
    fireEvent.change(textarea, { target: { value: "Hello World" } });
    expect(textarea).toHaveValue("Hello World");
  });

  it("calls onChange callback", () => {
    const handleChange = vi.fn();
    render(<Textarea onChange={handleChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Test" },
    });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("can be disabled", () => {
    render(<Textarea disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("supports readOnly mode", () => {
    render(<Textarea readOnly />);
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  });

  it("supports required attribute", () => {
    render(<Textarea required />);
    expect(screen.getByRole("textbox")).toHaveAttribute("required");
  });

  it("applies custom className", () => {
    render(<Textarea className="custom-textarea" />);
    expect(screen.getByRole("textbox")).toHaveClass("custom-textarea");
  });

  it("forwards HTML textarea attributes", () => {
    render(
      <Textarea
        minLength={10}
        maxLength={500}
        rows={5}
        cols={40}
        spellCheck={false}
      />
    );
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("minLength", "10");
    expect(textarea).toHaveAttribute("maxLength", "500");
    expect(textarea).toHaveAttribute("rows", "5");
    expect(textarea).toHaveAttribute("cols", "40");
    expect(textarea).toHaveAttribute("spellCheck", "false");
  });

  it("handles focus and blur events", () => {
    const handleFocus = vi.fn();
    const handleBlur = vi.fn();
    render(<Textarea onFocus={handleFocus} onBlur={handleBlur} />);
    const textarea = screen.getByRole("textbox");

    fireEvent.focus(textarea);
    expect(handleFocus).toHaveBeenCalledTimes(1);

    fireEvent.blur(textarea);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it("supports autoResize", () => {
    render(<Textarea data-resize-observer="" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("data-resize-observer");
  });
});
