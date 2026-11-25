"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/auth/admin-guard";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { clientIPFromHeaders } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";

export type EnrollTotpResult =
  | {
      success: true;
      factorId: string;
      qrCode: string;
      secret: string;
    }
  | { success: false; error: string };

export type VerifyTotpResult =
  { success: true } | { success: false; error: string };

async function assertAdminRole(): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      userId: string;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile?.role ?? "user") !== "admin") {
    return { ok: false, error: "Admin access required." };
  }
  return { ok: true, supabase, userId: user.id };
}

async function isMfaRateLimited(scope: string): Promise<boolean> {
  let ip = "unknown";
  try {
    ip = clientIPFromHeaders(await headers());
  } catch {
    // non-request context
  }
  const { success } = await rateLimit(rateLimitKey(scope, ip), 10, 60_000);
  return !success;
}

export async function startAdminTotpEnrollment(): Promise<EnrollTotpResult> {
  if (await isMfaRateLimited("admin-mfa-enroll")) {
    return { success: false, error: "Too many attempts. Wait a minute." };
  }
  const auth = await assertAdminRole();
  if (!auth.ok) return { success: false, error: auth.error };

  try {
    const [{ data: listed, error: listErr }, { data: aal, error: aalErr }] =
      await Promise.all([
        auth.supabase.auth.mfa.listFactors(),
        auth.supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

    if (listErr || aalErr) {
      return { success: false, error: "Could not verify MFA session state." };
    }

    const verifiedTotp = (listed?.totp ?? []).filter(
      (f) => f.status === "verified"
    );
    if (verifiedTotp.length > 0 && aal?.currentLevel !== "aal2") {
      logger.warn("admin_mfa_enroll_denied_aal1", { userId: auth.userId });
      return {
        success: false,
        error:
          "Two-factor verification (AAL2) is required before enrolling another authenticator.",
      };
    }

    // Clear any stale unverified TOTP factors before creating a fresh enrollment
    const unverified = (listed?.totp ?? []).filter(
      (f) => f.status !== "verified"
    );
    for (const stale of unverified) {
      await auth.supabase.auth.mfa.unenroll({ factorId: stale.id });
    }

    const { data, error } = await auth.supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: "HerbAlly",
      friendlyName: `HerbAlly Admin (${new Date().toISOString().slice(0, 10)})`,
    });

    if (error || !data || data.type !== "totp") {
      if (error) {
        logger.error("admin_mfa_enroll_upstream_failed", {
          error: error.message,
        });
      }
      return {
        success: false,
        error: "Could not start authenticator setup.",
      };
    }

    return {
      success: true,
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    };
  } catch (err) {
    logger.error("admin_mfa_enroll_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: "Failed to initialize 2FA enrollment." };
  }
}

export async function verifyAdminTotpCode(
  factorId: string,
  rawCode: string
): Promise<VerifyTotpResult> {
  if (await isMfaRateLimited("admin-mfa-verify")) {
    return {
      success: false,
      error: "Too many verification attempts. Try again in a minute.",
    };
  }
  const auth = await assertAdminRole();
  if (!auth.ok) return { success: false, error: auth.error };

  const code = rawCode.replace(/\s+/g, "").trim();
  if (!/^\d{6}$/.test(code)) {
    return { success: false, error: "Enter the 6-digit authenticator code." };
  }
  if (!factorId) {
    return { success: false, error: "Missing authenticator factor ID." };
  }

  try {
    const [{ data: listed, error: listErr }, { data: aal, error: aalErr }] =
      await Promise.all([
        auth.supabase.auth.mfa.listFactors(),
        auth.supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
    if (listErr || aalErr) {
      return { success: false, error: "Could not verify MFA session state." };
    }

    const totpFactors = listed?.totp ?? [];
    const verifiedTotp = totpFactors.filter((f) => f.status === "verified");
    const target = totpFactors.find((f) => f.id === factorId);
    if (!target) {
      return { success: false, error: "Authenticator factor not found." };
    }
    if (
      verifiedTotp.length > 0 &&
      aal?.currentLevel !== "aal2" &&
      target.status !== "verified"
    ) {
      logger.warn("admin_mfa_verify_unverified_denied_aal1", {
        userId: auth.userId,
      });
      return {
        success: false,
        error: "Verify your existing authenticator factor first.",
      };
    }

    const { error } = await auth.supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (error) {
      return { success: false, error: "Invalid or expired code. Try again." };
    }
    revalidatePath("/admin", "layout");
    return { success: true };
  } catch (err) {
    logger.error("admin_mfa_verify_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: "Verification failed. Please retry." };
  }
}

export async function removeAdminTotpFactor(
  factorId: string
): Promise<VerifyTotpResult> {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return { success: false, error: "2FA session required to manage factors." };
  }
  if (access.factors.length <= 1) {
    return {
      success: false,
      error: "Cannot remove your only active admin authenticator factor.",
    };
  }
  const { error } = await access.supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    logger.error("admin_mfa_unenroll_failed", { error: error.message });
    return { success: false, error: "Could not remove authenticator factor." };
  }
  revalidatePath("/admin", "layout");
  return { success: true };
}
