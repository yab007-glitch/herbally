"use client";

import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface ChatEmptyStateV2Props {
  onSendMessage: (text: string) => void;
}

/**
 * The assistant speaks first.
 *
 * This is the first thing a visitor sees on /herbalist, so it does three jobs
 * in two sentences: say what HerbAlly actually does (checks herbs against the
 * medications you take, with the evidence behind each answer), ask one
 * question, and offer three tappable ways in for people who don't want to type.
 *
 * It is deliberately scripted, not generated. A model call on page load would
 * cost money for every visitor who bounces, arrive behind a spinner, and say
 * something different every time — and the opening line is the one piece of
 * copy that most needs to be exact. The model takes over the moment the person
 * replies.
 *
 * The three chips are not decoration: each one either teaches a capability or
 * starts a real check. Nothing here asks about symptoms — a bot that invites
 * symptom descriptions is inviting people to expect a diagnosis.
 */
export function ChatEmptyStateV2({ onSendMessage }: ChatEmptyStateV2Props) {
  const t = useTranslations();

  // Each chip sends the prompt in the visitor's language. The previous version
  // hardcoded English prompts, so a French visitor tapping a chip started an
  // English conversation.
  const quickReplies = [
    "quickCheckHerb",
    "quickInteractions",
    "quickCapabilities",
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Leaf className="size-4" />
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted/60 px-4 py-3 text-sm leading-relaxed text-foreground">
          <p>{t("herbalistPage.greeting.intro")}</p>
          <p className="mt-2 font-medium">
            {t("herbalistPage.greeting.question")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pl-10">
        {quickReplies.map((key) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            onClick={() =>
              onSendMessage(t(`herbalistPage.greeting.${key}Prompt`))
            }
            className="h-auto rounded-full px-3 py-1.5 text-xs font-normal"
          >
            {t(`herbalistPage.greeting.${key}`)}
          </Button>
        ))}
      </div>

      <p className="pl-10 text-xs text-muted-foreground">
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
        {" · "}
        <Link
          href="/herb-drug-interactions"
          className="underline underline-offset-2 hover:text-foreground"
        >
          {t("herbalistPage.learnInteractions")}
        </Link>
      </p>
    </div>
  );
}
