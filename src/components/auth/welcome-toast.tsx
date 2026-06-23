"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

/**
 * Shows a welcome toast when the user lands on the home page after
 * logging in or registering. The server action appends ?welcome=login
 * or ?welcome=register to the redirect URL, and this component reads
 * it and displays the appropriate toast, then cleans the URL.
 */
export function WelcomeToast() {
  const searchParams = useSearchParams();
  const t = useTranslations();

  useEffect(() => {
    const welcome = searchParams.get("welcome");
    if (!welcome) return;

    if (welcome === "register") {
      toast.success(
        t("profile.welcomeRegistered") ||
          "Welcome to HerbAlly! Your account is ready."
      );
    } else if (welcome === "login") {
      toast.success(t("profile.welcomeBack") || "Welcome back!");
    }

    // Clean the URL so the toast doesn't re-appear on refresh
    const url = new URL(window.location.href);
    url.searchParams.delete("welcome");
    window.history.replaceState({}, "", url.toString());
  }, [searchParams, t]);

  return null;
}
