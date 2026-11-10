import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ChatInterface } from "../chat-interface";
import {
  createChatSession,
  addChatMessage,
  deleteChatSession,
  getChatSession,
} from "@/lib/actions/chat-persist";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/lib/actions/chat-persist", () => ({
  createChatSession: vi.fn(),
  addChatMessage: vi.fn(),
  deleteChatSession: vi.fn(),
  getChatSession: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

const createMock = vi.mocked(createChatSession);
const addMock = vi.mocked(addChatMessage);
const deleteMock = vi.mocked(deleteChatSession);
const getMock = vi.mocked(getChatSession);

const STORAGE_KEY = "herbally-chat-session-id";

const session = {
  id: "s1",
  title: "New Chat",
  herbContext: null,
  createdAt: "2026-10-29T10:00:00Z",
  updatedAt: "2026-10-29T10:00:00Z",
  messages: [],
};

function savedMessage(content: string, role: "user" | "assistant" = "user") {
  return {
    ok: true as const,
    data: {
      id: `db-${content.slice(0, 8)}`,
      role,
      content,
      createdAt: "2026-10-29T10:00:00Z",
    },
  };
}

function chatResponse(text: string) {
  return new Response(text, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

/** Flush the promise chain without moving the fake clock. */
async function flush() {
  await act(async () => {
    for (let i = 0; i < 40; i++) await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function send(text: string) {
  fireEvent.change(screen.getByLabelText("common.chatInputlabel"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByLabelText("common.sendMessageLabel"));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  Element.prototype.scrollTo = vi.fn();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  createMock.mockResolvedValue({ ok: true, data: session });
  addMock.mockImplementation(async (_id, role, content) =>
    savedMessage(content, role === "assistant" ? "assistant" : "user")
  );
  deleteMock.mockResolvedValue({ ok: true, data: { deleted: true } });
  getMock.mockResolvedValue({ ok: false, code: "not_found" });

  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(chatResponse("Synthetic answer about peppermint."))
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("chat persistence acknowledgements", () => {
  it("shows 'Saved' only after every write succeeds", async () => {
    render(<ChatInterface locale="en" />);

    send("Synthetic question about peppermint");
    await flush();
    expect(
      screen.getByText("Synthetic answer about peppermint.")
    ).toBeInTheDocument();

    // Before the debounce fires nothing has been written and nothing claims it.
    expect(screen.queryByText("common.saved")).not.toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();

    await advance(1600);
    await flush();

    expect(createMock).toHaveBeenCalledTimes(1);
    // No herb context on the page -> the session stores null, not the user's
    // first message duplicated into the herb_context column.
    expect(createMock).toHaveBeenCalledWith(null);
    expect(addMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("common.saved")).toBeInTheDocument();
  });

  it("does not claim success when a message write fails, and retries the exact same message", async () => {
    addMock
      .mockResolvedValueOnce({ ok: false, code: "unavailable" })
      .mockImplementation(async (_id, role, content) =>
        savedMessage(content, role === "assistant" ? "assistant" : "user")
      );

    render(<ChatInterface locale="en" />);

    send("Synthetic question about ginger");
    await flush();
    await advance(1600);
    await flush();

    expect(screen.queryByText("common.saved")).not.toBeInTheDocument();
    const retry = screen.getByText("common.saveFailed");
    expect(retry).toBeInTheDocument();

    // The user message is retried, not skipped: the first failed write did not
    // advance any "saved" pointer.
    await act(async () => {
      fireEvent.click(retry);
    });
    await flush();

    const userWrites = addMock.mock.calls.filter(
      ([, role, content]) =>
        role === "user" && content === "Synthetic question about ginger"
    );
    expect(userWrites).toHaveLength(2);
    // The retry reuses the session created by the failed attempt instead of
    // starting a second, half-empty conversation.
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("common.saved")).toBeInTheDocument();
  });

  it("keeps messages pending when session creation fails, then saves them on retry", async () => {
    createMock
      .mockResolvedValueOnce({ ok: false, code: "unavailable" })
      .mockResolvedValue({ ok: true, data: session });

    render(<ChatInterface locale="en" />);

    send("Synthetic question about echinacea");
    await flush();
    await advance(1600);
    await flush();

    expect(screen.queryByText("common.saved")).not.toBeInTheDocument();
    const retry = screen.getByText("common.saveFailed");
    expect(addMock).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(retry);
    });
    await flush();

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(addMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("common.saved")).toBeInTheDocument();
  });
});

describe("clear conversation", () => {
  it("waits for an in-flight save, deletes the session it created, and never re-attaches it", async () => {
    let resolveCreate: (value: {
      ok: true;
      data: typeof session;
    }) => void = () => {};
    createMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }) as ReturnType<typeof createChatSession>
    );

    render(<ChatInterface locale="en" />);

    send("Synthetic question about turmeric");
    await flush();
    await advance(1600); // save starts, hangs on createChatSession

    expect(createMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("common.clearConversation"));
    // Clear is waiting on the same save chain; it has not deleted yet.
    expect(deleteMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveCreate({ ok: true, data: session });
    });
    await flush();

    // The session that the stale save created is deleted, not adopted, and no
    // message is written into the conversation the user just cleared.
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith("s1");
    expect(addMock).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Synthetic answer about peppermint.")
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(
      screen.queryByText("common.clearConversation")
    ).not.toBeInTheDocument();
  });

  it("drops a late answer that arrives after the conversation was cleared", async () => {
    let streamController:
      ReadableStreamDefaultController<Uint8Array> | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(body, {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        })
      )
    );

    render(<ChatInterface locale="en" />);

    send("Synthetic question about valerian");
    await flush();

    // Clear while the response is still streaming and before the debounce has
    // written anything to the server.
    await act(async () => {
      fireEvent.click(screen.getByText("common.clearConversation"));
    });
    await flush();

    // The upstream finishes after the clear: the reader loop must discard it.
    streamController?.enqueue(
      new TextEncoder().encode("Synthetic late answer")
    );
    streamController?.close();
    await flush();
    await advance(4000);
    await flush();

    expect(screen.queryByText(/Synthetic late answer/)).not.toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
    expect(addMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("common.chatInputlabel")).toBeInTheDocument();
  });

  it("does not unlink an older saved conversation when clearing an unsaved one", async () => {
    localStorage.setItem(STORAGE_KEY, "older-session");

    // A quick-ask navigation starts a fresh conversation instead of restoring,
    // so the stored pointer still addresses the previous conversation.
    render(<ChatInterface locale="en" autoQuery="Synthetic quick ask" />);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByText("common.clearConversation"));
    });
    await flush();
    await advance(4000);
    await flush();

    expect(createMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("older-session");
  });

  it("keeps the conversation visible and reports the failure when deletion fails", async () => {
    deleteMock.mockResolvedValue({ ok: false, code: "unavailable" });

    render(<ChatInterface locale="en" />);

    send("Synthetic question about sage");
    await flush();
    await advance(1600);
    await flush();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("s1");

    await act(async () => {
      fireEvent.click(screen.getByText("common.clearConversation"));
    });
    await flush();

    // No false deletion: the stored session may still exist, so the messages
    // stay on screen and the failure is visible.
    expect(screen.getByRole("alert")).toHaveTextContent("common.deleteFailed");
    expect(
      screen.getByText("Synthetic answer about peppermint.")
    ).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("s1");
  });
});

describe("restoring a saved conversation", () => {
  const restored = {
    ok: true as const,
    data: {
      id: "s1",
      title: "Synthetic chat",
      herbContext: null,
      createdAt: "2026-10-29T10:00:00Z",
      updatedAt: "2026-10-29T10:01:00Z",
      messages: [
        {
          id: "m1",
          role: "user" as const,
          content: "Synthetic restored question about mint",
          createdAt: "2026-10-29T10:00:00Z",
        },
        {
          id: "m2",
          role: "assistant" as const,
          content: "Synthetic restored answer about mint",
          createdAt: "2026-10-29T10:00:05Z",
        },
      ],
    },
  };

  it("loads the stored conversation on mount without rewriting it", async () => {
    localStorage.setItem(STORAGE_KEY, "s1");
    getMock.mockResolvedValue(restored);

    render(<ChatInterface locale="en" />);
    await flush();

    expect(getMock).toHaveBeenCalledWith("s1");
    expect(
      screen.getByText("Synthetic restored question about mint")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Synthetic restored answer about mint")
    ).toBeInTheDocument();

    // Restored rows already exist server-side; no duplicate writes.
    await advance(4000);
    await flush();
    expect(createMock).not.toHaveBeenCalled();
    expect(addMock).not.toHaveBeenCalled();
    expect(screen.queryByText("common.saveFailed")).not.toBeInTheDocument();
  });

  it("forgets a stored id the server no longer has and shows the empty state", async () => {
    localStorage.setItem(STORAGE_KEY, "deleted-elsewhere");
    getMock.mockResolvedValue({ ok: false, code: "not_found" });

    render(<ChatInterface locale="en" />);
    await flush();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.queryByText("common.restoreFailed")).not.toBeInTheDocument();
    expect(screen.getByLabelText("common.chatInputlabel")).toBeInTheDocument();
  });

  it("shows a restore error instead of pretending the history is empty", async () => {
    localStorage.setItem(STORAGE_KEY, "s1");
    getMock.mockResolvedValue({ ok: false, code: "unavailable" });

    render(<ChatInterface locale="en" />);
    await flush();

    expect(screen.getByRole("alert")).toHaveTextContent("common.restoreFailed");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("s1");
  });

  it("starts a fresh conversation for a quick-ask link instead of restoring old history", async () => {
    localStorage.setItem(STORAGE_KEY, "s1");

    render(<ChatInterface locale="en" autoQuery="Synthetic quick ask" />);
    await flush();

    expect(getMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Synthetic answer about peppermint.")
    ).toBeInTheDocument();
  });
});
