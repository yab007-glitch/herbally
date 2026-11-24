"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

/**
 * Copy-paste iframe snippet for the embeddable interaction checker.
 * The snippet hardcodes the canonical https URL so it keeps working when
 * copied between sites (relative URLs would break outside herbally.app).
 */
export function EmbedSnippet() {
  const t = useTranslations("herbDrugInteractionsPage");
  const [copied, setCopied] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
  const snippet = `<iframe src="${appUrl}/embed/checker" width="100%" height="420" style="border:0;border-radius:16px;max-width:480px" loading="lazy" title="Herb–drug interaction checker by HerbAlly"></iframe>`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      // Clipboard API unavailable (permissions) — select fallback.
      const ta = document.createElement("textarea");
      ta.value = snippet;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-3 space-y-3">
      <pre
        tabIndex={0}
        className="overflow-x-auto rounded-xl border bg-background p-3 text-xs text-muted-foreground"
      >
        <code>{snippet}</code>
      </pre>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={handleCopy}>
          {copied ? (
            <Check className="mr-1 size-4 text-green-600" />
          ) : (
            <Copy className="mr-1 size-4" />
          )}
          {copied ? t("embedCopied") : t("embedCopy")}
        </Button>
        <span role="status" className="sr-only">
          {copied ? t("embedCopied") : ""}
        </span>
      </div>
    </div>
  );
}
