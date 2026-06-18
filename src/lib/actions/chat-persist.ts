"use server";

import { getAnonClient } from "@/lib/supabase/anonymous";
import { logger } from "@/lib/utils/logger";

// Note: Supabase RPC functions for guest chat are SECURITY DEFINER
// (see migration 00022), so they work with the anon key safely.

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
  guestId: string,
  herbContext?: string | null
): Promise<PersistedChatSession | null> {
  try {
    const supabase = getSupabase();

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

export async function getGuestSessions(
  guestId: string
): Promise<PersistedChatSession[]> {
  try {
    const supabase = getSupabase();
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
  sessionId: string,
  guestId: string
): Promise<PersistedChatSession | null> {
  try {
    const supabase = getSupabase();
    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id, title, herb_context, created_at, updated_at, guest_id")
      .eq("id", sessionId)
      .eq("guest_id", guestId)
      .single();

    if (sessionError || !session) return null;
    const { data: messages, error: messagesError } = await supabase.rpc(
      "get_guest_chat_messages",
      { p_session_id: sessionId }
    );
    if (messagesError) return null;

    return {
      id: session.id,
      title: session.title,
      herbContext: session.herb_context,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      messages: (messages || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        role: m.role as "user" | "assistant" | "system",
        content: m.content as string,
        createdAt: m.created_at as string,
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
  content: string,
  guestId: string
): Promise<PersistedChatMessage | null> {
  try {
    const supabase = getSupabase();

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

export async function deleteGuestSession(
  sessionId: string,
  guestId: string
): Promise<boolean> {
  try {
    const supabase = getSupabase();

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
