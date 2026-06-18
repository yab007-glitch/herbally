"use client";

import { useEffect } from "react";

export function useLanguageHotkey(onToggle: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl/Cmd + Shift + L toggles language
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "l") {
        e.preventDefault();
        onToggle();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggle]);
}
