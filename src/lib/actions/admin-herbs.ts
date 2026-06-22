"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";
import { logger } from "@/lib/utils/logger";
import type { ActionResponse } from "@/lib/types";
import type { Database } from "@/lib/types/database";

type HerbInsert = Database["public"]["Tables"]["herbs"]["Insert"];
type Herb = Database["public"]["Tables"]["herbs"]["Row"];

/**
 * Resolve an authenticated Supabase client whose user is an admin, verified
 * against the `profiles.role` column (never against client-supplied JWT
 * metadata). Returns `ok: false` for unauthenticated / non-admin callers so a
 * server action can bail before any write. The admin herb INSERT/UPDATE RLS
 * policies (00005) gate on this same check, so a forged caller still cannot
 * write — defense in depth.
 */
async function requireAdmin(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  ok: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { supabase, ok: profile?.role === "admin" };
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function bool(formData: FormData, key: string): boolean {
  // Native checkbox submits the field name (`on`) only when checked, so
  // presence === true. Radix Switch renders a <button> which does NOT submit,
  // so the admin form uses native checkboxes for these booleans.
  return formData.get(key) !== null;
}

/**
 * Find a unique slug derived from `base`. Appends `-2`, `-3`, … until an unused
 * slug is found. Bounded to avoid an unbounded loop on pathological input.
 */
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string
): Promise<string> {
  const root = base || "herb";
  let slug = root;
  for (let n = 2; n < 100; n++) {
    const { data } = await supabase
      .from("herbs")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${root}-${n}`;
  }
  // Extremely unlikely fallback — guarantees termination.
  return `${root}-${Date.now()}`;
}

function buildRow(formData: FormData): Omit<HerbInsert, "slug"> {
  return {
    name: str(formData, "name"),
    scientific_name: str(formData, "scientific_name"),
    description: str(formData, "description"),
    common_names: parseStringArray(str(formData, "common_names")),
    dosage_adult: str(formData, "dosage_adult") || null,
    dosage_child: str(formData, "dosage_child") || null,
    pregnancy_safe: bool(formData, "pregnancy_safe"),
    nursing_safe: bool(formData, "nursing_safe"),
    is_published: bool(formData, "is_published"),
  };
}

function validateRow(row: Omit<HerbInsert, "slug">): string | null {
  if (!row.name) return "Common name is required.";
  if (!row.scientific_name) return "Scientific name is required.";
  if (!row.description) return "Description is required.";
  return null;
}

export async function createHerb(
  formData: FormData
): Promise<ActionResponse<Herb>> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { success: false, error: "Not authorized" };

  const row = buildRow(formData);
  const validationError = validateRow(row);
  if (validationError) return { success: false, error: validationError };

  try {
    const slug = await uniqueSlug(supabase, slugify(row.name));
    const { error } = await supabase
      .from("herbs")
      .insert({ ...row, slug })
      .select()
      .single();
    if (error) {
      logger.error("createHerb_failed", { error: error.message });
      return { success: false, error: error.message };
    }
    revalidatePath("/herbs");
    revalidatePath(`/herbs/${slug}`);
    revalidatePath("/admin/herbs");
  } catch (error) {
    logger.error("createHerb_exception", { error: String(error) });
    return { success: false, error: "Failed to create herb" };
  }
  redirect("/admin/herbs");
}

export async function updateHerb(
  formData: FormData
): Promise<ActionResponse<Herb>> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { success: false, error: "Not authorized" };

  const id = str(formData, "id");
  if (!id) return { success: false, error: "Missing herb id" };

  const row = buildRow(formData);
  const validationError = validateRow(row);
  if (validationError) return { success: false, error: validationError };

  try {
    // Slug is intentionally NOT updated on edit — changing the URL would break
    // inbound links and the sitemap. Only the editable fields are sent.
    const { data, error } = await supabase
      .from("herbs")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      logger.error("updateHerb_failed", { error: error.message });
      return { success: false, error: error.message };
    }
    revalidatePath("/herbs");
    revalidatePath(`/herbs/${data.slug}`);
    revalidatePath(`/admin/herbs/${id}/edit`);
    revalidatePath("/admin/herbs");
  } catch (error) {
    logger.error("updateHerb_exception", { error: String(error) });
    return { success: false, error: "Failed to update herb" };
  }
  redirect("/admin/herbs");
}
