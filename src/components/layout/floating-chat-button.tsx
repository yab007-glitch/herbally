"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X, Send, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const QUICK_QUESTIONS = [
  "Is this herb safe with my medication?",
  "What dosage should I take?",
  "Any side effects I should know?",
];

export function FloatingChatButton() {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [hasOpened, setHasOpened] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  function handleSend(text?: string) {
    const q = text || input.trim();
    if (!q) return;
    setOpen(false);
    setInput("");
    router.push(`/herbalist?q=${encodeURIComponent(q)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSend();
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => {
          setOpen(!open);
          if (!hasOpened) setHasOpened(true);
        }}
        className={cn(
          "fixed bottom-20 right-4 z-40 flex size-12 items-center justify-center rounded-full shadow-lg transition-all md:bottom-6",
          open
            ? "bg-muted text-foreground rotate-90"
            : "bg-primary text-primary-foreground hover:scale-105 hover:shadow-xl"
        )}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </button>

      {/* Chat drawer */}
      {open && (
        <div className="fixed bottom-36 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-border bg-background shadow-2xl md:bottom-20">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Leaf className="size-3.5" />
            </div>
            <span className="text-sm font-medium text-foreground">
              {t("herbalistPage.title")}
            </span>
          </div>

          {/* Quick questions */}
          <div className="space-y-1.5 p-4">
            <p className="text-xs text-muted-foreground">
              {t("home.suggestionsTitle")}
            </p>
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-border px-3 py-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("home.herbPlaceholder")}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
            <Button
              size="sm"
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="size-8 p-0 rounded-lg"
            >
              <Send className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
