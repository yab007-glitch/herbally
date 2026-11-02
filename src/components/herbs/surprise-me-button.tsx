"use client";

import { useTransition } from "react";
import { useLocalizedRouter as useRouter } from "@/components/i18n/use-localized-router";
import { Shuffle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

export function SurpriseMeButton({ totalHerbs }: { totalHerbs: number }) {
  const router = useRouter();
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();

  function handleSurprise() {
    const randomPage =
      Math.floor(Math.random() * Math.ceil(totalHerbs / 20)) + 1;
    // Previously this was a bare router.push with no feedback, so the
    // button appeared dead on first click while navigation resolved.
    // Wrapping it in a transition exposes isPending for a spinner,
    // a disabled state, and aria-busy — the same pattern SmartSearch
    // already uses for its search submit.
    startTransition(() => {
      router.push(`/herbs?page=${randomPage}`);
    });
  }

  return (
    <button
      onClick={handleSurprise}
      type="button"
      disabled={isPending}
      aria-busy={isPending}
    >
      <Badge
        variant="outline"
        className="cursor-pointer gap-1 border-primary/30 bg-primary/5 text-primary transition-all hover:bg-primary/10 hover:shadow-sm"
      >
        {isPending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Shuffle className="size-3" />
        )}
        {isPending ? t("common.loading") : t("search.surpriseMe")}
      </Badge>
    </button>
  );
}
