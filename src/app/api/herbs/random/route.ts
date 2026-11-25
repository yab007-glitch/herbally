import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const { success } = await rateLimit(
    rateLimitKey("herbs-random", getClientIP(request)),
    20,
    60_000
  );
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60", ...NO_STORE } }
    );
  }

  try {
    const supabase = await createClient();

    // Get count first (published only — defense-in-depth alongside RLS)
    const { count, error: countError } = await supabase
      .from("herbs")
      .select("*", { count: "exact", head: true })
      .eq("is_published", true);

    if (countError) {
      logger.error("herbs_random_count_failed", { error: countError.message });
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503, headers: NO_STORE }
      );
    }

    if (!count || count === 0) {
      return NextResponse.json(
        { error: "No herbs found" },
        { status: 404, headers: NO_STORE }
      );
    }

    // Get a random offset
    const randomOffset = Math.floor(Math.random() * count);

    // Fetch one herb at that offset (published only, deterministic order)
    const { data, error } = await supabase
      .from("herbs")
      .select("slug")
      .eq("is_published", true)
      .order("id", { ascending: true })
      .range(randomOffset, randomOffset)
      .limit(1)
      .single();

    if (error || !data) {
      if (error) {
        logger.error("herbs_random_fetch_failed", { error: error.message });
      }
      return NextResponse.json(
        { error: "Failed to get random herb" },
        { status: 503, headers: NO_STORE }
      );
    }

    return NextResponse.json({ slug: data.slug }, { headers: NO_STORE });
  } catch (error) {
    logger.error("herbs_random_exception", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503, headers: NO_STORE }
    );
  }
}
