"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";
import { getGuestId, readGuestId } from "@/lib/actions/guest-id";
import { migrateGuestData } from "@/lib/actions/guest-migration";

// Chat persistence for BOTH identities.
//
// Guests: the guest chat RPCs are SECURITY DEFINER and their EXECUTE grants are
// locked to service_role (migration 00054) — a raw PostgREST call with the
// public anon key cannot reach them, so they are called through the service
// role. The cookie-derived guestId still goes into p_guest_id so the RPC's own
// ownership check (defense in depth) rejects mismatches. The guest identity is
// derived SERVER-SIDE from the HttpOnly `herbally-guest-id` cookie; callers
// never supply it.
//
// Signed-in users: rows are written/read with the RLS-scoped server client, so
// chat_sessions.user_id and the chat_messages ownership policies enforce
// access. This is what makes the guest→account migration (guest-migration.ts)
// observable: before this, migration claimed the rows but the chat UI only
// ever spoke the guest RPCs, so a logged-in user's own history was invisible
// and every new message was written anonymously under a fresh guest id.
//
// Every function returns a discriminated result instead of null/[] on error.
// A DB outage must never look like "no history" or like a successful save.

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

/** Coarse, non-sensitive failure codes. DB messages stay in server logs. */
export type ChatPersistFailure = {
  ok: false;
  /** `unavailable`: the store could not be reached — the write did NOT land. */
  /** `not_found`: the session does not exist for this viewer (deleted/other). */
  code: "unavailable" | "not_found";
};

export type ChatPersistResult<T> = { ok: true; data: T } | ChatPersistFailure;

export type DeletedSession = { deleted: boolean };

type Viewer =
  | { kind: "account"; userId: string }
  | { kind: "guest"; guestId: string | null };

type SessionRow = {
  id: string;
  title: string | null;
  herb_context: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function logFailure(op: string, error: unknown) {
  logger.error(op, { error: describeError(error) });
}

function toSession(
  row: SessionRow,
  messages: PersistedChatMessage[] = []
): PersistedChatSession {
  return {
    id: row.id,
    title: row.title,
    herbContext: row.herb_context ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages,
  };
}

function toMessage(row: MessageRow): PersistedChatMessage {
  return {
    id: row.id,
    role: row.role as PersistedChatMessage["role"],
    content: row.content,
    createdAt: row.created_at,
  };
}

/**
 * Who is asking? Signed-in users are resolved FIRST so a logged-in browser
 * never writes anonymous rows (the previous behaviour, which split a single
 * conversation across two identities). A genuinely missing session is the
 * guest case; an auth backend failure is reported instead of guessed, because
 * guessing wrong would file the user's health question under a guest id.
 */
async function resolveViewer(): Promise<
  { ok: true; viewer: Viewer } | ChatPersistFailure
> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (!error && data.user) {
      return { ok: true, viewer: { kind: "account", userId: data.user.id } };
    }

    if (error) {
      const errorName =
        typeof error === "object" && error !== null && "name" in error
          ? String((error as { name: unknown }).name)
          : "";
      const status = (error as { status?: number }).status;
      const missingSession =
        errorName === "AuthSessionMissingError" ||
        /session\s+missing/i.test(error.message ?? "") ||
        status === 400;
      if (!missingSession) {
        logFailure("chat_persist_resolve_viewer", error);
        return { ok: false, code: "unavailable" };
      }
    }

    return {
      ok: true,
      viewer: { kind: "guest", guestId: await readGuestId() },
    };
  } catch (error) {
    logFailure("chat_persist_resolve_viewer", error);
    return { ok: false, code: "unavailable" };
  }
}

// ── Account (RLS-scoped) helpers ──────────────────────────────────────

async function readAccountSession(
  sessionId: string
): Promise<ChatPersistResult<PersistedChatSession>> {
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("chat_sessions")
    .select("id,title,herb_context,created_at,updated_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    logFailure("chat_persist_read_account_session", error);
    return { ok: false, code: "unavailable" };
  }
  if (!session) return { ok: false, code: "not_found" };

  const { data: messages, error: messagesError } = await supabase
    .from("chat_messages")
    .select("id,role,content,created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    logFailure("chat_persist_read_account_messages", messagesError);
    return { ok: false, code: "unavailable" };
  }

  return {
    ok: true,
    data: toSession(session, (messages ?? []).map(toMessage)),
  };
}

async function insertAccountMessage(
  sessionId: string,
  role: PersistedChatMessage["role"],
  content: string
): Promise<ChatPersistResult<PersistedChatMessage>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ session_id: sessionId, role, content })
    .select("id,role,content,created_at")
    .single();

  if (error) {
    // 42501 = RLS WITH CHECK rejected the row: this session is not owned by
    // the signed-in user (still guest-owned after a partial migration, or
    // another account's). Report not_found so the caller can try the guest
    // path / surface a truthful failure instead of retrying forever.
    const code = (error as { code?: string }).code;
    if (code === "42501") return { ok: false, code: "not_found" };
    logFailure("chat_persist_insert_account_message", error);
    return { ok: false, code: "unavailable" };
  }
  if (!data) return { ok: false, code: "unavailable" };

  // Mirror the guest RPC: the first user message names the session, and every
  // message bumps updated_at. Both are best-effort — the message itself has
  // landed, so a title/metadata miss must not turn the write into a failure.
  const patch: { updated_at: string; title?: string } = {
    updated_at: new Date().toISOString(),
  };
  if (role === "user") {
    const { error: titleError } = await supabase
      .from("chat_sessions")
      .update({
        ...patch,
        title: content.length > 50 ? `${content.slice(0, 50)}...` : content,
      })
      .eq("id", sessionId)
      .eq("title", "New Chat");
    if (titleError && (titleError as { code?: string }).code !== "42501") {
      logFailure("chat_persist_update_account_title", titleError);
    }
  } else {
    const { error: touchError } = await supabase
      .from("chat_sessions")
      .update(patch)
      .eq("id", sessionId);
    if (touchError)
      logFailure("chat_persist_touch_account_session", touchError);
  }

  return { ok: true, data: toMessage(data) };
}

// ── Guest helpers ─────────────────────────────────────────────────────

async function readGuestSession(
  guestId: string,
  sessionId: string
): Promise<ChatPersistResult<PersistedChatSession>> {
  const supabase = createAdminClient();

  // There is no singular "get one session" RPC (migration 00022). The list RPC
  // is SECURITY DEFINER and scoped to p_guest_id, so only this guest's sessions
  // are returned; picking the id from it enforces ownership without a direct
  // table SELECT (the guest RLS policy reads a JWT claim that anon never has).
  const { data: sessions, error: sessionsError } = await supabase.rpc(
    "get_guest_chat_sessions",
    { p_guest_id: guestId }
  );
  if (sessionsError) {
    logFailure("chat_persist_get_guest_sessions", sessionsError);
    return { ok: false, code: "unavailable" };
  }
  const session = (sessions ?? []).find((s) => s.id === sessionId);
  if (!session) return { ok: false, code: "not_found" };

  const { data: messages, error: messagesError } = await supabase.rpc(
    "get_guest_chat_messages",
    { p_session_id: sessionId, p_guest_id: guestId }
  );
  if (messagesError) {
    logFailure("chat_persist_get_guest_messages", messagesError);
    return { ok: false, code: "unavailable" };
  }

  return {
    ok: true,
    data: toSession(session, (messages ?? []).map(toMessage)),
  };
}

async function insertGuestMessage(
  guestId: string,
  sessionId: string,
  role: PersistedChatMessage["role"],
  content: string
): Promise<ChatPersistResult<PersistedChatMessage>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("add_guest_chat_message", {
    p_session_id: sessionId,
    p_role: role,
    p_content: content,
    p_guest_id: guestId,
  });

  if (error) {
    logFailure("chat_persist_add_guest_message", error);
    // The RPC raises "Session not found or not owned by guest" when the row is
    // gone or belongs to another identity. Everything else is a transport/DB
    // failure. Both are non-successful writes, but only not_found is permanent.
    const notFound = /not found|not owned/i.test(error.message ?? "");
    return { ok: false, code: notFound ? "not_found" : "unavailable" };
  }
  if (!data) return { ok: false, code: "unavailable" };

  return { ok: true, data: toMessage(data) };
}

async function deleteGuestSession(
  guestId: string,
  sessionId: string
): Promise<ChatPersistResult<DeletedSession>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("delete_guest_chat_session", {
    p_session_id: sessionId,
    p_guest_id: guestId,
  });
  if (error) {
    logFailure("chat_persist_delete_guest_session", error);
    return { ok: false, code: "unavailable" };
  }
  // false = nothing matched (already deleted) or not owned. Either way no
  // conversation addressed by this id remains for this viewer.
  return { ok: true, data: { deleted: data === true } };
}

// ── Public actions ───────────────────────────────────────────────────

export async function createChatSession(
  herbContext?: string | null
): Promise<ChatPersistResult<PersistedChatSession>> {
  const resolved = await resolveViewer();
  if (!resolved.ok) return resolved;
  const { viewer } = resolved;

  try {
    if (viewer.kind === "account") {
      // A guest cookie can survive a failed login migration. Claim it now, on
      // the first new conversation after login, so the old conversation becomes
      // visible under this account and is not stranded under a guest id. The
      // migration is idempotent and swallows its own errors.
      if (await readGuestId()) {
        await migrateGuestData();
      }

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: viewer.userId,
          title: "New Chat",
          herb_context: herbContext ?? null,
        })
        .select("id,title,herb_context,created_at,updated_at")
        .single();

      if (error || !data) {
        logFailure("chat_persist_create_account_session", error);
        return { ok: false, code: "unavailable" };
      }
      return { ok: true, data: toSession(data) };
    }

    // Writes mint the guest identity when absent (reads never do).
    const guestId = await getGuestId();
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("create_guest_chat_session", {
      p_guest_id: guestId,
      p_herb_context: herbContext || undefined,
    });

    if (error || !data) {
      logFailure("chat_persist_create_guest_session", error);
      return { ok: false, code: "unavailable" };
    }
    return { ok: true, data: toSession(data) };
  } catch (error) {
    logFailure("chat_persist_create_session", error);
    return { ok: false, code: "unavailable" };
  }
}

export async function addChatMessage(
  sessionId: string,
  role: PersistedChatMessage["role"],
  content: string
): Promise<ChatPersistResult<PersistedChatMessage>> {
  const resolved = await resolveViewer();
  if (!resolved.ok) return resolved;
  const { viewer } = resolved;

  try {
    if (viewer.kind === "account") {
      const result = await insertAccountMessage(sessionId, role, content);
      if (result.ok || result.code !== "not_found") return result;

      // The session may still be guest-owned (migration failed or has not run
      // yet). Continue writing it through the guest path so an in-progress
      // conversation is never split across identities.
      const guestId = await readGuestId();
      if (guestId) return insertGuestMessage(guestId, sessionId, role, content);
      return result;
    }

    if (!viewer.guestId) return { ok: false, code: "not_found" };
    return insertGuestMessage(viewer.guestId, sessionId, role, content);
  } catch (error) {
    logFailure("chat_persist_add_message", error);
    return { ok: false, code: "unavailable" };
  }
}

export async function getChatSession(
  sessionId: string
): Promise<ChatPersistResult<PersistedChatSession>> {
  const resolved = await resolveViewer();
  if (!resolved.ok) return resolved;
  const { viewer } = resolved;

  try {
    if (viewer.kind === "account") {
      const result = await readAccountSession(sessionId);
      if (result.ok || result.code !== "not_found") return result;

      // Not visible under the account, but the guest cookie may still own it
      // because the login migration failed. Return it and retry the claim so
      // the next load finds it account-owned.
      const guestId = await readGuestId();
      if (!guestId) return result;

      const guestResult = await readGuestSession(guestId, sessionId);
      if (guestResult.ok) {
        await migrateGuestData();
        return guestResult;
      }
      return result;
    }

    if (!viewer.guestId) return { ok: false, code: "not_found" };
    return readGuestSession(viewer.guestId, sessionId);
  } catch (error) {
    logFailure("chat_persist_get_session", error);
    return { ok: false, code: "unavailable" };
  }
}

export async function getChatSessions(): Promise<
  ChatPersistResult<PersistedChatSession[]>
> {
  const resolved = await resolveViewer();
  if (!resolved.ok) return resolved;
  const { viewer } = resolved;

  try {
    if (viewer.kind === "account") {
      // If a login migration is still pending, claim it first so this list
      // includes the guest's conversations instead of just the account's.
      if (await readGuestId()) {
        await migrateGuestData();
      }

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id,title,herb_context,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) {
        logFailure("chat_persist_get_account_sessions", error);
        return { ok: false, code: "unavailable" };
      }
      return {
        ok: true,
        data: (data ?? []).map((row) => toSession(row)),
      };
    }

    if (!viewer.guestId) return { ok: true, data: [] };
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_guest_chat_sessions", {
      p_guest_id: viewer.guestId,
    });
    if (error) {
      logFailure("chat_persist_get_guest_sessions", error);
      return { ok: false, code: "unavailable" };
    }
    return {
      ok: true,
      data: (data ?? []).map((row) => toSession(row)),
    };
  } catch (error) {
    logFailure("chat_persist_get_sessions", error);
    return { ok: false, code: "unavailable" };
  }
}

export async function deleteChatSession(
  sessionId: string
): Promise<ChatPersistResult<DeletedSession>> {
  const resolved = await resolveViewer();
  if (!resolved.ok) return resolved;
  const { viewer } = resolved;

  try {
    if (viewer.kind === "account") {
      const supabase = await createClient();
      // chat_messages.session_id is ON DELETE CASCADE (migration 00020), so
      // deleting the session row removes its messages. ai_response_cache is
      // deliberately NOT touched: it is keyed only by prompt_hash with a 7-day
      // TTL and carries no session/guest/user link, so no per-conversation
      // purge is possible. The UI must not promise cache deletion.
      const { data, error } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", sessionId)
        .select("id");

      if (error) {
        logFailure("chat_persist_delete_account_session", error);
        return { ok: false, code: "unavailable" };
      }
      if ((data ?? []).length > 0) {
        return { ok: true, data: { deleted: true } };
      }

      // Nothing account-owned matched. If a migration is still pending, the
      // conversation may be guest-owned; deleting only the account copy would
      // let the UI claim a deletion while the guest rows remain.
      const guestId = await readGuestId();
      if (guestId) return deleteGuestSession(guestId, sessionId);
      return { ok: true, data: { deleted: false } };
    }

    if (!viewer.guestId) return { ok: true, data: { deleted: false } };
    return deleteGuestSession(viewer.guestId, sessionId);
  } catch (error) {
    logFailure("chat_persist_delete_session", error);
    return { ok: false, code: "unavailable" };
  }
}
