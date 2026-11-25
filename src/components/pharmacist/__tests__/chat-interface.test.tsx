import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { ChatInterface } from "../chat-interface";
import { enDict as en, frDict as fr } from "@/lib/i18n/dictionaries";

// Passthrough translator: assertions target keys, not copy that may change.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

// Guest persistence is a server action; keep this suite in-memory.
vi.mock("@/lib/actions/chat-persist", () => ({
  createChatSession: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      id: "s1",
      title: "New Chat",
      herbContext: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      messages: [],
    },
  }),
  addChatMessage: vi.fn().mockImplementation(async (_id, role, content) => ({
    ok: true,
    data: {
      id: "m1",
      role,
      content,
      createdAt: "2026-01-01T00:00:00Z",
    },
  })),
  deleteChatSession: vi.fn().mockResolvedValue({
    ok: true,
    data: { deleted: true },
  }),
  getChatSession: vi.fn().mockResolvedValue({ ok: false, code: "not_found" }),
}));

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

// jsdom does not implement Element.scrollTo; the interface calls it while
// following the conversation.
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  Element.prototype.scrollTo = vi.fn();
});

function chatResponse(text: string, dataSource: "database" | "none"): Response {
  return new Response(text, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "X-HerbAlly-Data-Source": dataSource,
    },
  });
}

async function send(text: string) {
  fireEvent.change(screen.getByLabelText("common.chatInputlabel"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByLabelText("common.sendMessageLabel"));
}

describe("ChatInterface provenance labels", () => {
  it("does not show a 'Verified data' badge for a database-sourced reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          chatResponse(
            "Ginger may interact with warfarin. Consult your prescriber.",
            "database"
          )
        )
    );

    render(<ChatInterface locale="en" />);
    await send("Is ginger safe with warfarin?");
    await screen.findByText(
      "Ginger may interact with warfarin. Consult your prescriber."
    );

    // Presence of database context is not verification of the generated
    // answer, so the interface must not claim the answer is verified.
    expect(screen.queryByText("common.verifiedData")).not.toBeInTheDocument();
    expect(screen.queryByText("Verified data")).not.toBeInTheDocument();
    expect(screen.queryByText("Données vérifiées")).not.toBeInTheDocument();
  });

  it("does not retroactively label earlier replies when a later turn uses the database", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          chatResponse("First answer without database context.", "none")
        )
        .mockResolvedValueOnce(
          chatResponse("Second answer with database context.", "database")
        )
    );

    render(<ChatInterface locale="en" />);

    await send("First question");
    await screen.findByText("First answer without database context.");

    await send("Second question");
    await screen.findByText("Second answer with database context.");

    // A later turn (or a cache-served reply carrying a database header) must
    // not relabel messages that were rendered earlier.
    expect(screen.queryByText("common.verifiedData")).not.toBeInTheDocument();
    expect(screen.queryByText("Verified data")).not.toBeInTheDocument();
  });
});

describe("verified-data copy", () => {
  it("is removed from both the English and French dictionaries", () => {
    expect(en.common).not.toHaveProperty("verifiedData");
    expect(fr.common).not.toHaveProperty("verifiedData");
  });
});

describe("ChatInterface pre-hydration input preservation", () => {
  it("preserves text typed into the SSR textarea before hydration, enables Send, and submits on Enter", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        chatResponse("See PMID:32747204 for turmeric evidence.", "database")
      );
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = (() => {
      container.innerHTML = renderToString(<ChatInterface locale="en" />);
      const ssrTextarea = container.querySelector(
        'textarea[aria-label="common.chatInputlabel"]'
      ) as HTMLTextAreaElement;
      expect(ssrTextarea).not.toBeNull();
      // Simulate user typing into SSR HTML before React hydrates onChange
      ssrTextarea.value = "Tell me about turmeric evidence";

      let hydratedRoot!: ReturnType<typeof hydrateRoot>;
      act(() => {
        hydratedRoot = hydrateRoot(container, <ChatInterface locale="en" />);
      });
      return hydratedRoot;
    })();

    try {
      const readyRoot = container.querySelector('[data-chat-ready="true"]');
      expect(readyRoot).not.toBeNull();

      const textarea = container.querySelector(
        'textarea[aria-label="common.chatInputlabel"]'
      ) as HTMLTextAreaElement;
      const sendBtn = container.querySelector(
        'button[aria-label="common.sendMessageLabel"]'
      ) as HTMLButtonElement;

      expect(textarea.value).toBe("Tell me about turmeric evidence");
      expect(sendBtn.disabled).toBe(false);

      await act(async () => {
        fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/chat",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Tell me about turmeric evidence"),
        })
      );
      expect(
        await screen.findByText(/See .*turmeric evidence/i)
      ).toBeInTheDocument();
      expect(textarea.value).toBe("");
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
      vi.unstubAllGlobals();
    }
  });
});
