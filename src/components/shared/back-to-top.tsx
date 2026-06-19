"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 600);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className={cn(
        "fixed bottom-20 right-4 z-40 inline-flex size-10 items-center justify-center rounded-full border border-border bg-background shadow-md transition-opacity hover:bg-muted md:bottom-6",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <ArrowUp className="size-4" />
    </button>
  );
}