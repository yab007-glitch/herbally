"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function WidgetBuilder() {
  const t = useTranslations("widgetsPage");
  const initialLocale = useLocale() === "fr" ? "fr" : "en";

  const [widgetLocale, setWidgetLocale] = useState<"en" | "fr">(initialLocale);
  const [maxWidth, setMaxWidth] = useState<"480" | "640" | "100%">("480");
  const [copied, setCopied] = useState(false);

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app"
  ).replace(/\/$/, "");
  const iframePath =
    widgetLocale === "fr" ? "/fr/embed/checker" : "/embed/checker";
  const widthCss = maxWidth === "100%" ? "100%" : `${maxWidth}px`;
  const titleAttr =
    widgetLocale === "fr"
      ? "Vérificateur d'interactions plante-médicament par HerbAlly"
      : "Herb-drug interaction checker by HerbAlly";

  const snippet = `<iframe src="${appUrl}${iframePath}" width="100%" height="440" style="border:0;border-radius:16px;max-width:${widthCss}" loading="lazy" title="${titleAttr}"></iframe>\n<p style="font-size:12px;margin-top:6px"><a href="${appUrl}${widgetLocale === "fr" ? "/fr" : ""}/herb-drug-interactions" rel="noopener">${t("attributionLabel")}</a></p>`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">
            {t("languageLabel")}
          </span>
          <div className="flex gap-2">
            {(["en", "fr"] as const).map((loc) => (
              <Button
                key={loc}
                type="button"
                size="sm"
                variant={widgetLocale === loc ? "default" : "outline"}
                onClick={() => setWidgetLocale(loc)}
              >
                {loc === "en" ? "English" : "Français"}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">
            {t("widthLabel")}
          </span>
          <div className="flex gap-2">
            {(
              [
                { value: "480", label: "480 px" },
                { value: "640", label: "640 px" },
                { value: "100%", label: "100%" },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={maxWidth === opt.value ? "default" : "outline"}
                onClick={() => setMaxWidth(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">
            {t("codeHeading")}
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="mr-1.5 size-4 text-green-600" />
            ) : (
              <Copy className="mr-1.5 size-4" />
            )}
            {copied ? t("copied") : t("copyCode")}
          </Button>
        </div>
        <pre
          tabIndex={0}
          className="mt-3 overflow-x-auto rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground"
        >
          <code>{snippet}</code>
        </pre>
      </div>

      <div className="rounded-2xl border border-border bg-muted/20 p-5">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          {t("previewHeading")}
        </h2>
        <div className="flex justify-center">
          <iframe
            key={iframePath}
            src={iframePath}
            title={titleAttr}
            className="h-[440px] w-full rounded-2xl border border-border bg-background"
            style={{ maxWidth: widthCss }}
          />
        </div>
      </div>
    </div>
  );
}
