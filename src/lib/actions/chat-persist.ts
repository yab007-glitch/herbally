"use server";

import { getAnonClient } from "@/lib/supabase/anonymous";
import { logger } from "@/lib/utils/logger";
import { getGuestId } from "@/lib/actions/guest-id";

// Note: Supabase RPC functions for guest chat are SECURITY DEFINER
// (see migration 00022), so they work with the anon key safely.
//
// M2 (audit 2026-06-22 v2): the guest identity is derived SERVER-SIDE from the
// HttpOnly `herbally-guest-id` cookie via getGuestId() — the same pattern the
// garden API route uses. Callers no longer pass a client-supplied guestId, so a
// tampered client cannot address another guest's sessions or messages by
// sending an arbitrary UUID. getGuestId() only accepts a valid UUID cookie and
// mints one (setting the cookie) when absent, so identity is always stable and
// server-owned.

export type PersistedChatSession = {
  id: string;
  title: string | null;
  herbContext: string | null;
  createdAt: string;
  updatedAt: string;
  messages: PersistedChatMessage[];
};

export type PersistedChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

function getSupabase() {
  const supabase = getAnonClient();
  if (!supabase) throw new Error("Supabase client not configured");
  return supabase;
}

export async function createGuestSession(
  herbContext?: string | null
): Promise<PersistedChatSession | null> {
  try {
    const supabase = getSupabase();
    const guestId = await getGuestId();

    const { data, error } = await supabase.rpc("create_guest_chat_session", {
      p_guest_id: guestId,
      p_herb_context: herbContext || undefined,
    });

    if (error || !data) {
      logger.error("chat_persist_create_guest_session", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      herbContext: data.herb_context,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      messages: [],
    };
  } catch (error) {
    logger.error("chat_persist_create_guest_session", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function getGuestSessions(): Promise<PersistedChatSession[]> {
  try {
    const supabase = getSupabase();
    const guestId = await getGuestId();
    const { data, error } = await supabase.rpc("get_guest_chat_sessions", {
      p_guest_id: guestId,
    });

    if (error || !data) return [];
    return data.map((s: Record<string, unknown>) => ({
      id: s.id as string,
      title: s.title as string,
      herbContext: (s.herb_context as string) || null,
      createdAt: s.created_at as string,
      updatedAt: s.updated_at as string,
      messages: [],
    }));
  } catch (error) {
    logger.error("chat_persist_get_guest_sessions", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function getGuestSession(
  sessionId: string
): Promise<PersistedChatSession | null> {
  try {
    const supabase = getSupabase();
    const guestId = await getGuestId();
    // There is no singular "get one session" RPC on the live database (see
    // migration 00022). Fetch the guest's session list — get_guest_chat_sessions
    // is SECURITY DEFINER and scoped to p_guest_id, so only sessions owned by
    // this guest are returned — and pick the matching id. This enforces
    // ownership without a direct table SELECT (the guest RLS policy on
    // chat_sessions reads a JWT claim that is never set for anon, so a direct
    // SELECT would always be filtered out).
    const { data: sessions, error: sessionsError } = await supabase.rpc(
      "get_guest_chat_sessions",
      { p_guest_id: guestId }
    );
    if (sessionsError || !sessions) return null;
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return null;

    // get_guest_chat_messages now requires p_guest_id (migration 00046) and
    // enforces ownership server-side — an app-level check alone was bypassable
    // via a direct PostgREST RPC call with the anon key.
    const { data: messages, error: messagesError } = await supabase.rpc(
      "get_guest_chat_messages",
      { p_session_id: sessionId, p_guest_id: guestId }
    );
    if (messagesError) return null;

    return {
      id: session.id,
      title: session.title,
      herbContext: session.herb_context,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      messages: (messages || []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        createdAt: m.created_at,
      })),
    };
  } catch (error) {
    logger.error("chat_persist_get_guest_session", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function addGuestMessage(
  sessionId: string,
  role: "user" | "assistant" | "system",
  content: string
): Promise<PersistedChatMessage | null> {
  try {
    const supabase = getSupabase();
    const guestId = await getGuestId();

    const { data, error } = await supabase.rpc("add_guest_chat_message", {
      p_session_id: sessionId,
      p_role: role,
      p_content: content,
      p_guest_id: guestId,
    });

    if (error) {
      logger.error("chat_persist_add_guest_message", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }

    return {
      id: data.id,
      role: data.role as "user" | "assistant" | "system",
      content: data.content,
      createdAt: data.created_at,
    };
  } catch (error) {
    logger.error("chat_persist_add_guest_message", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function deleteGuestSession(sessionId: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const guestId = await getGuestId();

    const { data, error } = await supabase.rpc("delete_guest_chat_session", {
      p_session_id: sessionId,
      p_guest_id: guestId,
    });
    return !error && !!data;
  } catch (error) {
    logger.error("chat_persist_delete_guest_session", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
