"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useDeferredValue,
} from "react";
import Link from "next/link";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  createChatSession,
  addChatMessage,
  deleteChatSession,
  getChatSession,
} from "@/lib/actions/chat-persist";
import type { ChatMessage } from "@/lib/actions/chat";
import { useTranslations, useLocale } from "next-intl";
import { trackEvent } from "@/lib/analytics";

type Message = ChatMessage;

// The persisted session id is remembered locally (an opaque UUID, never message
// content) so a reload can restore the conversation. Server-side the row is
// still scoped to the HttpOnly guest cookie / signed-in account — this key is
// only a pointer, and a stale or foreign id resolves to "not found".
const SESSION_STORAGE_KEY = "herbally-chat-session-id";
const SAVE_DEBOUNCE_MS = 1500;

function makeId() {
  return Math.random().toString(36).slice(2);
}

function readStoredSessionId(): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null; // storage disabled (private mode / blocked): restore unavailable
  }
}

function writeStoredSessionId(id: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (id) window.localStorage.setItem(SESSION_STORAGE_KEY, id);
    else window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Non-fatal: the conversation is still saved server-side; only the reload
    // pointer is lost.
  }
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

function generateFollowUpKeys(herbContext?: string | null): string[] {
  const hasHerb = herbContext && herbContext.length > 20;
  const base = [
    "pharmacist.followUpQuestions.sideEffects",
    "pharmacist.followUpQuestions.dosage",
    "pharmacist.followUpQuestions.pregnancy",
  ];
  if (hasHerb) {
    base.push("pharmacist.followUpQuestions.interactions");
    base.push("pharmacist.followUpQuestions.research");
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

  // ── Persistence bookkeeping ──
  // M15 (audit 2026-06-22) kept only an index and advanced it even when a write
  // failed, so failed messages were never retried and the UI still said
  // "Saved". We track the ids that actually landed instead, serialise every
  // write through one promise chain (no overlapping saves -> no duplicates),
  // and bump a generation on clear so an in-flight save cannot re-attach a
  // deleted conversation.
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
    messages.length > 1;

  const followUpQuestions = useMemo(() => {
    if (!showFollowUps || !lastAssistantMessage) return [];
    return generateFollowUpKeys(activeHerbContext).map((key) => t(key));
  }, [showFollowUps, lastAssistantMessage, activeHerbContext, t]);

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

  // ── Persist pending messages ──
  // Writes are serialised and only acknowledged individually. On failure the
  // unsaved ids stay pending (so the next attempt retries exactly them) and the
  // status reads "Not saved — retry" instead of a false "Saved".
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
            // The user cleared while the create was in flight. Delete the
            // orphan instead of adopting it, otherwise a cleared conversation
            // would silently become the active session again.
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

  // ── Restore the last conversation ──
  // The reload-empty report was real: a session id prop existed but nothing
  // ever loaded it, and the read actions collapsed errors into null/[]. Now the
  // saved conversation is fetched on mount (unless this is a fresh quick-ask
  // navigation, which intentionally starts a new conversation).
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
        // Restored rows are already stored — never write them again.
        persistedIdsRef.current = new Set(restored.map((m) => m.id));
        sessionIdRef.current = id;
        setSessionHerbContext(result.data.herbContext ?? null);
        setMessages(restored);
        setHasSentMessage(restored.length > 0);
        writeStoredSessionId(id);
        restoreRetryIdRef.current = null;
      } else if (result.code === "not_found") {
        // Nothing stored under this id for this identity (deleted elsewhere,
        // or the account changed). Forget the pointer rather than retrying a
        // session that no longer exists.
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
    // Quick-ask (?q= / ?herb= / ?medications=) starts a new conversation with
    // page-provided context; restoring old history there would drop the new
    // question into the middle of an unrelated thread.
    if (autoQuery) return;
    const stored = sessionId ?? readStoredSessionId();
    if (!stored) return;
    // Mount-time fetch: the synchronous setIsRestoring(true) inside this call is
    // the loading state for the restore, which cannot be derived before the
    // first client render without a hydration mismatch (the stored id lives in
    // localStorage). Same deliberate pattern as instant-search.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restoreSession(stored);
  }, [autoQuery, sessionId, restoreSession]);

  // ── Auto-send on mount ──
  // Guard on the query STRING, not a boolean: on client-side navigation
  // between two ?q= URLs the component instance (and its refs) persist, so a
  // boolean guard silently swallowed the second question with no bubble and
  // no error.
  const autoSentFor = useRef<string | null>(null);
  useEffect(() => {
    if (!autoQuery || autoSentFor.current === autoQuery) return;
    if (messages.length === 0 && !isLoading && !isRestoring) {
      autoSentFor.current = autoQuery;
      sendMessage(autoQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoQuery, isRestoring]);

  // ── Send message ──
  // M16 (audit 2026-06-22): accept an optional history override + retry flag so
  // `retryFailed` can pass the history with the stale error message already
  // sliced out. Previously retryFailed called sendMessage(content) and
  // sendMessage built the request from its closure-captured `messages` (which
  // still contained the error assistant text), so the retried request sent the
  // error text as assistant history AND duplicated the user message.
  async function sendMessage(
    text?: string,
    opts?: { history?: Message[]; isRetry?: boolean }
  ) {
    const content = (text ?? input).trim();
    if (!content || isLoading || isRestoring || deletingRef.current) return;

    const generation = generationRef.current;
    setHasSentMessage(true);

    const isRetry = !!opts?.isRetry;
    const history = opts?.history ?? messages;
    // On a retry the user message is already present in `history`; don't add a
    // duplicate. On a normal send, append a fresh user message to state and to
    // the request body.
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
        const err = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        if (generationRef.current !== generation) return;
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

      // The conversation may have been cleared while this stream was in flight;
      // a late reply must not reappear in a cleared thread.
      if (generationRef.current !== generation) return;

      // The server already runs the safety guard on the full response before
      // sending it (see /api/chat/route.ts — response is buffered and run
      // through guardResponse). The client no longer re-evaluates — that was
      // double-processing which could double-append warning disclaimers.
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
    // Drop the trailing failed/error assistant message, then re-send the last
    // user message. Pass the sliced history explicitly so sendMessage builds the
    // request from it (M16) instead of its stale closure copy that still
    // contained the error text. isRetry=true tells sendMessage not to append a
    // duplicate user message (it's already in the sliced history).
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

  // Clear is a deletion, not just a visual reset. It waits for any in-flight
  // save to settle, deletes the stored session, and only then empties the UI —
  // so a failure leaves the conversation visible with an honest error instead
  // of a cleared screen over rows that still exist. (ai_response_cache entries
  // are prompt-keyed with no session link, so this cannot and does not claim to
  // delete cached answers.)
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
      // Only forget the reload pointer if it addressed the conversation just
      // deleted. An unsaved conversation has no server row, so clearing must
      // not silently unlink an older conversation that still exists.
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

  // Adjust textarea height
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  // Focus input on mount
  useEffect(() => {
    if (isEmpty && inputRef.current && !autoQuery && !isRestoring) {
      inputRef.current.focus();
    }
  }, [isEmpty, autoQuery, isRestoring]);

  // ── Render ──
  return (
    <div className="flex flex-col h-[calc(100dvh-12rem)] sm:h-[calc(100dvh-10rem)] rounded-2xl border border-border bg-card overflow-hidden">
      {/* Messages area */}
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
          <div className="flex h-full items-center justify-center p-6">
            <ChatEmptyStateV2 onSendMessage={sendMessage} />
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-1 px-4 py-4">
            {deferredMessages.map((message) => (
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
                            onClick={() =>
                              copyToClipboard(message.content, message.id)
                            }
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
          {t("common.newMessages")}
        </button>
      )}

      {/* Disclaimer — subtle */}
      <div className="shrink-0 border-t border-border/50 px-4 py-1.5 text-center">
        <p className="text-[10px] text-muted-foreground">
          <AlertCircle className="inline size-2.5 -mt-0.5 mr-1" />
          {t("pharmacist.disclaimer")} {t("common.citationsDisclaimer")}
        </p>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border/50 px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 mx-auto max-w-2xl"
        >
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
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
              onClick={stopGeneration}
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

        {/* Footer row: clear + save status */}
        {hasSentMessage && (
          <div className="mt-2 mx-auto max-w-2xl">
            <div className="flex items-center justify-between">
              <button
                onClick={() => void clearChat()}
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
                    onClick={() => void persistMessages()}
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

      {/* Donation prompt */}
      {messages.length >= 3 && (
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
    </div>
  );
}
