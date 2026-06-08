"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Send,
  Bot,
  User,
  AlertCircle,
  Trash2,
  Mic,
  MicOff,
  Sparkles,
  Moon,
  Heart,
  Shield,
  Calculator,
  Check,
  Square,
  RefreshCcw,
  Copy,
  RotateCcw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createChatSession,
  updateChatSession,
  getChatSession,
} from "@/lib/actions/chat-local";
import {
  createGuestSession,
  getGuestSession,
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
// Detects /calculator, /compare <x> vs <y>, /herb <name> and injects
// system context so the AI responds with structured, targeted answers.

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
      systemContext: `The user wants to calculate an herbal dosage.${rest ? ` Details: ${rest}` : " Guide them through the dosage calculation by asking about the herb name, patient age, weight, and adult dose. Explain which formula you would use (Clark's Rule, Young's Rule, BSA, or Fried's Rule) and why."}`,
    };
  }

  if (/^\/compare\s+(.+)/i.test(trimmed)) {
    const args = trimmed.replace(/^\/compare\s+/i, "").trim();
    return {
      command: "compare",
      args,
      systemContext: `The user wants a structured side-by-side comparison between herbs: ${args}. Provide a comparison table covering: scientific names, active compounds, traditional uses, modern applications, typical dosage forms, contraindications, side effects, drug interactions, and pregnancy/nursing safety.`,
    };
  }

  if (/^\/herb\s+(.+)/i.test(trimmed)) {
    const args = trimmed.replace(/^\/herb\s+/i, "").trim();
    return {
      command: "herb",
      args,
      systemContext: `The user wants a comprehensive overview of the herb: ${args}. Provide: scientific name and family, key active compounds with mechanisms, traditional uses (by system), modern evidence-backed uses, typical adult dosage forms and amounts, contraindications, side effects, known drug interactions (with severity), and pregnancy/nursing safety.`,
    };
  }

  return { command: null, args: null, systemContext: null };
}

// ─── Suggestion Card Type ───────────────────────────────────────────

type SuggestionCard = {
  icon: typeof Sparkles;
  text: string;
  gradient: string;
};

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
  const i18nLocale = useLocale();
  const locale = localeProp || i18nLocale;

  function createInitialMessage(): Message {
    return {
      role: "assistant",
      content: t("pharmacist.initialMessage"),
      id: makeId(),
      timestamp: new Date().toISOString(),
    };
  }

  const [messages, setMessages] = useState<Message[]>(() => [
    createInitialMessage(),
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoSent, setAutoSent] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    sessionId || null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [guestId, setLocalGuestId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ─── Per-message actions state ─────────────────────────────────────
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(
    null
  );
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;

  // ─── Init guest ID ────────────────────────────────────────────────

  useEffect(() => {
    async function initGuestId() {
      const id = await getGuestId();
      setLocalGuestId(id);
      await setGuestId(id);
    }
    initGuestId();
  }, []);

  // ─── Load existing session ────────────────────────────────────────

  useEffect(() => {
    async function loadSession() {
      if (!sessionId || !guestId) return;

      const serverSession = await getGuestSession(sessionId, guestId);
      if (serverSession && serverSession.messages.length > 0) {
        const loaded = serverSession.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            id: m.id,
            timestamp: m.createdAt,
          }));
        setMessages(loaded);
        setCurrentSessionId(sessionId);
        setShowSuggestions(false);
        return;
      }

      const localSession = getChatSession(sessionId);
      if (localSession?.messages?.length) {
        setMessages(localSession.messages as ChatMessage[]);
        setCurrentSessionId(sessionId);
        setShowSuggestions(false);
      }
    }
    if (guestId) loadSession();
  }, [sessionId, guestId]);

  // ─── Auto-scroll ──────────────────────────────────────────────────

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ─── Auto-send deep-link queries ──────────────────────────────────

  useEffect(() => {
    if (autoQuery && !autoSent) {
      setAutoSent(true);
      setShowSuggestions(false);
      sendMessage(autoQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoQuery, autoSent]);

  // ─── "Saved" indicator timeout ────────────────────────────────────

  useEffect(() => {
    if (justSaved) {
      const timer = setTimeout(() => setJustSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [justSaved]);

  // ─── Persist messages ─────────────────────────────────────────────

  const saveMessages = useCallback(
    async (msgs: Message[]) => {
      if (msgs.length <= 1 || !guestId) return;

      try {
        setIsSaving(true);

        if (!currentSessionId) {
          const session = await createGuestSession(
            guestId,
            herbContext || undefined
          );
          if (session) {
            setCurrentSessionId(session.id);
            for (const msg of msgs) {
              if (msg.role === "user" || msg.role === "assistant") {
                await addGuestMessage(
                  session.id,
                  msg.role,
                  msg.content,
                  guestId
                );
              }
            }
          } else {
            const localSession = createChatSession(herbContext || undefined);
            setCurrentSessionId(localSession.id);
            updateChatSession(localSession.id, msgs);
          }
        } else {
          const serverSession = await getGuestSession(
            currentSessionId,
            guestId
          );
          if (serverSession) {
            const existingContent = new Set(
              serverSession.messages.map((m) => m.content)
            );
            for (const msg of msgs) {
              if (
                !existingContent.has(msg.content) &&
                (msg.role === "user" || msg.role === "assistant")
              ) {
                await addGuestMessage(
                  currentSessionId,
                  msg.role,
                  msg.content,
                  guestId
                );
              }
            }
          } else {
            updateChatSession(currentSessionId, msgs);
          }
        }

        setJustSaved(true);
      } catch (error) {
        console.error("Failed to save chat:", error);
        if (!currentSessionId) {
          const localSession = createChatSession(herbContext || undefined);
          setCurrentSessionId(localSession.id);
          updateChatSession(localSession.id, msgs);
        } else {
          updateChatSession(currentSessionId, msgs);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [currentSessionId, herbContext, guestId]
  );

  // ─── Send message ─────────────────────────────────────────────────

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;

    // Clear any previous error state
    setLastFailedMessage(null);

    // Parse smart commands before sending
    const { systemContext } = parseCommand(text);

    const userMessage: Message = {
      role: "user",
      content: text.trim(),
      id: makeId(),
      timestamp: new Date().toISOString(),
    };

    const allMessages = [...messages, userMessage];
    setMessages(allMessages);
    setInput("");
    setShowSuggestions(false);
    setIsLoading(true);

    // Reset retry count on new message attempt
    setRetryCount(0);

    // Create abort controller for stop-generation support
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      trackEvent("chat_message_sent");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          herbContext: systemContext
            ? `${herbContext ?? ""}\n\n${systemContext}`.trim() || undefined
            : (herbContext ?? undefined),
          locale,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to get response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const assistantMessage: Message = {
        role: "assistant",
        content: "",
        id: makeId(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        const current = accumulated;

        setMessages((prev) =>
          prev.map((msg, idx) =>
            idx === prev.length - 1 ? { ...msg, content: current } : msg
          )
        );
      }

      setRetryCount(0);
      saveMessages([
        ...allMessages,
        { ...assistantMessage, content: accumulated },
      ]);
    } catch (err: unknown) {
      // Don't show error if user aborted intentionally
      if (err instanceof DOMException && err.name === "AbortError") {
        // Stopped by user — the partial message is already in state, keep it
        return;
      }

      // Automatic retry with exponential backoff for transient errors
      if (retryCount < MAX_RETRIES) {
        const nextRetry = retryCount + 1;
        setRetryCount(nextRetry);

        // Show retrying indicator
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              t("pharmacist.retrying") ||
              `Retrying (${nextRetry}/${MAX_RETRIES})...`,
            id: makeId(),
            timestamp: new Date().toISOString(),
          },
        ]);

        const delay = 1000 * (nextRetry + 1); // 2s, then 3s
        setTimeout(() => {
          // Remove the retrying indicator before retrying
          setMessages((prev) => prev.slice(0, -1));
          sendMessage(text);
        }, delay);
        return;
      }

      // Max retries exceeded — show final error
      setRetryCount(0);

      // Store the failed message for manual retry
      setLastFailedMessage(text.trim());

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t("pharmacist.errorRetry") || t("pharmacist.error"),
          id: makeId(),
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }

  // ─── Stop generation ──────────────────────────────────────────────

  function stopGeneration() {
    abortControllerRef.current?.abort();
  }

  // ─── Regenerate last response ─────────────────────────────────────

  function regenerate() {
    // Find the last user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    // Remove the last assistant message(s) and resend
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].id === lastUserMsg.id) {
        lastUserIdx = i;
        break;
      }
    }

    if (lastUserIdx >= 0) {
      setMessages(messages.slice(0, lastUserIdx + 1));
      // Send after a microtask so state settles
      setTimeout(() => sendMessage(lastUserMsg.content), 0);
    }
  }

  // ─── Retry after error ────────────────────────────────────────────

  function retryFailed() {
    if (!lastFailedMessage) return;
    // Remove the error message (last assistant message)
    setMessages((prev) => prev.slice(0, -1));
    setLastFailedMessage(null);
    setTimeout(() => sendMessage(lastFailedMessage), 0);
  }

  // ─── Copy to clipboard ────────────────────────────────────────────

  async function copyToClipboard(content: string, id: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers / non-HTTPS
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  // ─── Handlers ─────────────────────────────────────────────────────

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  async function clearChat() {
    setMessages([createInitialMessage()]);
    if (currentSessionId && guestId) {
      await deleteGuestSession(currentSessionId, guestId);
    }
    setCurrentSessionId(null);
    setAutoSent(false);
    setShowSuggestions(true);
  }

  // ─── Derived state ────────────────────────────────────────────────

  const suggestionCards: SuggestionCard[] = useMemo(
    () => [
      {
        icon: Moon,
        text: t("pharmacist.suggestedQuestions.0"),
        gradient: "from-indigo-500/10 to-purple-500/10",
      },
      {
        icon: Shield,
        text: t("pharmacist.suggestedQuestions.1"),
        gradient: "from-amber-500/10 to-orange-500/10",
      },
      {
        icon: Heart,
        text: t("pharmacist.suggestedQuestions.2"),
        gradient: "from-rose-500/10 to-pink-500/10",
      },
      {
        icon: Calculator,
        text: t("pharmacist.suggestedQuestions.3"),
        gradient: "from-teal-500/10 to-emerald-500/10",
      },
    ],
    [t]
  );

  const isEmpty = messages.length <= 1 && !isLoading && showSuggestions;
  const lastMessage = messages[messages.length - 1];
  const showFollowUps =
    !isLoading && lastMessage?.role === "assistant" && messages.length > 1;

  function getFollowUpQuestions(content: string): string[] {
    const lower = content.toLowerCase();
    const questions: string[] = [];

    if (
      lower.includes("dosage") ||
      lower.includes("dose") ||
      lower.includes("mg") ||
      lower.includes("ml")
    ) {
      questions.push(t("pharmacist.followUp.childDosage"));
    } else {
      questions.push(t("pharmacist.followUp.recommendedDosage"));
    }

    if (lower.includes("interaction") || lower.includes("contraindic")) {
      questions.push(t("pharmacist.followUp.saferAlternatives"));
    } else {
      questions.push(t("pharmacist.followUp.interactions"));
    }

    if (lower.includes("side effect") || lower.includes("adverse")) {
      questions.push(t("pharmacist.followUp.sideEffects"));
    } else {
      questions.push(t("pharmacist.followUp.sideEffectsInfo"));
    }

    return questions;
  }

  const followUpQuestions = showFollowUps
    ? getFollowUpQuestions(lastMessage.content)
    : [];

  const stats = [
    { value: "2,700+", label: t("home.stats.herbs") },
    { value: "500+", label: t("home.stats.interactions") },
    { value: "100%", label: t("home.stats.free") },
  ];

  const conversationTitle = useMemo(() => {
    const firstUserMsg = messages.find((m) => m.role === "user");
    if (!firstUserMsg) return null;
    const text = firstUserMsg.content;
    return text.length > 55 ? text.slice(0, 52) + "…" : text;
  }, [messages]);

  // ─── Voice input ──────────────────────────────────────────────────

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof createRecognition>>(null);

  function createRecognition() {
    if (typeof window === "undefined") return null;
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    return new (SpeechRecognition as new () => {
      continuous: boolean;
      interimResults: boolean;
      onresult: ((e: { results: { transcript: string }[][] }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    })();
  }

  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = createRecognition();
    if (!recognition) return;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript;
      if (transcript) {
        setInput((prev) => prev + transcript);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  // Defer voice support detection to avoid hydration mismatch.
  // Server always renders false; client sets true after mount.
  const [hasVoiceSupport, setHasVoiceSupport] = useState(false);
  useEffect(() => {
    setHasVoiceSupport(
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window
    );
  }, []);

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* ═══ EMPTY STATE: centered, inviting, ChatGPT-style ═══ */}
      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-6">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm">
            <Sparkles className="size-4" />
            <span>{t("homeAI.badge")}</span>
          </div>

          {/* Heading */}
          <h1 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("homeAI.title")}
          </h1>
          <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
            {t("homeAI.subtitle")}
          </p>

          {/* Centered large input */}
          <div className="mt-8 w-full max-w-xl">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("pharmacist.placeholder")}
                className="min-h-[52px] max-h-40 resize-none pr-2 text-base shadow-lg focus-ring-animated"
                rows={1}
                disabled={isLoading}
                aria-label="Chat message input"
                autoFocus
              />
              {hasVoiceSupport && (
                <Button
                  type="button"
                  size="icon"
                  variant={isListening ? "destructive" : "outline"}
                  onClick={toggleVoice}
                  className="shrink-0"
                  aria-label={
                    isListening
                      ? t("pharmacist.voiceStop")
                      : t("pharmacist.voiceStart")
                  }
                >
                  {isListening ? (
                    <MicOff className="size-4" />
                  ) : (
                    <Mic className="size-4" />
                  )}
                </Button>
              )}
              {isLoading ? (
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  onClick={stopGeneration}
                  aria-label="Stop generating"
                  className="shadow-lg animate-pulse"
                >
                  <Square className="size-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  aria-label="Send message"
                  className="shadow-lg"
                >
                  <Send className="size-4" />
                </Button>
              )}
            </form>

            {/* Command hints */}
            <p className="mt-2 text-center text-xs text-muted-foreground/60">
              {t("pharmacist.commandHint")}
            </p>
          </div>

          {/* Suggestion cards — grid of 2 on mobile, 4 on desktop */}
          <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
            {suggestionCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.text}
                  type="button"
                  onClick={() => sendMessage(card.text)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-4 text-left text-sm font-medium transition-all",
                    "bg-gradient-to-br",
                    card.gradient,
                    "hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
                    "text-foreground border-border/60"
                  )}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/80">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <span className="line-clamp-2">{card.text}</span>
                </button>
              );
            })}
          </div>

          {/* Stats — subtle trust bar */}
          <div className="mt-8 flex items-center gap-3">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                {i > 0 && <span className="text-border">•</span>}
                <span className="font-semibold text-foreground">
                  {stat.value}
                </span>
                <span className="hidden sm:inline">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ═══ ACTIVE CHAT STATE ═══ */
        <>
          {/* Slim conversation bar */}
          <div className="flex items-center justify-between border-b px-4 py-2 shrink-0">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="size-3.5" />
              </div>
              {conversationTitle && (
                <span className="truncate text-sm font-medium text-foreground">
                  {conversationTitle}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={clearChat}
              className="h-8 shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">{t("pharmacist.clear")}</span>
            </Button>
          </div>

          {/* Messages scroll area — flex-1 min-h-0 is critical for overflow */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 min-h-0"
            role="log"
            aria-label="Chat messages"
          >
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 animate-message-in",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Bot className="size-4" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "relative max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <>
                        {message.content === t("pharmacist.error") ? (
                          <div className="flex flex-col gap-2">
                            <p className="text-sm text-muted-foreground">
                              {message.content}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={retryFailed}
                              className="w-fit gap-1.5 text-xs"
                            >
                              <RotateCcw className="size-3" />
                              {t("pharmacist.retry")}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              <ReactMarkdown>{message.content}</ReactMarkdown>
                            </div>
                            {/* Action buttons: Copy + Regenerate */}
                            <div className="mt-2 flex items-center gap-1 border-t pt-2 border-border/40">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  copyToClipboard(message.content, message.id)
                                }
                                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                aria-label="Copy response"
                              >
                                {copiedId === message.id ? (
                                  <>
                                    <Check className="size-3 text-emerald-500" />
                                    <span className="text-emerald-500">
                                      {t("pharmacist.copied")}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3" />
                                    <span>{t("pharmacist.copy")}</span>
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={regenerate}
                                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                aria-label="Regenerate response"
                              >
                                <RefreshCcw className="size-3" />
                                <span className="hidden sm:inline">
                                  {t("pharmacist.regenerate")}
                                </span>
                              </Button>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground">
                      <User className="size-4" />
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading &&
                messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex gap-3 animate-message-in">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Bot className="size-4 animate-pulse" />
                    </div>
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("pharmacist.thinking")}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="size-2 rounded-full bg-primary/70 animate-typing-dot" />
                          <span className="size-2 rounded-full bg-primary/70 animate-typing-dot [animation-delay:160ms]" />
                          <span className="size-2 rounded-full bg-primary/70 animate-typing-dot [animation-delay:320ms]" />
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              {/* Follow-up suggestion chips */}
              {showFollowUps && (
                <div className="flex flex-wrap gap-2 pt-1 animate-message-in">
                  {followUpQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground transition-all hover:border-primary/30 hover:text-primary"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ Disclaimer bar (always visible at bottom) ═══ */}
      <div className="shrink-0 border-t bg-amber-50/50 px-4 py-2 dark:bg-amber-950/10">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="size-3 shrink-0" />
            {t("pharmacist.disclaimer")}
          </p>
          <div className="flex items-center gap-2">
            {justSaved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="size-3" />
                {t("pharmacist.saved")}
              </span>
            )}
            {isSaving && !justSaved && (
              <span className="text-xs text-muted-foreground">
                {t("pharmacist.saving")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Bottom input (only in active state) ═══ */}
      {!isEmpty && (
        <div className="shrink-0 border-t p-4">
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex max-w-3xl items-end gap-2"
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("pharmacist.placeholder")}
              className="min-h-[44px] max-h-32 resize-none focus-ring-animated"
              rows={1}
              disabled={isLoading}
              aria-label="Chat message input"
            />
            {hasVoiceSupport && (
              <Button
                type="button"
                size="icon"
                variant={isListening ? "destructive" : "outline"}
                onClick={toggleVoice}
                className="shrink-0"
                aria-label={
                  isListening
                    ? t("pharmacist.voiceStop")
                    : t("pharmacist.voiceStart")
                }
              >
                {isListening ? (
                  <MicOff className="size-4" />
                ) : (
                  <Mic className="size-4" />
                )}
              </Button>
            )}
            {isLoading ? (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={stopGeneration}
                aria-label="Stop generating"
                className="animate-pulse"
              >
                <Square className="size-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
              >
                <Send className="size-4" />
              </Button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
