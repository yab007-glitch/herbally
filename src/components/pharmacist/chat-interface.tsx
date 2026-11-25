"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useDeferredValue,
  useSyncExternalStore,
} from "react";
import { RotateCcw, ArrowDown } from "lucide-react";
import { ChatEmptyStateV2 } from "./chat-empty-state-v2";
import { ChatMessageList } from "./chat-message-list";
import { ChatComposer } from "./chat-composer";
import { Button } from "@/components/ui/button";
import {
  createChatSession,
  addChatMessage,
  deleteChatSession,
  getChatSession,
} from "@/lib/actions/chat-persist";
import { useTranslations, useLocale } from "next-intl";
import { trackEvent } from "@/lib/analytics";
import {
  type Message,
  SAVE_DEBOUNCE_MS,
  generateFollowUpKeys,
  looksLikeEmergencyAnswer,
  makeId,
  parseCommand,
  readStoredSessionId,
  writeStoredSessionId,
} from "./chat-helpers";

const emptySubscribe = () => () => {};

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
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const deferredMessages = useDeferredValue(messages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [sessionHerbContext, setSessionHerbContext] = useState<string | null>(
    null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasSentMessage, setHasSentMessage] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messagesRef = useRef<Message[]>([]);
  const persistedIdsRef = useRef<Set<string>>(new Set());
  const sessionIdRef = useRef<string | null>(sessionId ?? null);
  const herbContextRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletingRef = useRef(false);
  const restoringRef = useRef(false);
  const restoreRetryIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const errorTextRef = useRef(t("pharmacist.error"));
  useEffect(() => {
    errorTextRef.current = t("pharmacist.error");
  }, [t]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const activeHerbContext = herbContext ?? sessionHerbContext;
  useEffect(() => {
    herbContextRef.current = activeHerbContext ?? null;
  }, [activeHerbContext]);

  useEffect(() => {
    mountedRef.current = true;
    const preHydrationValue = inputRef.current?.value;
    if (preHydrationValue) {
      setInput((prev) => (prev ? prev : preHydrationValue));
    }
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedFlashRef.current) clearTimeout(savedFlashRef.current);
    };
  }, []);

  const lastAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);

  const showFollowUps =
    !isLoading &&
    lastAssistantMessage?.role === "assistant" &&
    messages.length > 1 &&
    !looksLikeEmergencyAnswer(lastAssistantMessage.content);

  const followUpQuestions = useMemo(() => {
    if (!showFollowUps || !lastAssistantMessage) return [];
    return generateFollowUpKeys(activeHerbContext).map((key) => t(key));
  }, [showFollowUps, lastAssistantMessage, activeHerbContext, t]);

  const isEmpty = messages.length === 0 && !isLoading;

  const scrollToBottom = useCallback((smooth = false) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
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

  const persistMessages = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const generation = generationRef.current;

    const run = async () => {
      try {
        const pending = messagesRef.current.filter(
          (m) =>
            !persistedIdsRef.current.has(m.id) &&
            m.content !== errorTextRef.current
        );
        if (pending.length === 0) return;
        if (generationRef.current !== generation) return;

        setSaveStatus("saving");
        let sid = sessionIdRef.current;

        if (!sid) {
          const created = await createChatSession(herbContextRef.current);
          if (generationRef.current !== generation) {
            if (created.ok) await deleteChatSession(created.data.id);
            return;
          }
          if (!created.ok) {
            setSaveStatus("failed");
            return;
          }
          sid = created.data.id;
          sessionIdRef.current = sid;
          writeStoredSessionId(sid);
        }

        for (const message of pending) {
          if (generationRef.current !== generation) return;
          const saved = await addChatMessage(
            sid,
            message.role,
            message.content
          );
          if (!saved.ok) {
            setSaveStatus("failed");
            return;
          }
          persistedIdsRef.current.add(message.id);
        }

        if (generationRef.current !== generation) return;
        setSaveStatus("saved");
        if (savedFlashRef.current) clearTimeout(savedFlashRef.current);
        savedFlashRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setSaveStatus((current) =>
              current === "saved" ? "idle" : current
            );
          }
        }, 2000);
      } catch {
        if (mountedRef.current) setSaveStatus("failed");
      }
    };

    const queued = saveChainRef.current.then(run, run);
    saveChainRef.current = queued.catch(() => {});
    await queued;
  }, []);

  useEffect(() => {
    if (isRestoring || messages.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persistMessages();
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [messages.length, isRestoring, persistMessages]);

  const restoreSession = useCallback(async (id: string) => {
    restoreRetryIdRef.current = id;
    restoringRef.current = true;
    setIsRestoring(true);
    setRestoreError(false);
    const generation = generationRef.current;

    try {
      const result = await getChatSession(id);
      if (!mountedRef.current || generationRef.current !== generation) return;

      if (result.ok) {
        const restored: Message[] = result.data.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: m.createdAt,
          }));
        persistedIdsRef.current = new Set(restored.map((m) => m.id));
        sessionIdRef.current = id;
        setSessionHerbContext(result.data.herbContext ?? null);
        setMessages(restored);
        setHasSentMessage(restored.length > 0);
        writeStoredSessionId(id);
        restoreRetryIdRef.current = null;
      } else if (result.code === "not_found") {
        writeStoredSessionId(null);
        sessionIdRef.current = null;
        restoreRetryIdRef.current = null;
      } else {
        setRestoreError(true);
      }
    } catch {
      if (mountedRef.current) setRestoreError(true);
    } finally {
      restoringRef.current = false;
      if (mountedRef.current) setIsRestoring(false);
    }
  }, []);

  const restoredOnMount = useRef(false);
  useEffect(() => {
    if (restoredOnMount.current) return;
    restoredOnMount.current = true;
    if (autoQuery) return;
    const stored = sessionId ?? readStoredSessionId();
    if (!stored) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restoreSession(stored);
  }, [autoQuery, sessionId, restoreSession]);

  const autoSentFor = useRef<string | null>(null);
  useEffect(() => {
    if (!autoQuery || autoSentFor.current === autoQuery) return;
    if (messages.length === 0 && !isLoading && !isRestoring) {
      autoSentFor.current = autoQuery;
      sendMessage(autoQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoQuery, isRestoring]);

  async function sendMessage(
    text?: string,
    opts?: { history?: Message[]; isRetry?: boolean }
  ) {
    const content = (text ?? (input || inputRef.current?.value || "")).trim();
    if (!content || isLoading || isRestoring || deletingRef.current) return;

    const generation = generationRef.current;
    setHasSentMessage(true);

    const isRetry = !!opts?.isRetry;
    const history = opts?.history ?? messages;
    const userMessage: Message | null = isRetry
      ? null
      : {
          id: makeId(),
          role: "user",
          content,
          timestamp: new Date().toISOString(),
        };

    if (userMessage) setMessages((prev) => [...prev, userMessage]);
    setInput("");
    if (inputRef.current) inputRef.current.value = "";
    setIsLoading(true);
    setStreamingContent("");
    setShowScrollButton(false);

    const command = parseCommand(content);
    const overrideContext = command.systemContext;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const greetingTurn =
        history.length === 0
          ? [
              {
                role: "assistant" as const,
                content: `${t("herbalistPage.greeting.intro")} ${t(
                  "herbalistPage.greeting.question"
                )}`,
              },
            ]
          : [];

      const msgs = [
        ...greetingTurn,
        ...history.filter((m) => m.role !== ("system" as never)),
        ...(userMessage ? [userMessage] : []),
      ];
      const body: Record<string, unknown> = {
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        locale: locale || localeProp,
      };
      const requestContext = overrideContext || activeHerbContext;
      if (requestContext) {
        body.herbContext = requestContext;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const rawBody = await response.text().catch(() => "");
        let apiError: string | null = null;
        try {
          const parsed = JSON.parse(rawBody) as { error?: unknown };
          if (typeof parsed?.error === "string") apiError = parsed.error;
        } catch {
          // Ignore non-JSON bodies (e.g. proxy/CDN error pages)
        }
        if (generationRef.current !== generation) return;
        const errContent =
          response.status === 429
            ? t("pharmacist.rateLimited")
            : apiError || t("pharmacist.error");
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            content: errContent,
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

      if (generationRef.current !== generation) return;

      setStreamingContent("");
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: fullContent,
          timestamp: new Date().toISOString(),
        },
      ]);

      trackEvent("chat_message_sent", { hasHerbContext: !!activeHerbContext });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (generationRef.current !== generation) return;
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
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const sliced = messages.slice(0, -1);
    setMessages(sliced);
    sendMessage(lastUser.content, { history: sliced, isRetry: true });
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

  async function clearChat() {
    if (deletingRef.current || isRestoring) return;
    deletingRef.current = true;
    setIsDeleting(true);
    setDeleteError(false);
    generationRef.current += 1;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    abortRef.current?.abort();
    setStreamingContent("");
    setIsLoading(false);

    try {
      await saveChainRef.current;
      const sid = sessionIdRef.current;
      if (sid) {
        const result = await deleteChatSession(sid);
        if (!result.ok) {
          setDeleteError(true);
          return;
        }
      }

      persistedIdsRef.current.clear();
      sessionIdRef.current = null;
      setMessages([]);
      setStreamingContent("");
      setHasSentMessage(false);
      setSessionHerbContext(null);
      setSaveStatus("idle");
      if (sid && readStoredSessionId() === sid) writeStoredSessionId(null);
    } catch {
      setDeleteError(true);
    } finally {
      deletingRef.current = false;
      setIsDeleting(false);
    }
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

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  useEffect(() => {
    if (isEmpty && inputRef.current && !autoQuery && !isRestoring) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [isEmpty, autoQuery, isRestoring]);

  return (
    <div
      data-chat-ready={isHydrated ? "true" : "false"}
      className="flex flex-col h-[calc(100dvh-12rem)] sm:h-[calc(100dvh-10rem)] rounded-2xl border border-border bg-card overflow-hidden"
    >
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-hide"
        role="log"
        aria-label={t("common.chatMessagesLabel")}
      >
        {isRestoring ? (
          <div className="flex h-full items-center justify-center p-6">
            <p role="status" className="text-sm text-muted-foreground">
              {t("common.loadingConversation")}
            </p>
          </div>
        ) : restoreError && messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p role="alert" className="text-sm text-muted-foreground">
              {t("common.restoreFailed")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const id = restoreRetryIdRef.current;
                if (id) void restoreSession(id);
              }}
            >
              <RotateCcw className="size-3" />
              {t("common.retry")}
            </Button>
          </div>
        ) : isEmpty ? (
          <div className="mx-auto w-full max-w-2xl px-2 py-4">
            <ChatEmptyStateV2 onSendMessage={sendMessage} />
          </div>
        ) : (
          <ChatMessageList
            messages={deferredMessages}
            isLoading={isLoading}
            streamingContent={streamingContent}
            copiedId={copiedId}
            followUpQuestions={followUpQuestions}
            showFollowUps={showFollowUps}
            onRetryFailed={retryFailed}
            onCopy={copyToClipboard}
            onFollowUp={(q) => sendMessage(q)}
          />
        )}
      </div>

      {showScrollButton && (
        <button
          type="button"
          onClick={() => {
            scrollToBottom(true);
            setShowScrollButton(false);
          }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-md hover:text-foreground transition-all"
        >
          <ArrowDown className="size-3" />
          {t("common.newMessages")}
        </button>
      )}

      <ChatComposer
        input={input}
        inputRef={inputRef}
        isLoading={isLoading}
        isRestoring={isRestoring}
        isDeleting={isDeleting}
        hasSentMessage={hasSentMessage}
        messageCount={messages.length}
        saveStatus={saveStatus}
        deleteError={deleteError}
        onInputChange={setInput}
        onKeyDown={handleKeyDown}
        onSubmit={handleSubmit}
        onStop={stopGeneration}
        onClear={() => void clearChat()}
        onRetrySave={() => void persistMessages()}
      />
    </div>
  );
}
