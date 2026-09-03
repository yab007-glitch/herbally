import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { z } from "zod";
import { getGuestId } from "@/lib/actions/guest-id";

const herbSchema = z.object({
  slug: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  scientific_name: z.string().min(1).max(200),
  image_url: z.string().url().nullable().optional(),
  note: z.string().max(500).optional(),
});

const bodySchema = z.object({
  herbs: z.array(herbSchema).max(100),
  // `guestId` from the body is intentionally IGNORED — the guest identity is
  // derived from the HttpOnly server cookie so a client cannot read another
  // guest's garden by sending a different id (SEC-9).
});

async function rateLimited(request: NextRequest) {
  const { success } = await rateLimit(getClientIP(request), 30, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  return null;
}

/**
 * POST /api/garden — sync local garden to the server.
 *
 * Authenticated users go through the Supabase server client (anon key + the
 * user's JWT cookie) so RLS enforces `auth.uid() = user_id`. Guests (no
 * session) are identified by the HttpOnly `herbally-guest-id` cookie minted and
 * read server-side — never by a client-supplied value. Guest writes still use
 * the service role (no auth identity for RLS), but scoped to that trusted id.
 */
export async function POST(request: NextRequest) {
  const limited = await rateLimited(request);
  if (limited) return limited;

  // Bound body before parsing (chunked-encoding may omit content-length).
  const contentLength = parseInt(
    request.headers.get("content-length") || "0",
    10
  );
  if (contentLength > 100 * 1024) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 }
    );
  }

  try {
    const body = await request.json();
    if (JSON.stringify(body).length > 100 * 1024) {
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 413 }
      );
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    const { herbs } = parsed.data;

    if (herbs.length === 0) {
      return NextResponse.json({ saved: 0, errors: [] });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = { saved: 0, errors: [] as string[] };

    if (user) {
      // Authenticated: RLS-scoped server client.
      for (const herb of herbs) {
        const { error } = await supabase.from("garden_herbs").upsert(
          {
            user_id: user.id,
            herb_slug: herb.slug,
            herb_name: herb.name,
            scientific_name: herb.scientific_name,
            image_url: herb.image_url ?? null,
            note: herb.note ?? null,
          },
          { onConflict: "user_id,herb_slug", ignoreDuplicates: false }
        );
        if (error) {
          logger.error("garden_sync_user_error", {
            slug: herb.slug,
            error: error.message,
          });
          result.errors.push(herb.slug);
        } else result.saved++;
      }
    } else {
      // Guest: identity from the HttpOnly cookie, not the request body.
      const guestId = await getGuestId();
      const adminClient = createAdminClient();
      for (const herb of herbs) {
        const { error } = await adminClient.from("garden_herbs").upsert(
          {
            guest_id: guestId,
            herb_slug: herb.slug,
            herb_name: herb.name,
            scientific_name: herb.scientific_name,
            image_url: herb.image_url ?? null,
            note: herb.note ?? null,
          },
          { onConflict: "guest_id,herb_slug", ignoreDuplicates: false }
        );
        if (error) {
          logger.error("garden_sync_guest_error", {
            slug: herb.slug,
            error: error.message,
          });
          result.errors.push(herb.slug);
        } else result.saved++;
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    logger.error("garden_sync_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to sync garden" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/garden — fetch server-side garden.
 */
export async function GET(request: NextRequest) {
  const limited = await rateLimited(request);
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from("garden_herbs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ herbs: data ?? [] });
    }

    // Guest: derive identity from the cookie, ignore any ?guestId= param.
    const guestId = await getGuestId();
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("garden_herbs")
      .select("*")
      .eq("guest_id", guestId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ herbs: data ?? [] });
  } catch (err) {
    logger.error("garden_fetch_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to fetch garden" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/garden — remove a herb from server garden. Query: ?slug=ginger
 */
export async function DELETE(request: NextRequest) {
  const limited = await rateLimited(request);
  if (limited) return limited;

  try {
    const url = new URL(request.url);
    // L5 (audit 2026-06-22): bound the slug so a caller can't pass an
    // unbounded string into the eq() filter. Slugs are <=200 chars by the
    // insert schema; reject anything longer.
    const slugSchema = z.string().min(1).max(200);
    const slugRaw = url.searchParams.get("slug");
    const parsedSlug = slugSchema.safeParse(slugRaw);
    if (!parsedSlug.success) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }
    const slug = parsedSlug.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from("garden_herbs")
        .delete()
        .eq("user_id", user.id)
        .eq("herb_slug", slug);
      if (error) {
        logger.error("garden_delete_user_error", {
          slug,
          error: error.message,
        });
        return NextResponse.json(
          { error: "Failed to remove herb" },
          { status: 500 }
        );
      }
      return NextResponse.json({ removed: true });
    }

    const guestId = await getGuestId();
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("garden_herbs")
      .delete()
      .eq("guest_id", guestId)
      .eq("herb_slug", slug);
    if (error) {
      logger.error("garden_delete_guest_error", { slug, error: error.message });
      return NextResponse.json(
        { error: "Failed to remove herb" },
        { status: 500 }
      );
    }
    return NextResponse.json({ removed: true });
  } catch (err) {
    logger.error("garden_delete_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to remove herb" },
      { status: 500 }
    );
  }
}
