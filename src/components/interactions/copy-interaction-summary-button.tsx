"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CopyInteractionSummaryButtonProps {
  locale: "en" | "fr";
  summaryText: string;
}

export function CopyInteractionSummaryButton({
  locale,
  summaryText,
}: CopyInteractionSummaryButtonProps) {
  const fr = locale === "fr";
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleCopy}
      className="no-print min-h-10 gap-1.5"
      aria-live="polite"
    >
      {copied ? (
        <Check className="size-4 text-emerald-700 dark:text-emerald-400" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      <span>
        {copied
          ? fr
            ? "Résumé copié"
            : "Summary copied"
          : fr
            ? "Copier le résumé clinique"
            : "Copy consultation summary"}
      </span>
    </Button>
  );
}
