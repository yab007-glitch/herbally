import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
} as const;

export async function GET(request: NextRequest) {
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => /^sb-.*-auth-token/.test(c.name) && Boolean(c.value));

  if (!hasAuthCookie) {
    return NextResponse.json({ user: null }, { headers: NO_STORE_HEADERS });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ user: null }, { headers: NO_STORE_HEADERS });
    }

    let isAdmin = false;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isAdmin = profile?.role === "admin";
    } catch {
      // Default to non-admin if profile lookup fails.
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          isAdmin,
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json({ user: null }, { headers: NO_STORE_HEADERS });
  }
}
