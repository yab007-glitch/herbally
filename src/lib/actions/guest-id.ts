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
 * Set the guest ID cookie explicitly. Only accepts a valid UUID; any other
 * value is rejected so callers can't write arbitrary data into the cookie.
 */
export async function setGuestId(guestId: string): Promise<void> {
  if (!isValidGuestId(guestId)) {
    throw new Error("Invalid guest id");
  }
  const cookieStore = await cookies();
  cookieStore.set(GUEST_ID_COOKIE, guestId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });
}
