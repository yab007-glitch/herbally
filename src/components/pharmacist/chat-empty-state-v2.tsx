"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface ChatEmptyStateV2Props {
  onSendMessage: (text: string) => void;
}

const SUGGESTIONS = [
  {
    text: "Is turmeric safe with blood thinners?",
    labelKey: "pharmacist.suggestionLabels.turmericBloodThinners",
  },
  {
    text: "What herbs help with anxiety?",
    labelKey: "pharmacist.suggestionLabels.herbsForAnxiety",
  },
  {
    text: "Can I take echinacea while pregnant?",
    labelKey: "pharmacist.suggestionLabels.echinaceaPregnancy",
  },
  {
    text: "Tell me about ginger for nausea",
    labelKey: "pharmacist.suggestionLabels.gingerForNausea",
  },
];

export function ChatEmptyStateV2({ onSendMessage }: ChatEmptyStateV2Props) {
  const t = useTranslations();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <p className="text-sm text-muted-foreground">
        {t("herbalistPage.emptyStateTitle")}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <Button
            key={s.text}
            variant="outline"
            size="sm"
            onClick={() => onSendMessage(s.text)}
          >
            {t(s.labelKey)}
          </Button>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        <Link
          href="/herbs"
          className="underline underline-offset-2 hover:text-foreground"
        >
          {t("herbalistPage.browseHerbs")}
        </Link>
        {" · "}
        <Link
          href="/calculator"
          className="underline underline-offset-2 hover:text-foreground"
        >
          {t("nav.calculator")}
        </Link>
      </p>
    </div>
  );
}
