import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let mockPathname: string | null = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("sonner", () => ({
  Toaster: () => <section aria-label="Notifications alt+T" />,
}));

import { Toaster } from "@/components/ui/sonner";

describe("Sonner Toaster Component", () => {
  beforeEach(() => {
    mockPathname = "/";
  });

  it("Toaster component exists", () => {
    expect(Toaster).toBeDefined();
  });

  it("Toaster is a valid component", () => {
    expect(typeof Toaster).toBe("function");
  });

  it("renders notifications landmark on standard routes and omits it on /embed/ routes", () => {
    const { rerender } = render(<Toaster />);
    expect(
      screen.getByRole("region", { name: "Notifications alt+T" })
    ).toBeInTheDocument();

    mockPathname = "/embed/checker";
    rerender(<Toaster />);
    expect(screen.queryByRole("region")).toBeNull();

    mockPathname = "/fr/embed/checker";
    rerender(<Toaster />);
    expect(screen.queryByRole("region")).toBeNull();
  });
});
