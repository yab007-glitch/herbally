"use client";

import { useEffect } from "react";
import { logger } from "@/lib/utils/logger";

export function SWRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch((error) => {
          logger.error("sw_registration_failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      });
    }
  }, []);

  return null;
}
