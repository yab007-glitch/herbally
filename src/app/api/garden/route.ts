import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { z } from "zod";

const herbSchema = z.object({
  slug: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  scientific_name: z.string().min(1).max(200),
  image_url: z.string().url().nullable().optional(),
  note: z.string().max(500).optional(),
});

const bodySchema = z.object({
  herbs: z.array(herbSchema).max(100),
  guestId: z.string().min(1).max(200).optional(),
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
 * user's JWT cookie) so RLS enforces `auth.uid() = user_id` — we no longer rely
 * on the service-role key for them. Guests (no session) still use the service
 * role because there is no auth identity for RLS to key on; access is scoped
 * by the client-supplied guestId.
 */
export async function POST(request: NextRequest) {
  const limited = await rateLimited(request);
  if (limited) return limited;

  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    const { herbs, guestId } = parsed.data;

    if (herbs.length === 0) {
      return NextResponse.json({ saved: 0, errors: [] });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = { saved: 0, errors: [] as string[] };

    if (user) {
      // Authenticated: use the RLS-scoped server client. RLS policy
      // "Users can manage own garden" enforces auth.uid() = user_id.
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
        if (error) result.errors.push(`${herb.slug}: ${error.message}`);
        else result.saved++;
      }
    } else if (guestId) {
      // Guest: no auth identity, so RLS can't apply. Use the service role,
      // scoped by guestId.
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
        if (error) result.errors.push(`${herb.slug}: ${error.message}`);
        else result.saved++;
      }
    } else {
      return NextResponse.json(
        { error: "Authentication or guestId required" },
        { status: 401 }
      );
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
    const url = new URL(request.url);
    const guestId = url.searchParams.get("guestId");

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

    if (guestId) {
      const adminClient = createAdminClient();
      const { data, error } = await adminClient
        .from("garden_herbs")
        .select("*")
        .eq("guest_id", guestId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ herbs: data ?? [] });
    }

    return NextResponse.json({ herbs: [] });
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
 * DELETE /api/garden — remove a herb from server garden.
 * Query: ?slug=ginger&guestId=xxx (for guests)
 */
export async function DELETE(request: NextRequest) {
  const limited = await rateLimited(request);
  if (limited) return limited;

  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    const guestId = url.searchParams.get("guestId");

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

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
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ removed: true });
    }

    if (guestId) {
      const adminClient = createAdminClient();
      const { error } = await adminClient
        .from("garden_herbs")
        .delete()
        .eq("guest_id", guestId)
        .eq("herb_slug", slug);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ removed: true });
    }

    return NextResponse.json(
      { error: "Authentication or guestId required" },
      { status: 401 }
    );
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
