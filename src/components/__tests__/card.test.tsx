import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

describe("Card Components", () => {
  it("renders Card with children", () => {
    render(<Card data-testid="test-card">Card Content</Card>);
    expect(screen.getByTestId("test-card")).toBeInTheDocument();
  });

  it("renders CardHeader", () => {
    render(<CardHeader data-testid="test-header">Header</CardHeader>);
    expect(screen.getByTestId("test-header")).toBeInTheDocument();
  });

  it("renders CardTitle", () => {
    render(<CardTitle data-testid="test-title">Title</CardTitle>);
    expect(screen.getByTestId("test-title")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
  });

  it("renders CardDescription", () => {
    render(
      <CardDescription data-testid="test-desc">Description</CardDescription>
    );
    expect(screen.getByTestId("test-desc")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("renders CardContent", () => {
    render(<CardContent data-testid="test-content">Content</CardContent>);
    expect(screen.getByTestId("test-content")).toBeInTheDocument();
  });

  it("renders CardFooter", () => {
    render(<CardFooter data-testid="test-footer">Footer</CardFooter>);
    expect(screen.getByTestId("test-footer")).toBeInTheDocument();
  });

  it("renders complete Card structure", () => {
    render(
      <Card data-testid="complete-card">
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>Card Content</CardContent>
        <CardFooter>Card Footer</CardFooter>
      </Card>
    );

    expect(screen.getByTestId("complete-card")).toBeInTheDocument();
    expect(screen.getByText("Card Title")).toBeInTheDocument();
    expect(screen.getByText("Card Description")).toBeInTheDocument();
    expect(screen.getByText("Card Content")).toBeInTheDocument();
    expect(screen.getByText("Card Footer")).toBeInTheDocument();
  });

  it("applies custom className to Card", () => {
    render(<Card className="custom-card">Content</Card>);
    expect(screen.getByText("Content")).toHaveClass("custom-card");
  });

  it("applies custom className to CardHeader", () => {
    render(<CardHeader className="custom-header">Header</CardHeader>);
    expect(screen.getByText("Header")).toHaveClass("custom-header");
  });

  it("applies custom className to CardContent", () => {
    render(<CardContent className="custom-content">Content</CardContent>);
    expect(screen.getByText("Content")).toHaveClass("custom-content");
  });
});
