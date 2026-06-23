import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateHerb } from "@/lib/actions/admin-herbs";
import { HerbForm } from "@/components/admin/herb-form";
import type { Database } from "@/lib/types/database";

type Herb = Database["public"]["Tables"]["herbs"]["Row"];

export const metadata = {
  title: "Edit Herb",
};

type Props = { params: Promise<{ id: string }> };

export default async function EditHerbPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // The admin layout already verified the caller's role; the "Admins can view
  // all herbs" RLS policy (00005) authorizes this SELECT.
  const { data: herb, error } = await supabase
    .from("herbs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !herb) {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Edit {herb.name}</h1>
      <HerbForm action={updateHerb} mode="edit" herb={herb as Herb} />
    </div>
  );
}
