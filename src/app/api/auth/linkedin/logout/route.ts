import { NextResponse } from "next/server";
import {
  LINKEDIN_SESSION_COOKIE,
  LINKEDIN_STATE_COOKIE,
  reviewerCookieOptions,
} from "@/lib/auth/linkedin-oidc";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST() {
  const res = NextResponse.json(
    { ok: true },
    { status: 200, headers: NO_STORE }
  );
  res.cookies.set(LINKEDIN_SESSION_COOKIE, "", reviewerCookieOptions(0));
  res.cookies.set(LINKEDIN_STATE_COOKIE, "", reviewerCookieOptions(0));
  return res;
}
