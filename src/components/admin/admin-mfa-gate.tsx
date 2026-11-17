"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound, QrCode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  startAdminTotpEnrollment,
  verifyAdminTotpCode,
} from "@/lib/actions/admin-mfa";

interface AdminMfaGateProps {
  mode: "enroll" | "verify";
  factorId?: string;
}

export function AdminMfaGate({
  mode,
  factorId: initialFactorId,
}: AdminMfaGateProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [factorId, setFactorId] = useState(initialFactorId ?? "");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleStartEnrollment() {
    setError(null);
    startTransition(async () => {
      const res = await startAdminTotpEnrollment();
      if (!res.success) {
        setError(res.error);
        return;
      }
      setFactorId(res.factorId);
      setQrCode(res.qrCode);
      setSecret(res.secret);
    });
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyAdminTotpCode(factorId, code);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
      <div className="w-full rounded-xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">
              Admin Two-Factor Verification
            </h1>
            <p className="text-xs text-muted-foreground">
              {mode === "enroll"
                ? "Set up an authenticator app once to protect admin controls."
                : "Enter the 6-digit code from your authenticator app."}
            </p>
          </div>
        </div>

        {mode === "enroll" && !qrCode && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your admin account requires a time-based authenticator app
              (1Password, Apple Passwords, or Google Authenticator) before
              viewing or editing data.
            </p>
            <Button
              type="button"
              onClick={handleStartEnrollment}
              disabled={isPending}
              className="w-full"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="mr-2 h-4 w-4" />
              )}
              Set up authenticator app
            </Button>
          </div>
        )}

        {qrCode && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-center">
            {/* GoTrue returns a self-contained SVG data URI */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCode}
              alt="Scan QR code in your authenticator app"
              className="mx-auto h-44 w-44 rounded bg-white p-2"
            />
            {secret && (
              <div className="text-xs">
                <span className="text-muted-foreground">
                  Manual setup key:{" "}
                </span>
                <code className="select-all rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                  {secret}
                </code>
              </div>
            )}
          </div>
        )}

        {(mode === "verify" || qrCode) && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="totp-code">6-digit authenticator code</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="\d{6}"
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  className="pl-9 font-mono tracking-widest"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isPending || code.length !== 6}
              className="w-full"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Verify & Continue"
              )}
            </Button>
          </form>
        )}

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
