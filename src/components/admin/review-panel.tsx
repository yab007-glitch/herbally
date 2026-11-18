"use client";

import { useActionState } from "react";
import { reviewHerbAction } from "@/lib/actions/admin-herbs";

/**
 * Per-page editorial review control.
 *
 * The public byline and the schema.org `reviewedBy` node are driven by
 * `herbs.reviewed_by`, which only this panel sets. It is deliberately one page
 * at a time: the site tells readers that "Reviewed by" means a named person
 * actually read the page, and a bulk stamp would make that sentence false.
 */
export function ReviewPanel({
  herbId,
  slug,
  reviewerName,
  reviewedOn,
}: {
  herbId: string;
  slug: string;
  reviewerName: string | null;
  reviewedOn: string | null;
}) {
  const reviewed = Boolean(reviewerName);
  const [state, formAction, pending] = useActionState<
    { ok: boolean; message?: string } | null,
    FormData
  >(async (_prev, formData) => {
    const result = await reviewHerbAction(formData);
    return result.success
      ? {
          ok: true,
          message: reviewed ? "Review removed." : "Marked as reviewed.",
        }
      : { ok: false, message: result.error };
  }, null);

  return (
    <section className="mt-8 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold text-foreground">
        Editorial review
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {reviewed
          ? `Reviewed by ${reviewerName}${reviewedOn ? ` on ${reviewedOn}` : ""}. The public page shows this byline and emits it as schema.org reviewedBy.`
          : "Not reviewed yet. Marking records that a named person read this page. It is editorial review, not clinical review, and it shows publicly only on pages marked here."}
      </p>
      <form action={formAction} className="mt-3">
        <input type="hidden" name="herb_id" value={herbId} />
        <input type="hidden" name="slug" value={slug} />
        <input
          type="hidden"
          name="intent"
          value={reviewed ? "clear" : "mark"}
        />
        <button
          type="submit"
          disabled={pending}
          className={
            reviewed
              ? "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
              : "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          }
        >
          {pending
            ? "Saving…"
            : reviewed
              ? "Remove review"
              : "Mark as reviewed by Yasser Bheekun"}
        </button>
      </form>
      {state && (
        <p
          role="status"
          className={
            state.ok
              ? "mt-2 text-sm text-green-700"
              : "mt-2 text-sm text-destructive"
          }
        >
          {state.message}
        </p>
      )}
    </section>
  );
}
