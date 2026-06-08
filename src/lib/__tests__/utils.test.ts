import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("Utility Functions", () => {
  describe("cn (classNames)", () => {
    it("merges multiple class names", () => {
      const result = cn("class1", "class2", "class3");
      expect(result).toBe("class1 class2 class3");
    });

    it("filters out falsy values", () => {
      const result = cn("class1", false, null, undefined, "", "class2");
      expect(result).toBe("class1 class2");
    });

    it("handles conditional classes", () => {
      const isActive = true;
      const isDisabled = false;
      const result = cn("base", isActive && "active", isDisabled && "disabled");
      expect(result).toBe("base active");
    });

    it("merges tailwind classes properly", () => {
      const result = cn("px-4 py-2", "px-6");
      // Should handle tailwind class merging
      expect(result).toContain("py-2");
    });

    it("handles empty input", () => {
      const result = cn();
      expect(result).toBe("");
    });

    it("handles single class", () => {
      const result = cn("single-class");
      expect(result).toBe("single-class");
    });

    it("handles array input", () => {
      const result = cn(["class1", "class2"]);
      expect(result).toBe("class1 class2");
    });

    it("handles object input", () => {
      const result = cn({ class1: true, class2: false, class3: true });
      expect(result).toBe("class1 class3");
    });
  });
});
