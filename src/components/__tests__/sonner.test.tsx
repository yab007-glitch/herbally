import { describe, it, expect } from "vitest";
import { Toaster } from "@/components/ui/sonner";

describe("Sonner Toaster Component", () => {
  it("Toaster component exists", () => {
    expect(Toaster).toBeDefined();
  });

  it("Toaster is a valid component", () => {
    expect(typeof Toaster).toBe("function");
  });
});
