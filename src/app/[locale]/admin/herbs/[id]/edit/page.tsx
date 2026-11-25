import { notFound } from "next/navigation";
import { getAdminAccess } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateHerb } from "@/lib/actions/admin-herbs";
import { HerbForm } from "@/components/admin/herb-form";
import { ReviewPanel } from "@/components/admin/review-panel";
import { getReviewer } from "@/lib/data/reviewers";
import { PUBLIC_HERB_COLUMNS } from "@/lib/herbs/public-columns";
import type { Database } from "@/lib/types/database";

type Herb = Database["public"]["Tables"]["herbs"]["Row"];

export const metadata = {
  title: "Edit Herb",
};

type Props = { params: Promise<{ id: string }> };

export default async function EditHerbPage({ params }: Props) {
  const { id } = await params;
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    notFound();
  }
  const supabase = createAdminClient();

  const { data: herb, error } = await supabase
    .from("herbs")
    .select(PUBLIC_HERB_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !herb) {
    notFound();
  }

  const herbRow = herb as unknown as Herb;

  const provenance = (herbRow.provenance ?? {}) as {
    reviewed_on?: string | null;
    reviewed_by_name?: string | null;
  };
  const reviewerName =
    provenance.reviewed_by_name ??
    getReviewer(herbRow.reviewed_by)?.name ??
    null;
  const reviewedOn =
    provenance.reviewed_on ??
    (herbRow.last_reviewed
      ? new Date(herbRow.last_reviewed).toISOString().slice(0, 10)
      : null);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Edit {herbRow.name}</h1>
      <HerbForm action={updateHerb} mode="edit" herb={herbRow} />
      <ReviewPanel
        herbId={herbRow.id}
        slug={herb.slug}
        reviewerName={reviewerName}
        reviewedOn={reviewedOn}
      />
    </div>
  );
}
