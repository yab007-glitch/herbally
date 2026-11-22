"use client";

import { Check, Copy, Leaf, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "./markdown-renderer";
import type { Message } from "./chat-helpers";

interface ChatMessageListProps {
  messages: Message[];
  isLoading: boolean;
  streamingContent: string;
  copiedId: string | null;
  followUpQuestions: string[];
  showFollowUps: boolean;
  onRetryFailed: () => void;
  onCopy: (text: string, id: string) => void;
  onFollowUp: (question: string) => void;
}

export function ChatMessageList({
  messages,
  isLoading,
  streamingContent,
  copiedId,
  followUpQuestions,
  showFollowUps,
  onRetryFailed,
  onCopy,
  onFollowUp,
}: ChatMessageListProps) {
  const t = useTranslations();

  return (
    <div className="mx-auto max-w-2xl space-y-1 px-4 py-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex gap-2 animate-message-in",
            message.role === "user" ? "justify-end" : "justify-start"
          )}
        >
          {message.role === "user" ? (
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/10 px-4 py-2.5 text-sm leading-relaxed text-foreground">
              {message.content}
            </div>
          ) : (
            <div className="flex gap-2 max-w-[85%]">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                <Leaf className="size-3" />
              </div>
              <div className="min-w-0">
                {message.content === t("pharmacist.error") ? (
                  <div className="rounded-2xl rounded-bl-md bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
                    <div className="flex flex-col gap-2">
                      <p>{message.content}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onRetryFailed}
                        className="w-fit gap-1 text-xs"
                      >
                        <RotateCcw className="size-3" />
                        {t("pharmacist.retry")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="group relative rounded-2xl rounded-bl-md bg-muted/60 px-4 py-2.5 text-sm leading-relaxed text-foreground">
                    <ChatMarkdown>{message.content}</ChatMarkdown>
                    <button
                      onClick={() => onCopy(message.content, message.id)}
                      className="absolute -bottom-1 right-0 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                      aria-label={t("common.copyResponseLabel")}
                    >
                      {copiedId === message.id ? (
                        <>
                          <Check className="size-3 text-green-600" />
                          {t("common.copied")}
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          {t("common.copy")}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {isLoading && streamingContent && (
        <div className="flex gap-2 animate-message-in">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
            <Leaf className="size-3" />
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted/60 px-4 py-2.5 text-sm leading-relaxed text-foreground">
            <ChatMarkdown>{streamingContent}</ChatMarkdown>
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/60 animate-pulse rounded-sm align-middle" />
          </div>
        </div>
      )}

      {isLoading && !streamingContent && (
        <div className="flex gap-2 animate-message-in">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
            <Leaf className="size-3" />
          </div>
          <div className="rounded-2xl rounded-bl-md bg-muted/60 px-4 py-2.5">
            <div className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce" />
              <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.15s]" />
              <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.3s]" />
            </div>
          </div>
        </div>
      )}

      {showFollowUps && followUpQuestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 animate-message-in">
          {followUpQuestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onFollowUp(q)}
              className="rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="h-2" />
    </div>
  );
}
