import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileEdit } from "lucide-react";
import { getAdminAccess } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateClinicalEditRequestStatusAction } from "@/lib/actions/admin-clinical-edits";
import {
  EDIT_REQUEST_STATUSES,
  type ClinicalEditRequestRow,
} from "@/lib/governance/clinical-edits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = {
  title: "Clinical Edit Requests",
};

export const dynamic = "force-dynamic";

export default async function AdminEditRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    notFound();
  }

  const sp = await searchParams;
  const activeFilter =
    sp.status === "all" ||
    EDIT_REQUEST_STATUSES.includes(
      sp.status as (typeof EDIT_REQUEST_STATUSES)[number]
    )
      ? sp.status!
      : "pending";

  let rows: ClinicalEditRequestRow[] = [];
  let countsByStatus: Record<string, number> = {};

  try {
    const admin = createAdminClient();
    const { data: allStatusRows } = await admin
      .from("clinical_edit_requests")
      .select("status");
    for (const r of allStatusRows ?? []) {
      countsByStatus[r.status] = (countsByStatus[r.status] ?? 0) + 1;
    }

    let query = admin
      .from("clinical_edit_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (activeFilter !== "all") {
      query = query.eq("status", activeFilter);
    }
    const { data } = await query;
    rows = (data ?? []) as ClinicalEditRequestRow[];
  } catch {
    countsByStatus = {};
    rows = [];
  }

  const totalAll = Object.values(countsByStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <FileEdit className="size-6 text-primary" />
            Clinical Edit Requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            LinkedIn-validated clinical reviewer submissions awaiting AAL2 admin
            verification and triage.
          </p>
        </div>
        <Link href="/clinical-review" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5">
            Public portal
            <ExternalLink className="size-3.5" />
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            "pending",
            "under_review",
            "needs_info",
            "approved",
            "applied",
            "rejected",
            "all",
          ] as const
        ).map((st) => {
          const count = st === "all" ? totalAll : (countsByStatus[st] ?? 0);
          const isActive = activeFilter === st;
          return (
            <Link
              key={st}
              href={`/admin/edit-requests?status=${st}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {st.replace("_", " ")} ({count})
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No clinical edit requests in “{activeFilter.replace("_", " ")}”.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((req) => {
            const citations = Array.isArray(req.citations)
              ? req.citations.map(String)
              : [];
            return (
              <Card key={req.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{req.summary}</CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">{req.status}</Badge>
                        <span>
                          {req.target_type}
                          {req.herb_slug ? ` · ${req.herb_slug}` : ""}
                          {req.drug_name ? ` · ${req.drug_name}` : ""}
                        </span>
                        <span>· {req.field_scope}</span>
                        <span>
                          · {new Date(req.created_at).toLocaleString("en-CA")}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs space-y-1">
                    <p>
                      <strong>LinkedIn SSO Identity:</strong>{" "}
                      {req.linkedin_name} ({req.linkedin_email} ·{" "}
                      {req.linkedin_email_verified
                        ? "verified email"
                        : "unverified email"}
                      ) ·{" "}
                      <a
                        href={req.linkedin_profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        {req.linkedin_profile_url}
                      </a>
                    </p>
                    <p>
                      <strong>Role & Credentials:</strong>{" "}
                      {req.professional_role} · {req.credentials}
                      {req.affiliation ? ` · ${req.affiliation}` : ""}
                    </p>
                    {(req.licence_number || req.licence_jurisdiction) && (
                      <p>
                        <strong>Private Licence Info:</strong>{" "}
                        {req.licence_number ?? "—"} (
                        {req.licence_jurisdiction ?? "jurisdiction unspecified"}
                        )
                      </p>
                    )}
                    <p>
                      <strong>COI Disclosure:</strong>{" "}
                      {req.conflict_of_interest} ·{" "}
                      <strong>Attribution consent:</strong>{" "}
                      {req.attribution_consent ? "Yes" : "No"}
                    </p>
                  </div>

                  {req.current_text && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        Current text / grade flagged
                      </p>
                      <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 p-2.5 text-xs">
                        {req.current_text}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Proposed change
                    </p>
                    <p className="mt-1 whitespace-pre-wrap rounded-md border bg-background p-2.5 text-xs">
                      {req.proposed_change}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Clinical rationale
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                      {req.clinical_rationale}
                    </p>
                  </div>

                  {citations.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        Citations
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 font-mono text-xs">
                        {citations.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <form
                    action={updateClinicalEditRequestStatusAction}
                    className="space-y-3 border-t border-border pt-3"
                  >
                    <input type="hidden" name="requestId" value={req.id} />
                    <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                      <div className="space-y-1">
                        <Label htmlFor={`status-${req.id}`} className="text-xs">
                          New status
                        </Label>
                        <select
                          id={`status-${req.id}`}
                          name="status"
                          defaultValue={req.status}
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          {EDIT_REQUEST_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`notes-${req.id}`} className="text-xs">
                          Editorial / review notes
                        </Label>
                        <Input
                          id={`notes-${req.id}`}
                          name="adminNotes"
                          defaultValue={req.admin_notes ?? ""}
                          placeholder="Reason for approval, requested clarification, or rejection..."
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          name="publishCorrection"
                          className="size-3.5 rounded border-border"
                        />
                        Log to public corrections feed when marked “applied”
                      </label>
                      <div className="flex flex-1 max-w-md items-center gap-2">
                        <Input
                          name="correctionSummary"
                          placeholder="Optional public correction summary (if logging)"
                          className="h-8 text-xs"
                        />
                        <Button type="submit" size="sm">
                          Save triage
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
