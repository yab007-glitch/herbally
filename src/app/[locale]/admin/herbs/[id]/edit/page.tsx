import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateHerb } from "@/lib/actions/admin-herbs";
import { HerbForm } from "@/components/admin/herb-form";
import { ReviewPanel } from "@/components/admin/review-panel";
import { getReviewer } from "@/lib/data/reviewers";
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

  const provenance = (herb.provenance ?? {}) as {
    reviewed_on?: string | null;
    reviewed_by_name?: string | null;
  };
  const reviewerName =
    provenance.reviewed_by_name ?? getReviewer(herb.reviewed_by)?.name ?? null;
  const reviewedOn =
    provenance.reviewed_on ??
    (herb.last_reviewed
      ? new Date(herb.last_reviewed).toISOString().slice(0, 10)
      : null);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Edit {herb.name}</h1>
      <HerbForm action={updateHerb} mode="edit" herb={herb as Herb} />
      <ReviewPanel
        herbId={herb.id}
        slug={herb.slug}
        reviewerName={reviewerName}
        reviewedOn={reviewedOn}
      />
    </div>
  );
}
