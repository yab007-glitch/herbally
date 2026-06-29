"use server";

import { cookies } from "next/headers";
import { isValidGuestId } from "@/lib/utils/guest-id";

const GUEST_ID_COOKIE = "herbally-guest-id";

/**
 * Get or create a guest ID from a cookie. When no cookie exists, mint a new
 * UUID AND set it as an HttpOnly cookie immediately (previously the cookie was
 * never set server-side, so every call minted a fresh ID and guest data never
 * persisted). The cookie is HttpOnly so client JS cannot read or forge it.
 * Only a valid UUID cookie is reused; a legacy/tampered value is replaced.
 */
export async function getGuestId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_ID_COOKIE);

  if (existing?.value && isValidGuestId(existing.value)) {
    return existing.value;
  }

  // Generate a new guest ID and persist it so subsequent calls are stable.
  const guestId = crypto.randomUUID();
  cookieStore.set(GUEST_ID_COOKIE, guestId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });

  return guestId;
}

/**
 * Read the guest ID cookie WITHOUT minting a new one. Returns the valid UUID
 * if present, or null if there is no cookie / it is invalid. Use this (not
 * getGuestId) when you only want to inspect existing guest state — e.g. the
 * guest→authenticated data migration on login/signup, which must not create a
 * brand-new guest identity as a side effect.
 */
export async function readGuestId(): Promise<string | null> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_ID_COOKIE);
  if (existing?.value && isValidGuestId(existing.value)) {
    return existing.value;
  }
  return null;
}

/**
 * Clear the guest ID cookie. Called after the guest→authenticated migration
 * succeeds so future anonymous browsing mints a fresh guest identity instead
 * of reusing one that has already been claimed by a user account (which would
 * let a single guest id leak data across multiple user accounts on shared
 * devices).
 */
export async function clearGuestId(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(GUEST_ID_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
