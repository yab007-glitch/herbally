"use client";

import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ShareButtonsProps {
  title: string;
  url: string;
  className?: string;
}

export function ShareButtons({ title, url, className }: ShareButtonsProps) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  const shareText = encodeURIComponent(title);
  const shareUrl = encodeURIComponent(url);

  const links = [
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
      color: "hover:bg-black hover:text-white",
    },
    {
      label: "FB",
      href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
      color: "hover:bg-blue-600 hover:text-white",
    },
    {
      label: "in",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
      color: "hover:bg-blue-700 hover:text-white",
    },
  ];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground">
        <Share2 className="inline size-4 -mt-0.5" /> {t("common.shareLabel")}
      </span>
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share on ${link.label}`}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md border border-border text-xs font-semibold text-muted-foreground transition-colors hover:border-transparent",
            link.color
          )}
        >
          {link.label}
        </a>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={copyLink}
        aria-label={copied ? t("common.copied") : t("common.copyLinkLabel")}
        aria-live="polite"
        className="inline-flex size-8 items-center justify-center p-0"
      >
        {copied ? (
          <Check className="size-4 text-green-600" />
        ) : (
          <Copy className="size-4" />
        )}
        {/* Screen-reader announcement: the icon swap alone is invisible to
            AT, so "Copied" was previously never announced. */}
        <span role="status" className="sr-only">
          {copied ? t("common.copied") : ""}
        </span>
      </Button>
    </div>
  );
}
