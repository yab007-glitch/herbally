"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGuestId, clearGuestId } from "@/lib/actions/guest-id";
import { logger } from "@/lib/utils/logger";

/**
 * FUNC-8 (audit 2026-06-19): claim a guest's anonymous data into their new
 * authenticated account on login / email-confirmation signup.
 *
 * When a guest saves herbs to their garden or starts chat sessions, those rows
 * are keyed by `guest_id` (the `herbally-guest-id` cookie). If the guest then
 * signs up or logs in, that data was orphaned — the authenticated user saw an
 * empty garden/chat history even though they had built one up anonymously. This
 * action reassigns the guest's rows to the now-authenticated user.
 *
 * Must be called AFTER the session is established (login server action, or the
 * auth callback after exchangeCodeForSession) so `supabase.auth.getUser()`
 * resolves to the new user. Uses the service-role (admin) client for the
 * writes because the guest rows are not owned by the user under RLS
 * (`garden_herbs`/`chat_sessions` guest rows have `user_id IS NULL`, so the
 * RLS-enforced server client cannot see or update them).
 *
 * Idempotent: re-running is a no-op because claimed rows have `guest_id` set to
 * NULL and (for chat_sessions) `user_id` set, so the WHERE clauses no longer
 * match. On success the guest cookie is cleared so future anonymous browsing
 * mints a fresh identity instead of reusing one already claimed by an account.
 *
 * Errors are logged but never thrown: a migration failure must not block the
 * login/signup flow. Returns a boolean indicating whether a migration ran.
 */
export async function migrateGuestData(): Promise<boolean> {
  try {
    const guestId = await readGuestId();
    if (!guestId) return false; // no guest identity to migrate

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false; // not actually signed in — nothing to claim into

    const userId = user.id;
    const admin = createAdminClient();

    let gardenClaimed = 0;
    let gardenDeduped = 0;
    let chatClaimed = 0;

    // ── garden_herbs ────────────────────────────────────────────────────
    // Two UNIQUE constraints exist: (user_id, herb_slug) and (guest_id,
    // herb_slug). Blindly setting user_id on a guest row whose herb_slug the
    // user already has would violate the user uniqueness constraint. So:
    //   1. fetch the guest's herb_slugs
    //   2. fetch the user's existing herb_slugs
    //   3. delete guest rows that collide with herbs the user already saved
    //   4. claim the remaining guest rows (set user_id, null guest_id)
    const { data: guestRows, error: guestErr } = await admin
      .from("garden_herbs")
      .select("id, herb_slug")
      .eq("guest_id", guestId);
    if (guestErr) throw guestErr;

    const guestHerbs = (guestRows ?? []).filter((r) => r.herb_slug);
    if (guestHerbs.length > 0) {
      const guestSlugs = guestHerbs.map((r) => r.herb_slug);
      const { data: userRows, error: userErr } = await admin
        .from("garden_herbs")
        .select("herb_slug")
        .eq("user_id", userId)
        .in("herb_slug", guestSlugs);
      if (userErr) throw userErr;

      const userSlugs = new Set(
        (userRows ?? []).map((r) => r.herb_slug as string)
      );
      const collidingIds = guestHerbs
        .filter((r) => userSlugs.has(r.herb_slug as string))
        .map((r) => r.id);

      if (collidingIds.length > 0) {
        const { error: delErr } = await admin
          .from("garden_herbs")
          .delete()
          .in("id", collidingIds);
        if (delErr) throw delErr;
        gardenDeduped = collidingIds.length;
      }

      // Claim the surviving guest rows. After deleting collisions, none of the
      // remaining guest rows share a herb_slug with the user, so the
      // (user_id, herb_slug) constraint holds.
      const { data: claimed, error: claimErr } = await admin
        .from("garden_herbs")
        .update({ user_id: userId, guest_id: null })
        .eq("guest_id", guestId)
        .select("id");
      if (claimErr) throw claimErr;
      gardenClaimed = (claimed ?? []).length;
    }

    // ── chat_sessions ───────────────────────────────────────────────────
    // No UNIQUE constraint on chat_sessions, so reassignment is collision-free.
    // Only claim sessions that are still guest-owned (user_id IS NULL) — a
    // prior partial migration or an admin-set row should not be overwritten.
    const { data: chatClaimedRows, error: chatErr } = await admin
      .from("chat_sessions")
      .update({ user_id: userId, guest_id: null })
      .eq("guest_id", guestId)
      .is("user_id", null)
      .select("id");
    if (chatErr) throw chatErr;
    chatClaimed = (chatClaimedRows ?? []).length;

    // Clear the guest cookie so future anonymous use gets a fresh identity.
    await clearGuestId();

    logger.info("guest_data_migrated", {
      userId,
      gardenClaimed,
      gardenDeduped,
      chatClaimed,
    });
    return true;
  } catch (error) {
    // Never throw — a migration failure must not break login/signup.
    logger.error("guest_data_migration_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
