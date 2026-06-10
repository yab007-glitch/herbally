"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Send,
  AlertCircle,
  Check,
  Copy,
  RotateCcw,
  Leaf,
  ArrowDown,
} from "lucide-react";
import { ChatMarkdown } from "./markdown-renderer";
import { ChatEmptyStateV2 } from "./chat-empty-state-v2";
import { evaluateAssistantContent } from "@/lib/chat/safety-guard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  createGuestSession,
  addGuestMessage,
  deleteGuestSession,
} from "@/lib/actions/chat-persist";
import { getGuestId, setGuestId } from "@/lib/actions/guest-id";
import type { ChatMessage } from "@/lib/actions/chat";
import { useTranslations, useLocale } from "next-intl";
import { trackEvent } from "@/lib/analytics";

type Message = ChatMessage;

function makeId() {
  return Math.random().toString(36).slice(2);
}

// ─── Smart Command Parser ───────────────────────────────────────────

function parseCommand(text: string): {
  command: string | null;
  args: string | null;
  systemContext: string | null;
} {
  const trimmed = text.trim();

  if (/^\/calculator\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^\/calculator\s*/i, "").trim();
    return {
      command: "calculator",
      args: rest || null,
      systemContext: `The user wants to calculate an herbal dosage.${rest ? ` Details: ${rest}` : " Guide them through the dosage calculation by asking about the herb name, patient age, weight, and adult dose."}`,
    };
  }

  if (/^\/compare\s+(.+)/i.test(trimmed)) {
    const args = trimmed.replace(/^\/compare\s+/i, "").trim();
    return {
      command: "compare",
      args,
      systemContext: `The user wants a comparison between herbs: ${args}. Provide a structured comparison.`,
    };
  }

  if (/^\/herb\s+(.+)/i.test(trimmed)) {
    const args = trimmed.replace(/^\/herb\s+/i, "").trim();
    return {
      command: "herb",
      args,
      systemContext: `The user wants a comprehensive overview of: ${args}. Provide: scientific name, active compounds, uses, dosage, contraindications, side effects, and drug interactions.`,
    };
  }

  return { command: null, args: null, systemContext: null };
}

// ─── Follow-up question generator ───────────────────────────────────

function generateFollowUps(
  lastAssistantMessage: string,
  herbContext?: string | null
): string[] {
  const hasHerb =
    herbContext && herbContext.length > 20;
  const base = [
    "What are the side effects?",
    "What's the recommended dosage?",
    "Is it safe during pregnancy?",
  ];
  if (hasHerb) {
    base.push("Any drug interactions I should know about?");
    base.push("What does the research say?");
  }
  return base.slice(0, 4);
}

// ─── Component ──────────────────────────────────────────────────────

export function ChatInterface({
  herbContext,
  autoQuery,
  locale: localeProp = "en",
  sessionId,
}: {
  herbContext?: string | null;
  autoQuery?: string | null;
  locale?: string;
  sessionId?: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale();

  // ── State ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [sessionIdState, setSessionIdState] = useState<string | null>(
    sessionId ?? null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasSentMessage, setHasSentMessage] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const lastAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);

  const showFollowUps =
    !isLoading &&
    lastAssistantMessage?.role === "assistant" &&
    messages.length > 1;

  const followUpQuestions = useMemo(() => {
    if (!showFollowUps || !lastAssistantMessage) return [];
    return generateFollowUps(lastAssistantMessage.content, herbContext);
  }, [showFollowUps, lastAssistantMessage, herbContext]);

  const isEmpty = messages.length === 0 && !isLoading;

  // ── Scroll management ──
  const scrollToBottom = useCallback((smooth = false) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  useEffect(() => {
    if (!showScrollButton) scrollToBottom();
  }, [messages, streamingContent, showScrollButton, scrollToBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setShowScrollButton(!atBottom);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Auto-send on mount ──
  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSent.current) return;
    if (autoQuery && messages.length === 0 && !isLoading) {
      autoSent.current = true;
      sendMessage(autoQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoQuery]);

  // ── Session persistence ──
  useEffect(() => {
    if (messages.length <= 1) return;
    const save = async () => {
      setIsSaving(true);
      try {
        const guestId = await getGuestId();
        if (!guestId) {
          const newId = makeId();
          await setGuestId(newId);
        }
        const gid = (await getGuestId()) ?? "unknown";
        if (!sessionIdState) {
          const session = await createGuestSession(gid, messages[0]?.content.slice(0, 60) ?? "Chat");
          if (session) {
            const sid = session.id;
            setSessionIdState(sid);
            for (const msg of messages) {
              await addGuestMessage(sid, msg.role as "user" | "assistant", msg.content, gid);
            }
          }
        } else {
          const gid2 = (await getGuestId()) ?? "unknown";
          await addGuestMessage(sessionIdState, messages[messages.length - 1].role as "user" | "assistant", messages[messages.length - 1].content, gid2);
        }
      } catch {
        // Silent fail
      } finally {
        setIsSaving(false);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      }
    };
    const timer = setTimeout(save, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // ── Send message ──
  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    setHasSentMessage(true);
    const userMessage: Message = {
      id: makeId(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");
    setShowScrollButton(false);

    // Parse commands
    const command = parseCommand(content);
    const overrideContext = command.systemContext;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const msgs = [
        ...messages.filter((m) => m.role !== ("system" as never)),
        userMessage,
      ];
      const body: Record<string, unknown> = {
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        locale: locale || localeProp,
      };
      if (overrideContext || herbContext) {
        body.herbContext = overrideContext || herbContext;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            content: err.error || t("pharmacist.error"),
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += decoder.decode(value, { stream: true });
        setStreamingContent(fullContent);
        scrollToBottom();
      }

      // Run safety guard
      const safety = evaluateAssistantContent(
        fullContent,
        locale === "fr" ? "fr" : "en"
      );

      let finalContent = fullContent;
      if (safety.verdict === "block") {
        finalContent = safety.appended ?? fullContent;
      } else if (safety.verdict === "warn" && safety.appended) {
        finalContent += safety.appended;
      }

      setStreamingContent("");
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: finalContent,
          timestamp: new Date().toISOString(),
        },
      ]);

      trackEvent("chat_message_sent", { hasHerbContext: !!herbContext });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setStreamingContent("");
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: t("pharmacist.error"),
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
    if (streamingContent) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: streamingContent,
          timestamp: new Date().toISOString(),
        },
      ]);
      setStreamingContent("");
    }
    setIsLoading(false);
  }

  const retryFailed = useCallback(() => {
    setMessages((prev) => prev.slice(0, -1));
    sendMessage(messages[messages.length - 2]?.content ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  }

  function clearChat() {
    if (sessionIdState) {
      getGuestId().then(gid => {
        if (gid) deleteGuestSession(sessionIdState, gid).catch(() => {});
      });
    }
    setMessages([]);
    setSessionIdState(null);
    setStreamingContent("");
    setHasSentMessage(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Adjust textarea height
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  // Focus input on mount
  useEffect(() => {
    if (isEmpty && inputRef.current && !autoQuery) {
      inputRef.current.focus();
    }
  }, [isEmpty, autoQuery]);

  // ── Render ──
  return (
    <div className="flex flex-col h-[calc(100dvh-12rem)] sm:h-[calc(100dvh-10rem)] rounded-2xl border border-border bg-card overflow-hidden">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-hide"
        role="log"
        aria-label="Chat messages"
      >
        {isEmpty ? (
          <div className="flex h-full items-center justify-center p-6">
            <ChatEmptyStateV2 onSendMessage={sendMessage} />
          </div>
        ) : (
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
                              onClick={retryFailed}
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
                          {/* Copy button — show on hover */}
                          <button
                            onClick={() => copyToClipboard(message.content, message.id)}
                            className="absolute -bottom-1 right-0 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                            aria-label="Copy response"
                          >
                            {copiedId === message.id ? (
                              <>
                                <Check className="size-3 text-green-600" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" />
                                Copy
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

            {/* Streaming message */}
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

            {/* Loading dots (waiting for first token) */}
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

            {/* Follow-up suggestions */}
            {showFollowUps && followUpQuestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 animate-message-in">
                {followUpQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Spacer for scroll */}
            <div className="h-2" />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() => {
            scrollToBottom(true);
            setShowScrollButton(false);
          }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-md hover:text-foreground transition-all"
        >
          <ArrowDown className="size-3" />
          New messages
        </button>
      )}

      {/* Disclaimer — subtle */}
      <div className="shrink-0 border-t border-border/50 px-4 py-1.5 text-center">
        <p className="text-[10px] text-muted-foreground/60">
          <AlertCircle className="inline size-2.5 -mt-0.5 mr-1" />
          {t("pharmacist.disclaimer")}
        </p>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border/50 px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 mx-auto max-w-2xl">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("pharmacist.placeholder")}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
              rows={1}
              disabled={isLoading}
              aria-label="Chat message input"
            />
          </div>
          {isLoading ? (
            <button
              type="button"
              onClick={stopGeneration}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              aria-label="Stop generating"
            >
              <div className="size-3 rounded-sm bg-destructive" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 transition-all"
              aria-label="Send message"
            >
              <Send className="size-4" />
            </button>
          )}
        </form>

        {/* Footer row: clear + save status */}
        {hasSentMessage && (
          <div className="mt-2 flex items-center justify-between mx-auto max-w-2xl">
            <button
              onClick={clearChat}
              className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              Clear conversation
            </button>
            <span className="text-[10px] text-muted-foreground/60">
              {isSaving ? "Saving..." : justSaved ? "✓ Saved" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Donation prompt */}
      {messages.length >= 3 && (
        <div className="shrink-0 border-t border-primary/10 bg-primary/5 px-4 py-1.5 text-center">
          <p className="text-[10px] text-muted-foreground">
            {t("donate.promptAfterUse")}{" "}
            <a
              href="/donate"
              className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {t("donate.promptLink")}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
