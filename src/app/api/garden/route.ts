import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";import { logger } from "@/lib/utils/logger";
import { z } from "zod";


/**
 * POST /api/garden — sync local garden to the server.
 * Body: { herbs: Array<{ slug, name, scientific_name, image_url?, note? }>, guestId?: string }
 *
 * NOTE: The `garden_herbs` table is defined in migration 00027_create_garden.sql.
 * Until applied, regenerate types with:
 *   supabase gen types typescript --linked > src/lib/types/database.ts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const schema = z.object({ herbs: z.array(z.object({ slug: z.string().min(1), name: z.string().min(1), scientific_name: z.string().min(1), image_url: z.string().url().optional().nullable(), note: z.string().max(500).optional() })).max(100), guestId: z.string().optional() });
    const parsed = schema.safeParse(body);
    if (!parsed.success) { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
    const herbs = parsed.data.herbs;



    if (herbs.length === 0) {
      return NextResponse.json({ saved: 0, errors: [] });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adminClient = createAdminClient();
    const result = { saved: 0, errors: [] as string[] };

    if (user) {
      for (const herb of herbs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (adminClient.from as any)("garden_herbs").upsert(
          {
            user_id: user.id,
            herb_slug: herb.slug,
            herb_name: herb.name,
            scientific_name: herb.scientific_name,
            image_url: herb.image_url ?? null,
            note: herb.note ?? null,
          },
          {
            onConflict: "user_id,herb_slug",
            ignoreDuplicates: false,
          }
        );
        if (error) {
          result.errors.push(`${herb.slug}: ${error.message}`);
        } else {
          result.saved++;
        }
      }
    } else if (body.guestId) {
      for (const herb of herbs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (adminClient.from as any)("garden_herbs").upsert(
          {
            guest_id: body.guestId,
            herb_slug: herb.slug,
            herb_name: herb.name,
            scientific_name: herb.scientific_name,
            image_url: herb.image_url ?? null,
            note: herb.note ?? null,
          },
          {
            onConflict: "guest_id,herb_slug",
            ignoreDuplicates: false,
          }
        );
        if (error) {
          result.errors.push(`${herb.slug}: ${error.message}`);
        } else {
          result.saved++;
        }
      }
    } else {
      return NextResponse.json(
        { error: "Authentication or guestId required" },
        { status: 401 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    logger.error("garden_sync_error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Failed to sync garden" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/garden — fetch server-side garden.
 * Query: ?guestId=xxx (for guests)
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const url = new URL(request.url);
    const guestId = url.searchParams.get("guestId");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (adminClient.from as any)("garden_herbs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const herbs = (data ?? []).map((row: any) => ({
        id: row.id,
        slug: row.herb_slug,
        name: row.herb_name,
        scientific_name: row.scientific_name,
        image_url: row.image_url,
        note: row.note,
        savedAt: row.created_at,
      }));

      return NextResponse.json({ herbs });
    }

    if (guestId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (adminClient.from as any)("garden_herbs")
        .select("*")
        .eq("guest_id", guestId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const herbs = (data ?? []).map((row: any) => ({
        id: row.id,
        slug: row.herb_slug,
        name: row.herb_name,
        scientific_name: row.scientific_name,
        image_url: row.image_url,
        note: row.note,
        savedAt: row.created_at,
      }));

      return NextResponse.json({ herbs });
    }

    return NextResponse.json({ herbs: [] });
  } catch (err) {
    logger.error("garden_fetch_error", { error: err instanceof Error ? err.message : String(err) });
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
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    const guestId = url.searchParams.get("guestId");

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (adminClient.from as any)("garden_herbs")
        .delete()
        .eq("user_id", user.id)
        .eq("herb_slug", slug);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ removed: true });
    }

    if (guestId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (adminClient.from as any)("garden_herbs")
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
    logger.error("garden_delete_error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Failed to remove herb" },
      { status: 500 }
    );
  }
}
