/**
 * Server-side garden operations backed by Supabase.
 * Supports both authenticated users (user_id) and anonymous guests (guest_id).
 *
 * NOTE: The `garden_herbs` table is defined in migration 00027_create_garden.sql.
 * Until that migration is applied to your Supabase project, regenerate types with:
 *   supabase gen types typescript --linked > src/lib/types/database.ts
 * The `.from("garden_herbs" as any)` casts below are safe and will tighten
 * once the generated types include the new table.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Type-safe row shape until Database type is regenerated
interface GardenRow {
  id: string;
  user_id: string | null;
  guest_id: string | null;
  herb_slug: string;
  herb_name: string;
  scientific_name: string;
  image_url: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type ServerGardenHerb = {
  id?: string;
  slug: string;
  name: string;
  scientific_name: string;
  image_url?: string | null;
  note?: string | null;
  savedAt: string;
};

export type GardenSyncPayload = {
  herbs: {
    slug: string;
    name: string;
    scientific_name: string;
    image_url?: string | null;
    note?: string | null;
  }[];
  guestId?: string;
};

export type GardenSyncResult = {
  saved: number;
  errors: string[];
};

/**
 * Upsert a batch of herbs into the server-side garden.
 */
async function upsertGuestHerbs(
  guestId: string,
  herbs: GardenSyncPayload["herbs"]
): Promise<GardenSyncResult> {
  const supabase = createAdminClient();
  const result: GardenSyncResult = { saved: 0, errors: [] };

  for (const herb of herbs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)("garden_herbs").upsert(
      {
        guest_id: guestId,
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

  return result;
}

async function upsertUserHerbs(
  userId: string,
  herbs: GardenSyncPayload["herbs"]
): Promise<GardenSyncResult> {
  const supabase = createAdminClient();
  const result: GardenSyncResult = { saved: 0, errors: [] };

  for (const herb of herbs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)("garden_herbs").upsert(
      {
        user_id: userId,
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

  return result;
}

/**
 * Fetch the server-side garden for an authenticated user.
 */
export async function getGardenForUser(): Promise<ServerGardenHerb[]> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const adminClient = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminClient.from as any)("garden_herbs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as GardenRow[]).map((row) => ({
    id: row.id,
    slug: row.herb_slug,
    name: row.herb_name,
    scientific_name: row.scientific_name,
    image_url: row.image_url,
    note: row.note,
    savedAt: row.created_at,
  }));
}

/**
 * Fetch the server-side garden for a guest (by guest_id).
 */
export async function getGardenForGuest(
  guestId: string
): Promise<ServerGardenHerb[]> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)("garden_herbs")
    .select("*")
    .eq("guest_id", guestId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as GardenRow[]).map((row) => ({
    id: row.id,
    slug: row.herb_slug,
    name: row.herb_name,
    scientific_name: row.scientific_name,
    image_url: row.image_url,
    note: row.note,
    savedAt: row.created_at,
  }));
}

/**
 * Sync garden herbs to the server.
 */
export async function syncGardenToServer(
  payload: GardenSyncPayload
): Promise<GardenSyncResult> {
  if (payload.herbs.length === 0) return { saved: 0, errors: [] };

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return upsertUserHerbs(user.id, payload.herbs);
    }
  } catch {
    // Not authenticated, fall through to guest
  }

  if (payload.guestId) {
    return upsertGuestHerbs(payload.guestId, payload.herbs);
  }

  return { saved: 0, errors: ["No user or guest ID available"] };
}

/**
 * Remove a herb from the server-side garden.
 */
export async function removeGardenHerbFromServer(
  slug: string,
  guestId?: string
): Promise<boolean> {
  const supabase = createAdminClient();

  try {
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)("garden_herbs")
        .delete()
        .eq("user_id", user.id)
        .eq("herb_slug", slug);
      return !error;
    }
  } catch {
    // Not authenticated, fall through to guest
  }

  if (guestId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)("garden_herbs")
      .delete()
      .eq("guest_id", guestId)
      .eq("herb_slug", slug);
    return !error;
  }

  return false;
}
