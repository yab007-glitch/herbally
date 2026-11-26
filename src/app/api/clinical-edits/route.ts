import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLinkedInReviewerSession } from "@/lib/auth/linkedin-oidc";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { readJsonBodyWithLimit } from "@/lib/http/read-json-body";
import { isMailConfigured, sendMail } from "@/lib/email/mailer";
import { logger } from "@/lib/utils/logger";
import { clinicalEditSubmissionSchema } from "@/lib/governance/clinical-edits";

const MAX_BODY_SIZE = 32 * 1024;
const NO_STORE = { "Cache-Control": "private, no-store" };

function getAdminSafely() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const rl = await rateLimit(
    rateLimitKey("clinical-edits-get", ip),
    30,
    60_000
  );
  if (!rl.success) {
    return NextResponse.json(
      { authenticated: false, error: "Too many requests." },
      { status: 429, headers: NO_STORE }
    );
  }

  const session = await getLinkedInReviewerSession();
  if (!session) {
    return NextResponse.json(
      { authenticated: false, requests: [] },
      { status: 401, headers: NO_STORE }
    );
  }

  const admin = getAdminSafely();
  if (!admin) {
    return NextResponse.json(
      {
        authenticated: true,
        reviewer: {
          name: session.name,
          email: session.email,
          emailVerified: session.emailVerified,
        },
        requests: [],
      },
      { status: 200, headers: NO_STORE }
    );
  }

  const herbSlugParam = new URL(request.url).searchParams
    .get("herbSlug")
    ?.trim();
  const herbSlugFilter =
    herbSlugParam && /^[a-z0-9-]+$/i.test(herbSlugParam)
      ? herbSlugParam.toLowerCase()
      : null;

  let query = admin
    .from("clinical_edit_requests")
    .select(
      "id, target_type, herb_slug, drug_name, field_scope, summary, status, admin_notes, created_at, updated_at"
    )
    .eq("linkedin_sub", session.sub);

  if (herbSlugFilter) {
    query = query.eq("herb_slug", herbSlugFilter);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    logger.error("clinical_edits_get_failed", { error: error.message });
    return NextResponse.json(
      { authenticated: true, error: "Could not load requests.", requests: [] },
      { status: 500, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      reviewer: {
        name: session.name,
        email: session.email,
        emailVerified: session.emailVerified,
      },
      requests: data ?? [],
    },
    { status: 200, headers: NO_STORE }
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const rl = await rateLimit(
    rateLimitKey("clinical-edits-post", ip),
    10,
    60_000
  );
  if (!rl.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Too many submissions. Please try again later.",
      },
      { status: 429, headers: NO_STORE }
    );
  }

  const session = await getLinkedInReviewerSession();
  if (!session) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Sign in with LinkedIn SSO before submitting an edit request.",
      },
      { status: 401, headers: NO_STORE }
    );
  }

  const perReviewer = await rateLimit(
    rateLimitKey("clinical-edits-sub", session.sub),
    5,
    3_600_000
  );
  if (!perReviewer.success) {
    return NextResponse.json(
      {
        accepted: false,
        error:
          "Hourly submission limit reached for this reviewer session. Please wait before submitting another request.",
      },
      { status: 429, headers: NO_STORE }
    );
  }

  const bodyResult = await readJsonBodyWithLimit(request, MAX_BODY_SIZE);
  if (!bodyResult.ok) {
    return NextResponse.json(
      {
        accepted: false,
        error:
          bodyResult.reason === "too_large"
            ? "Request payload too large"
            : "Invalid JSON payload",
      },
      {
        status: bodyResult.reason === "too_large" ? 413 : 400,
        headers: NO_STORE,
      }
    );
  }

  const parsed = clinicalEditSubmissionSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      {
        accepted: false,
        error:
          parsed.error.issues[0]?.message ?? "Invalid edit request payload.",
      },
      { status: 400, headers: NO_STORE }
    );
  }

  const admin = getAdminSafely();
  if (!admin) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Editorial intake storage is temporarily unavailable.",
      },
      { status: 503, headers: NO_STORE }
    );
  }

  const payload = parsed.data;
  try {
    // Reviewer identity columns always come exclusively from the signed server
    // session cookie (never from client form input).
    const { data, error } = await admin
      .from("clinical_edit_requests")
      .insert({
        linkedin_sub: session.sub,
        linkedin_name: session.name,
        linkedin_email: session.email,
        linkedin_email_verified: session.emailVerified,
        linkedin_picture: session.picture,
        linkedin_profile_url: payload.linkedinProfileUrl || null,
        professional_role: payload.professionalRole,
        credentials: payload.credentials || null,
        affiliation: payload.affiliation || null,
        licence_number: payload.licenceNumber || null,
        licence_jurisdiction: payload.licenceJurisdiction || null,
        conflict_of_interest: payload.conflictOfInterest || null,
        attribution_consent: payload.attributionConsent,
        no_phi_attested: true,
        target_type: payload.targetType,
        herb_slug: payload.herbSlug ? payload.herbSlug.toLowerCase() : null,
        drug_name: payload.drugName || null,
        surface_url: payload.surfaceUrl || null,
        field_scope: payload.fieldScope,
        summary: payload.summary,
        current_text: payload.currentText || null,
        proposed_change: payload.proposedChange,
        clinical_rationale: payload.clinicalRationale || null,
        citations: payload.citations,
        locale: payload.locale,
        status: "pending",
      })
      .select("id, status, created_at")
      .single();

    if (error || !data) {
      logger.error("clinical_edit_insert_failed", {
        error: error?.message ?? "no row returned",
      });
      return NextResponse.json(
        { accepted: false, error: "Could not save clinical edit request." },
        { status: 500, headers: NO_STORE }
      );
    }

    const { error: eventErr } = await admin
      .from("clinical_edit_request_events")
      .insert({
        request_id: data.id,
        actor_type: "linkedin_reviewer",
        actor_id: session.sub,
        action: "submitted",
        from_status: null,
        to_status: "pending",
        note: `Role=${payload.professionalRole}; scope=${payload.fieldScope}`,
      });

    if (eventErr) {
      logger.warn("clinical_edit_event_insert_failed", {
        requestId: data.id,
        error: eventErr.message,
      });
    }

    const notifyTo =
      process.env.CLINICAL_REVIEW_NOTIFY_EMAIL?.trim() ||
      process.env.ZOHO_SMTP_USER?.trim() ||
      "";
    if (isMailConfigured() && notifyTo) {
      // Never include raw licence numbers or full PHI-risk prose in email alerts.
      const targetDesc = [
        payload.targetType,
        payload.herbSlug,
        payload.drugName,
      ]
        .filter(Boolean)
        .join(" · ");
      const contributorLabel = payload.credentials
        ? `${session.name} (${payload.credentials})`
        : session.name;
      const profileLine = payload.linkedinProfileUrl || "Not provided";
      void sendMail({
        to: notifyTo,
        subject: `[HerbAlly Edit Suggestion] ${payload.summary.slice(0, 80)}`,
        text: [
          `New LinkedIn-validated edit suggestion (${data.id})`,
          `Contributor: ${contributorLabel}`,
          `LinkedIn Profile: ${profileLine}`,
          `Role: ${payload.professionalRole}`,
          `Target: ${targetDesc}`,
          `Scope: ${payload.fieldScope}`,
          `Summary: ${payload.summary}`,
          `Triage in Admin: https://herbally.app/admin/edit-requests`,
        ].join("\n"),
        html: `<p>New LinkedIn-validated edit suggestion (<code>${escapeHtml(data.id)}</code>)</p>
<ul>
  <li><strong>Contributor:</strong> ${escapeHtml(contributorLabel)}</li>
  <li><strong>LinkedIn:</strong> ${
    payload.linkedinProfileUrl
      ? `<a href="${escapeHtml(payload.linkedinProfileUrl)}">${escapeHtml(payload.linkedinProfileUrl)}</a>`
      : "Not provided"
  }</li>
  <li><strong>Role:</strong> ${escapeHtml(payload.professionalRole)}</li>
  <li><strong>Target:</strong> ${escapeHtml(targetDesc)} (${escapeHtml(payload.fieldScope)})</li>
  <li><strong>Summary:</strong> ${escapeHtml(payload.summary)}</li>
</ul>
<p><a href="https://herbally.app/admin/edit-requests">Open Admin Triage Queue</a></p>`,
        timeoutMs: 8000,
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        accepted: true,
        id: data.id,
        status: data.status,
        createdAt: data.created_at,
      },
      { status: 201, headers: NO_STORE }
    );
  } catch (err) {
    logger.error("clinical_edit_exception", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { accepted: false, error: "Could not save clinical edit request." },
      { status: 500, headers: NO_STORE }
    );
  }
}
