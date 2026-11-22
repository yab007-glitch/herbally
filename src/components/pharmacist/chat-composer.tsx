"use client";

import type { RefObject } from "react";
import { AlertCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";

interface ChatComposerProps {
  input: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isLoading: boolean;
  isRestoring: boolean;
  isDeleting: boolean;
  hasSentMessage: boolean;
  messageCount: number;
  saveStatus: "idle" | "saving" | "saved" | "failed";
  deleteError: boolean;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  onClear: () => void;
  onRetrySave: () => void;
}

export function ChatComposer({
  input,
  inputRef,
  isLoading,
  isRestoring,
  isDeleting,
  hasSentMessage,
  messageCount,
  saveStatus,
  deleteError,
  onInputChange,
  onKeyDown,
  onSubmit,
  onStop,
  onClear,
  onRetrySave,
}: ChatComposerProps) {
  const t = useTranslations();

  return (
    <>
      <div className="shrink-0 border-t border-border/50 px-4 py-1.5 text-center">
        <p className="text-[10px] text-muted-foreground">
          <AlertCircle className="inline size-2.5 -mt-0.5 mr-1" />
          {t("pharmacist.disclaimer")} {t("common.citationsDisclaimer")}
        </p>
      </div>

      <div className="shrink-0 border-t border-border/50 px-4 py-3">
        <form
          onSubmit={onSubmit}
          className="flex items-end gap-2 mx-auto max-w-2xl"
        >
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("pharmacist.placeholder")}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
              rows={1}
              disabled={isLoading || isRestoring || isDeleting}
              aria-label={t("common.chatInputlabel")}
            />
          </div>
          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              aria-label={t("common.stopGeneratingLabel")}
            >
              <div className="size-3 rounded-sm bg-destructive" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isRestoring || isDeleting}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 transition-all"
              aria-label={t("common.sendMessageLabel")}
            >
              <Send className="size-4" />
            </button>
          )}
        </form>

        {hasSentMessage && (
          <div className="mt-2 mx-auto max-w-2xl">
            <div className="flex items-center justify-between">
              <button
                onClick={onClear}
                disabled={isDeleting || isRestoring}
                className="text-[10px] text-muted-foreground hover:text-muted-foreground transition-colors disabled:opacity-50"
              >
                {isDeleting
                  ? t("common.clearing")
                  : t("common.clearConversation")}
              </button>
              <span className="text-[10px] text-muted-foreground">
                {saveStatus === "saving" ? (
                  t("common.saving")
                ) : saveStatus === "saved" ? (
                  t("common.saved")
                ) : saveStatus === "failed" ? (
                  <button
                    type="button"
                    onClick={onRetrySave}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {t("common.saveFailed")}
                  </button>
                ) : (
                  ""
                )}
              </span>
            </div>
            {deleteError && (
              <p
                role="alert"
                className="mt-1 text-[10px] text-destructive text-right"
              >
                {t("common.deleteFailed")}
              </p>
            )}
          </div>
        )}
      </div>

      {messageCount >= 3 && (
        <div className="shrink-0 border-t border-primary/10 bg-primary/5 px-4 py-1.5 text-center">
          <p className="text-[10px] text-muted-foreground">
            {t("donate.promptAfterUse")}{" "}
            <Link
              href="/donate"
              className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {t("donate.promptLink")}
            </Link>
          </p>
        </div>
      )}
    </>
  );
}
