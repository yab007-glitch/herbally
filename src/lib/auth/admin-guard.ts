import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export interface VerifiedMfaFactor {
  id: string;
  friendlyName: string | null;
  createdAt: string | null;
}

export type AdminAccessResult =
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | {
      status: "mfa_enroll_required";
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: User;
    }
  | {
      status: "mfa_required";
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: User;
      factorId: string;
    }
  | {
      status: "authorized";
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: User;
      factors: VerifiedMfaFactor[];
    };

/**
 * Authorize an admin session using database role truth plus TOTP MFA (aal2).
 * Never trusts client-supplied JWT role metadata, and blocks admin routes and
 * mutations until a verified TOTP factor is active at aal2.
 */
export async function getAdminAccess(): Promise<AdminAccessResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "unauthenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((profile?.role ?? "user") !== "admin") {
    return { status: "forbidden" };
  }

  const [{ data: aal }, { data: factorsData }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);

  const verifiedTotp: VerifiedMfaFactor[] = (factorsData?.totp ?? [])
    .filter((f) => f.status === "verified")
    .map((f) => ({
      id: f.id,
      friendlyName: f.friendly_name ?? null,
      createdAt: f.created_at ?? null,
    }));

  if (aal?.currentLevel === "aal2" && verifiedTotp.length > 0) {
    return { status: "authorized", supabase, user, factors: verifiedTotp };
  }

  if (verifiedTotp.length > 0) {
    return {
      status: "mfa_required",
      supabase,
      user,
      factorId: verifiedTotp[0].id,
    };
  }

  return { status: "mfa_enroll_required", supabase, user };
}
