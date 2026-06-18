"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types";
import { logger } from "@/lib/utils/logger";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  id: string;
  timestamp: string;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  herb_context: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Get all chat sessions for the current user
 */
export async function getChatSessions(): Promise<
  ActionResponse<ChatSession[]>
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("id, title, messages, herb_context, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      logger.error("chat_get_sessions_failed", {
        error: error instanceof Error ? error.message : JSON.stringify(error),
      });
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as ChatSession[] };
  } catch (error) {
    logger.error("chat_get_sessions_failed", {
      error: error instanceof Error ? error.message : JSON.stringify(error),
    });
    return { success: false, error: "Failed to fetch chat sessions" };
  }
}

/**
 * Get a specific chat session by ID
 */
export async function getChatSession(
  id: string
): Promise<ActionResponse<ChatSession>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("id, title, messages, herb_context, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      logger.error("chat_get_session_failed", {
        error: error instanceof Error ? error.message : JSON.stringify(error),
      });
      return { success: false, error: error.message };
    }

    return { success: true, data: data as ChatSession };
  } catch (error) {
    logger.error("chat_get_session_failed", {
      error: error instanceof Error ? error.message : JSON.stringify(error),
    });
    return { success: false, error: "Failed to fetch chat session" };
  }
}

/**
 * Create a new chat session
 */
export async function createChatSession(
  herbContext?: string | null
): Promise<ActionResponse<ChatSession>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: user.id,
        title: "New Chat",
        messages: [],
        herb_context: herbContext || null,
      })
      .select("id, title, messages, herb_context, created_at, updated_at")
      .single();

    if (error) {
      logger.error("chat_create_session_failed", {
        error: error instanceof Error ? error.message : JSON.stringify(error),
      });
      return { success: false, error: error.message };
    }

    return { success: true, data: data as ChatSession };
  } catch (error) {
    logger.error("chat_create_session_failed", {
      error: error instanceof Error ? error.message : JSON.stringify(error),
    });
    return { success: false, error: "Failed to create chat session" };
  }
}

/**
 * Update a chat session with new messages
 */
export async function updateChatSession(
  sessionId: string,
  messages: ChatMessage[],
  title?: string
): Promise<ActionResponse<ChatSession>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Auto-generate title from first user message if not provided
    let sessionTitle = title;
    if (!sessionTitle && messages.length > 0) {
      const firstUserMsg = messages.find((m) => m.role === "user");
      if (firstUserMsg) {
        sessionTitle =
          firstUserMsg.content.slice(0, 50) +
          (firstUserMsg.content.length > 50 ? "..." : "");
      }
    }

    const updateData: {
      messages: ChatMessage[];
      updated_at: string;
      title?: string;
    } = {
      messages,
      updated_at: new Date().toISOString(),
    };
    if (sessionTitle) {
      updateData.title = sessionTitle;
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .update(updateData)
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .select("id, title, messages, herb_context, created_at, updated_at")
      .single();

    if (error) {
      logger.error("chat_update_session_failed", {
        error: error instanceof Error ? error.message : JSON.stringify(error),
      });
      return { success: false, error: error.message };
    }

    return { success: true, data: data as ChatSession };
  } catch (error) {
    logger.error("chat_update_session_failed", {
      error: error instanceof Error ? error.message : JSON.stringify(error),
    });
    return { success: false, error: "Failed to update chat session" };
  }
}

/**
 * Delete a chat session
 */
export async function deleteChatSession(
  sessionId: string
): Promise<ActionResponse<null>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (error) {
      logger.error("chat_delete_session_failed", {
        error: error instanceof Error ? error.message : JSON.stringify(error),
      });
      return { success: false, error: error.message };
    }

    return { success: true, data: null };
  } catch (error) {
    logger.error("chat_delete_session_failed", {
      error: error instanceof Error ? error.message : JSON.stringify(error),
    });
    return { success: false, error: "Failed to delete chat session" };
  }
}
