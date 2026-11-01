"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, X, Send, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/** Session flag: the teaser has already been shown this visit. */
const TEASER_SEEN_KEY = "herbally.chat.teaser.seen";
/** localStorage timestamp of the last dismissal. */
const TEASER_DISMISSED_KEY = "herbally.chat.teaser.dismissedAt";
/** How long a dismissal silences the teaser. */
const TEASER_QUIET_MS = 7 * 24 * 60 * 60 * 1000;
/** Wait before speaking: long enough not to compete with the page settling. */
const TEASER_DELAY_MS = 2_500;
/** Give up if nobody engages. */
const TEASER_LIFETIME_MS = 15_000;

function readStorage(get: () => string | null): string | null {
  try {
    return get();
  } catch {
    // Storage can throw in private browsing and in some embedded webviews.
    return null;
  }
}

function writeStorage(set: () => void): void {
  try {
    set();
  } catch {
    // Ignore: the teaser simply behaves as if it were never dismissed.
  }
}

/**
 * Floating entry point to the virtual herbalist.
 *
 * The assistant introduces itself once, in a small bubble, on the homepage —
 * it does not open a panel over the page. Arriving at a site and being talked
 * at is the fastest way to make someone leave; a bubble is an invitation the
 * visitor can ignore. Once dismissed it stays quiet for a week, once shown it
 * stays quiet for the rest of the visit, and it never appears on interior
 * pages where the floating button is enough.
 */
export function FloatingChatButton() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [input, setInput] = useState("");
  const [hasOpened, setHasOpened] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickQuestions = [
    t("herbalistPage.widgetQ1"),
    t("herbalistPage.widgetQ2"),
    t("herbalistPage.widgetQ3"),
  ];

  // Homepage only: "/" is the English home, "/fr" the French one.
  const isHome = pathname === "/" || pathname === "/fr";

  useEffect(() => {
    if (!isHome || open || hasOpened) return;

    const dismissedAt = Number(
      readStorage(() => window.localStorage.getItem(TEASER_DISMISSED_KEY))
    );
    if (
      Number.isFinite(dismissedAt) &&
      Date.now() - dismissedAt < TEASER_QUIET_MS
    )
      return;
    if (readStorage(() => window.sessionStorage.getItem(TEASER_SEEN_KEY)))
      return;

    const show = window.setTimeout(() => {
      setTeaser(true);
      writeStorage(() => window.sessionStorage.setItem(TEASER_SEEN_KEY, "1"));
    }, TEASER_DELAY_MS);

    return () => window.clearTimeout(show);
  }, [isHome, open, hasOpened]);

  // Stop hovering once it has had its moment; a bubble that never leaves is
  // just a permanent banner.
  useEffect(() => {
    if (!teaser) return;
    const hide = window.setTimeout(() => setTeaser(false), TEASER_LIFETIME_MS);
    return () => window.clearTimeout(hide);
  }, [teaser]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const dismissTeaser = useCallback(() => {
    setTeaser(false);
    writeStorage(() =>
      window.localStorage.setItem(TEASER_DISMISSED_KEY, String(Date.now()))
    );
  }, []);

  function handleSend(text?: string) {
    const q = text || input.trim();
    if (!q) return;
    setOpen(false);
    setTeaser(false);
    setInput("");
    router.push(`/herbalist?q=${encodeURIComponent(q)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSend();
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <>
      {/* The greeting bubble — shown once, on the homepage. */}
      {teaser && !open && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-36 right-4 z-40 w-[calc(100vw-2rem)] max-w-[17rem] rounded-2xl rounded-br-md border border-border bg-background p-3.5 shadow-xl transition-all duration-300 motion-reduce:transition-none md:bottom-20"
        >
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Leaf className="size-3.5" />
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {t("herbalistPage.greeting.bubbleText")}
            </p>
            <button
              onClick={dismissTeaser}
              aria-label={t("herbalistPage.greeting.bubbleDismiss")}
              className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="mt-2.5 flex justify-end gap-2">
            <button
              onClick={dismissTeaser}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("herbalistPage.greeting.bubbleDismiss")}
            </button>
            <Button
              size="sm"
              className="h-7 rounded-md px-2.5 text-xs"
              onClick={() => {
                setTeaser(false);
                setOpen(true);
                setHasOpened(true);
              }}
            >
              {t("herbalistPage.greeting.bubbleOpen")}
            </Button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => {
          setOpen(!open);
          setTeaser(false);
          if (!hasOpened) setHasOpened(true);
        }}
        className={cn(
          "fixed bottom-20 right-4 z-40 flex size-12 items-center justify-center rounded-full shadow-lg transition-all md:bottom-6",
          open
            ? "bg-muted text-foreground rotate-90"
            : "bg-primary text-primary-foreground hover:scale-105 hover:shadow-xl"
        )}
        aria-label={
          open ? t("herbalistPage.widgetClose") : t("herbalistPage.widgetOpen")
        }
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
            {quickQuestions.map((q) => (
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
              placeholder={t("herbalistPage.widgetPlaceholder")}
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
